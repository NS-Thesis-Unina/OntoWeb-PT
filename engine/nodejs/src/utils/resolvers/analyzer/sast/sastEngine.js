// src/analyzer/sast/sastEngine.js
const acorn = require('acorn');
const { ancestor, full } = require('acorn-walk');
const staticRules = require('./rules/staticRules');
const formRules = require('./rules/formRules');
const taintRules = require('./rules/taintRules');
const axios = require('axios').default;

class sastEngine {
  /**
   * @param {object} [options]
   * @param {number} [options.policy]
   * @param {boolean} [options.includeSnippets]
   */
  constructor(options = {}) {
    // Tutte le regole statiche + HTML + taint
    this.rules = staticRules.concat(formRules, taintRules);
    this.policy = options.policy || 0;
    this.includeSnippets = options.includeSnippets ?? false;
  }

  /**
   *
   * @param {Array<{code?: string, src?: string}>} scripts
   * @param {string} html
   * @param {string} pageUrl    // URL completo della pagina (usato per ontologia)
   * @param {Array} forms
   * @param {Array} iframes
   * @returns {Promise<Array>}
   */
  async scanCode(scripts = [], html = '', pageUrl = '', forms = [], iframes = []) {
    const codeByFile = Object.create(null);
    const allBodies = [];
    const rawFindings = [];

    // ============================================================
    // 1) Regole che lavorano direttamente sull'HTML (checkHtml)
    // ============================================================
    for (const rule of this.rules) {
      try {
        if (typeof rule.checkHtml === 'function') {
          const htmlFindings = rule.checkHtml(html);
          if (Array.isArray(htmlFindings)) {
            for (const f of htmlFindings) {
              // arricchisco subito con pageUrl di riferimento
              f.pageUrl = pageUrl || null;
              rawFindings.push(f);
            }
          }
        }
      } catch {
        continue;
      }
    }

    // ============================================================
    // 2) Handler inline negli attributi HTML (onclick="...", ecc.)
    // ============================================================
    const inlineSnippets = this.extractInlineHandlers(html);
    for (let i = 0; i < inlineSnippets.length; i++) {
      const snippet = inlineSnippets[i];
      try {
        const snippetAST = acorn.parse(snippet, {
          ecmaVersion: 'latest',
          sourceType: 'script',
          locations: true,
        });
        // @ts-ignore
        full(snippetAST, (n) => (n.sourceFile = `inline-handler[#${i}]`));
        allBodies.push(snippetAST.body);
        codeByFile[`inline-handler[#${i}]`] = snippet;
      } catch {
        continue;
      }
    }

    // ============================================================
    // 3) Script esterni e inline <script>
    // ============================================================
    for (const script of scripts) {
      const fileId = script.src || `inline-script[#${allBodies.length}]`;
      let code = script.code || '';

      if (script.src && (!code || typeof code !== 'string')) {
        try {
          const res = await axios.get(script.src, { timeout: 5000 });
          code = res.data;
        } catch {
          code = '';
        }
      }

      codeByFile[fileId] = code;
      try {
        const ast = acorn.parse(code, {
          ecmaVersion: 'latest',
          sourceType: 'module',
          locations: true,
        });
        // @ts-ignore
        full(ast, (n) => (n.sourceFile = fileId));
        allBodies.push(ast.body);
      } catch {
        continue;
      }
    }

    if (allBodies.length === 0) {
      // niente codice JS, ritorno solo le findings HTML
      return rawFindings;
    }

    // ============================================================
    // 4) AST "template" con tutti i corpi, per regole statiche/taint
    // ============================================================
    const firstFileId = Object.keys(codeByFile)[0];
    const firstCode = codeByFile[firstFileId];
    const templateAST = acorn.parse(firstCode || '', {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
    });
    templateAST.body = allBodies.flat();

    // eseguo tutte le regole che hanno check(AST)
    for (const rule of this.rules) {
      if (typeof rule.check !== 'function') continue;
      try {
        const findings = rule.check.call(
          rule,
          templateAST,
          { file: pageUrl || '', fileId: pageUrl || '' },
          ancestor
        );
        if (Array.isArray(findings)) {
          for (const f of findings) {
            f.pageUrl = pageUrl || null;
            rawFindings.push(f);
          }
        }
      } catch {
        continue;
      }
      if (rawFindings.length > 300) break;
    }

    // ============================================================
    // 5) Normalizzazione e arricchimento findings
    //    - snippet JS / HTML
    //    - contextVector (script/iframe/form/html)
    //    - htmlRef (Tag/Field per ontologia)
    //    - findingId stabile
    // ============================================================
    const issues = [];

    for (const issue of rawFindings) {
      const { file: fId, location, sourceFile, sourceLoc, sinkFile, sinkLoc } = issue;

      // Assicuro sempre la presenza di pageUrl nel singolo finding
      if (!issue.pageUrl) {
        issue.pageUrl = pageUrl || null;
      }

      // -------------------------------
      // Snippet: JS
      // -------------------------------
      if (
        this.includeSnippets &&
        fId &&
        codeByFile[fId] &&
        location &&
        typeof location.start === 'object'
      ) {
        issue.snippet = this.getCodeSnippetExt(codeByFile[fId], location);
      }

      // -------------------------------
      // Snippet: HTML (file === 'HTML Document' + offset numerico)
      // -------------------------------
      if (
        this.includeSnippets &&
        fId === 'HTML Document' &&
        html &&
        location &&
        typeof location.start === 'number'
      ) {
        issue.snippet = this.getHtmlSnippet(html, location);
      }

      // -------------------------------
      // Snippet aggiuntivi per taint (source/sink)
      // -------------------------------
      if (
        this.includeSnippets &&
        sourceFile &&
        sourceLoc &&
        codeByFile[sourceFile] &&
        typeof sourceLoc.start === 'object'
      ) {
        issue.sourceSnippet = this.getCodeSnippetExt(codeByFile[sourceFile], sourceLoc);
      }
      if (
        this.includeSnippets &&
        sinkFile &&
        sinkLoc &&
        codeByFile[sinkFile] &&
        typeof sinkLoc.start === 'object'
      ) {
        issue.sinkSnippet = this.getCodeSnippetExt(codeByFile[sinkFile], sinkLoc);
      }

      // -------------------------------
      // Context vector (per AnalyzerScan)
      // -------------------------------
      let contextVector = { type: 'unknown', index: null, origin: null };

      // inline <script> raccolti come inline-script[#i]
      if (fId?.startsWith('inline-script')) {
        const idx = Number(fId.match(/\[#(\d+)\]/)?.[1] ?? -1);
        const s = scripts[idx];
        contextVector = {
          type: 'script',
          index: idx,
          origin: s?.src ? 'external' : 'inline',
          src: s?.src || null,
        };
      }

      // handler inline negli attributi HTML
      else if (fId?.startsWith('inline-handler')) {
        const idx = Number(fId.match(/\[#(\d+)\]/)?.[1] ?? -1);
        contextVector = {
          type: 'html-inline-handler',
          index: idx,
          origin: 'markup',
        };
      }

      // findings direttamente sull'HTML
      else if (fId === 'HTML Document') {
        // @ts-ignore
        contextVector = { type: 'html', index: null, origin: 'markup' };
      }

      // script esterni (src matcha uno degli script)
      else if (fId) {
        const match = scripts.findIndex((s) => s.src === fId);
        if (match >= 0) {
          const s = scripts[match];
          contextVector = {
            type: 'script',
            index: match,
            origin: s?.src ? 'external' : 'inline',
            src: s?.src || null,
          };
        }
      }

      // Specializzazione per regole iframe
      if (issue.ruleId?.includes('iframe')) {
        let idx = -1;
        for (let i = 0; i < iframes.length; i++) {
          const f = iframes[i];
          if (!f?.src) continue;
          if (
            f.src.includes('data:text/html') ||
            html.includes(f.src) ||
            issue.snippet?.includes('iframe') ||
            issue.description?.toLowerCase().includes('iframe')
          ) {
            idx = i;
            break;
          }
        }
        const iframe = idx >= 0 ? iframes[idx] : null;
        contextVector = {
          type: 'iframe',
          index: idx >= 0 ? idx : null,
          origin: 'markup',
          src: iframe?.src || null,
          title: iframe?.title || null,
        };
      }

      // Specializzazione per regole form
      if (issue.ruleId?.includes('form')) {
        const idx = forms.findIndex((f) => {
          if (!f) return false;
          const action = f.action || '';
          if (!action) return false;
          return (
            (action && html.includes(action)) ||
            (issue.snippet && issue.snippet.includes(action))
          );
        });

        const form = forms[idx] || null;
        contextVector = {
          type: 'form',
          index: idx >= 0 ? idx : null,
          origin: 'markup',
          action: form?.action || null,
          method: form?.method || null,
          inputs: Array.isArray(form?.inputs)
            ? form.inputs.map((i) =>
                typeof i === 'string' ? i : i.name || i.tag || ''
              )
            : [],
        };
      }

      issue.contextVector = contextVector;

      // -------------------------------
      // htmlRef: info strutturata per ontologia (HTML / Tag / Field)
      // -------------------------------
      issue.htmlRef = this.buildHtmlRef(contextVector, scripts, forms, iframes);

      // -------------------------------
      // findingId stabile per IRIs ontologici
      // -------------------------------
      issue.findingId = this.buildFindingId(issue, fId, location, pageUrl);

      issues.push(issue);
    }

    return issues;
  }

  /**
   * Estrae i contenuti JS degli handler inline negli attributi HTML
   * (onclick="...", onload="...", ecc.)
   */
  extractInlineHandlers(htmlText) {
    const attrs = [
      'onclick',
      'onload',
      'onerror',
      'onsubmit',
      'onmouseover',
      'onfocus',
      'onchange',
      'onkeydown',
      'onkeyup',
      'oninput',
    ];
    const snippets = [];
    for (const attr of attrs) {
      const re = new RegExp(
        `\\b${attr}\\s*=\\s*"(.*?)"|\\b${attr}\\s*=\\s*'(.*?)'`,
        'gi'
      );
      let match;
      while ((match = re.exec(htmlText))) {
        const inner = (match[1] || match[2] || '').trim();
        if (inner) snippets.push(inner);
      }
    }
    return snippets;
  }

  /**
   * Snippet di codice JS basato su line/column
   */
  getCodeSnippetExt(code, location) {
    if (!code || !location) return '';
    const lines = code.split(/\r?\n/);
    const { start, end } = location;
    const startLine = Math.max(0, (start.line || 1) - 2);
    const endLine = Math.min(lines.length - 1, (end.line || start.line) + 1);
    const context = lines.slice(startLine, endLine + 1);
    return context.join('\n');
  }

  /**
   * Snippet HTML basato su offset (start/end numerici nel testo HTML)
   */
  getHtmlSnippet(htmlText, location) {
    if (!htmlText || !location) return '';
    const start = Math.max(0, (location.start ?? 0) - 80);
    const end = Math.min(htmlText.length, (location.end ?? location.start ?? 0) + 80);
    return htmlText.slice(start, end);
  }

  /**
   * Costruisce un riferimento HTML strutturato (Tag + Fields)
   * coerente con l'ontologia HTML / Tag / Field.
   *
   * @param {object} contextVector
   * @param {Array} scripts
   * @param {Array} forms
   * @param {Array} iframes
   */
  buildHtmlRef(contextVector, scripts, forms, iframes) {
    if (!contextVector || !contextVector.type) return null;

    // FORM
    if (contextVector.type === 'form' && contextVector.index != null) {
      const idx = contextVector.index;
      const form = forms[idx];
      if (!form) {
        return {
          type: 'form',
          tag: 'form',
          index: null,
          attributes: [],
          fields: [],
        };
      }

      const attributes = [
        form.action ? { name: 'action', value: form.action } : null,
        form.method ? { name: 'method', value: form.method } : null,
      ].filter(Boolean);

      const fields = Array.isArray(form.inputs)
        ? form.inputs.map((i) => {
            if (typeof i === 'string') {
              return {
                tag: 'input',
                name: null,
                type: null,
                attributes: [{ name: 'raw', value: i }],
              };
            }
            const attrs = [];
            if (i.name) attrs.push({ name: 'name', value: i.name });
            if (i.type) attrs.push({ name: 'type', value: i.type });
            if (i.id) attrs.push({ name: 'id', value: i.id });
            if (i.value) attrs.push({ name: 'value', value: i.value });
            if (i.tag) attrs.push({ name: 'tag', value: i.tag });

            return {
              tag: i.tag || 'input',
              name: i.name || null,
              type: i.type || null,
              attributes: attrs,
            };
          })
        : [];

      return {
        type: 'form',
        tag: 'form',
        index: idx,
        attributes,
        fields,
      };
    }

    // IFRAME
    if (contextVector.type === 'iframe' && contextVector.index != null) {
      const idx = contextVector.index;
      const iframe = iframes[idx];
      const attributes = [];
      if (iframe?.src) attributes.push({ name: 'src', value: iframe.src });
      if (iframe?.title) attributes.push({ name: 'title', value: iframe.title });
      if (iframe?.sandbox) attributes.push({ name: 'sandbox', value: iframe.sandbox });
      if (iframe?.allow) attributes.push({ name: 'allow', value: iframe.allow });

      return {
        type: 'iframe',
        tag: 'iframe',
        index: idx,
        attributes,
        fields: [],
      };
    }

    // SCRIPT
    if (contextVector.type === 'script') {
      const idx =
        typeof contextVector.index === 'number' ? contextVector.index : null;
      const script = idx != null ? scripts[idx] : null;
      const attributes = [];
      if (script?.src) attributes.push({ name: 'src', value: script.src });
      if (script?.type) attributes.push({ name: 'type', value: script.type });
      if (script?.async) attributes.push({ name: 'async', value: String(script.async) });
      if (script?.defer) attributes.push({ name: 'defer', value: String(script.defer) });

      return {
        type: 'script',
        tag: 'script',
        index: idx,
        attributes,
        fields: [],
      };
    }

    // HANDLER INLINE o HTML generico
    if (
      contextVector.type === 'html-inline-handler' ||
      contextVector.type === 'html'
    ) {
      return {
        type: contextVector.type,
        tag: 'html',
        index: contextVector.index ?? null,
        attributes: [],
        fields: [],
      };
    }

    // Default: nessun riferimento HTML strutturato
    return null;
  }

  /**
   * Costruisce un ID stabile per la finding (utile per IRIs dell'ontologia)
   */
  buildFindingId(issue, fileId, location, pageUrl) {
    const ruleId = issue.ruleId || 'rule';
    const filePart = fileId || issue.file || 'file';

    let locPart = 'loc-unknown';
    if (location) {
      if (typeof location.start === 'number') {
        const s = location.start ?? 0;
        const e = location.end ?? s;
        locPart = `off-${s}-${e}`;
      } else if (typeof location.start === 'object') {
        const sLine = location.start?.line ?? 0;
        const sCol = location.start?.column ?? 0;
        const eLine = location.end?.line ?? sLine;
        const eCol = location.end?.column ?? sCol;
        locPart = `l${sLine}c${sCol}-l${eLine}c${eCol}`;
      }
    }

    const urlPart = pageUrl ? `@${pageUrl}` : '';
    return `${ruleId}:${filePart}:${locPart}${urlPart}`;
  }
}

module.exports = { sastEngine };
