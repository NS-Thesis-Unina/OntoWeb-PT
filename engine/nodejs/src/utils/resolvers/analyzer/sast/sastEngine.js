// @ts-check

const acorn = require('acorn');
const { ancestor, full } = require('acorn-walk');
const staticRules = require('./rules/staticRules');
const formRules = require('./rules/formRules');
const taintRules = require('./rules/taintRules');
const axios = require('axios').default;

/** @typedef {import('../../../_types/resolvers/analyzer/types').SastEngineOptions} SastEngineOptions */
/** @typedef {import('../../../_types/resolvers/analyzer/types').AnalyzerScriptInput} AnalyzerScriptInput */
/** @typedef {import('../../../_types/resolvers/analyzer/types').AnalyzerFormInput} AnalyzerFormInput */
/** @typedef {import('../../../_types/resolvers/analyzer/types').AnalyzerIframeInput} AnalyzerIframeInput */
/** @typedef {import('../../../_types/resolvers/analyzer/types').AnalyzerFinding} AnalyzerFinding */
/** @typedef {import('../../../_types/resolvers/analyzer/types').AnalyzerLocation} AnalyzerLocation */
/** @typedef {import('../../../_types/resolvers/analyzer/types').AnalyzerContextVector} AnalyzerContextVector */
/** @typedef {import('../../../_types/resolvers/analyzer/types').AnalyzerHtmlRef} AnalyzerHtmlRef */

class sastEngine {
  /**
   * Create a new SAST engine instance.
   *
   * @param {SastEngineOptions} [options]
   */
  constructor(options = {}) {
    // All static rules + HTML + taint rules
    this.rules = staticRules.concat(formRules, taintRules);
    this.policy = options.policy || 0;
    this.includeSnippets = options.includeSnippets ?? false;
  }

  /**
   * Run SAST analysis on the collected artifacts for a single page.
   *
   * @param {AnalyzerScriptInput[]} [scripts=[]] - Array of scripts (inline and external).
   * @param {string} [html=''] - Full HTML document.
   * @param {string} [pageUrl=''] - Page URL used for ontology linking.
   * @param {AnalyzerFormInput[]} [forms=[]] - Structured forms.
   * @param {AnalyzerIframeInput[]} [iframes=[]] - Structured iframes.
   * @returns {Promise<AnalyzerFinding[]>} List of normalized findings.
   */
  async scanCode(scripts = [], html = '', pageUrl = '', forms = [], iframes = []) {
    /** @type {Record<string, string>} */
    const codeByFile = Object.create(null);
    /** @type {any[]} */
    const allBodies = [];
    /** @type {AnalyzerFinding[]} */
    const rawFindings = [];

    // ============================================================
    // 1) Rules that operate directly on HTML (checkHtml)
    // ============================================================
    for (const rule of this.rules) {
      try {
        if (typeof rule.checkHtml === 'function') {
          const htmlFindings = rule.checkHtml(html);
          if (Array.isArray(htmlFindings)) {
            for (const f of htmlFindings) {
              // Enrich immediately with pageUrl reference
              // @ts-ignore - rule objects are structurally compatible
              f.pageUrl = pageUrl || null;
              // @ts-ignore
              rawFindings.push(f);
            }
          }
        }
      } catch {
        continue;
      }
    }

    // ============================================================
    // 2) Inline handlers inside HTML attributes (onclick="...", etc.)
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
    // 3) External and inline <script> tags
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
      // No JS code; return only HTML findings
      return rawFindings;
    }

    // ============================================================
    // 4) AST "template" with all bodies, for static/taint rules
    // ============================================================
    const firstFileId = Object.keys(codeByFile)[0];
    const firstCode = codeByFile[firstFileId];
    const templateAST = acorn.parse(firstCode || '', {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
    });
    templateAST.body = allBodies.flat();

    // Run all rules that expose a check(AST) handler
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
            // @ts-ignore
            f.pageUrl = pageUrl || null;
            // @ts-ignore
            rawFindings.push(f);
          }
        }
      } catch {
        continue;
      }
      if (rawFindings.length > 300) break;
    }

    // ============================================================
    // 5) Normalization & enrichment:
    //    - JS / HTML snippets
    //    - contextVector (script/iframe/form/html)
    //    - htmlRef (Tag/Field for ontology)
    //    - stable findingId
    // ============================================================
    /** @type {AnalyzerFinding[]} */
    const issues = [];

    for (const issue of rawFindings) {
      // @ts-ignore
      const { file: fId, location, sourceFile, sourceLoc, sinkFile, sinkLoc } = issue;

      if (!issue.pageUrl) {
        // @ts-ignore
        issue.pageUrl = pageUrl || null;
      }

      // -------------------------------
      // JS snippet based on line/column
      // -------------------------------
      if (
        this.includeSnippets &&
        fId &&
        codeByFile[fId] &&
        location &&
        typeof location.start === 'object'
      ) {
        // @ts-ignore
        issue.snippet = this.getCodeSnippetExt(codeByFile[fId], location);
      }

      // -------------------------------
      // HTML snippet based on offsets
      // -------------------------------
      if (
        this.includeSnippets &&
        fId === 'HTML Document' &&
        html &&
        location &&
        typeof location.start === 'number'
      ) {
        // @ts-ignore
        issue.snippet = this.getHtmlSnippet(html, location);
      }

      // -------------------------------
      // Additional snippets for taint (source/sink)
      // -------------------------------
      if (
        this.includeSnippets &&
        sourceFile &&
        sourceLoc &&
        codeByFile[sourceFile] &&
        typeof sourceLoc.start === 'object'
      ) {
        // @ts-ignore
        issue.sourceSnippet = this.getCodeSnippetExt(codeByFile[sourceFile], sourceLoc);
      }
      if (
        this.includeSnippets &&
        sinkFile &&
        sinkLoc &&
        codeByFile[sinkFile] &&
        typeof sinkLoc.start === 'object'
      ) {
        // @ts-ignore
        issue.sinkSnippet = this.getCodeSnippetExt(codeByFile[sinkFile], sinkLoc);
      }

      // -------------------------------
      // Context vector (for AnalyzerScan)
      // -------------------------------
      /** @type {AnalyzerContextVector} */
      let contextVector = { type: 'unknown', index: null, origin: null };

      // Inline <script> collected as inline-script[#i]
      if (fId?.startsWith('inline-script')) {
        const idx = Number(fId.match(/\[#(\d+)\]/)?.[1] ?? -1);
        const s = scripts[idx];
        contextVector = {
          type: 'script',
          index: idx,
          origin: s?.src ? 'external' : 'inline',
          src: s?.src || null,
          title: null,
          action: null,
          method: null,
          inputs: [],
        };
      }

      // Inline handlers in HTML attributes
      else if (fId?.startsWith('inline-handler')) {
        const idx = Number(fId.match(/\[#(\d+)\]/)?.[1] ?? -1);
        contextVector = {
          type: 'html-inline-handler',
          index: idx,
          origin: 'markup',
          src: null,
          title: null,
          action: null,
          method: null,
          inputs: [],
        };
      }

      // Findings directly on HTML
      else if (fId === 'HTML Document') {
        contextVector = {
          type: 'html',
          index: null,
          origin: 'markup',
          src: null,
          title: null,
          action: null,
          method: null,
          inputs: [],
        };
      }

      // External scripts (fileId matches one of the scripts.src)
      else if (fId) {
        const match = scripts.findIndex((s) => s.src === fId);
        if (match >= 0) {
          const s = scripts[match];
          contextVector = {
            type: 'script',
            index: match,
            origin: s?.src ? 'external' : 'inline',
            src: s?.src || null,
            title: null,
            action: null,
            method: null,
            inputs: [],
          };
        }
      }

      // Specialization for iframe rules
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
          action: null,
          method: null,
          inputs: [],
        };
      }

      // Specialization for form rules
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
          src: null,
          title: null,
          action: form?.action || null,
          method: form?.method || null,
          inputs: Array.isArray(form?.inputs)
            ? form.inputs.map((i) =>
                typeof i === 'string' ? i : i.name || i.tag || ''
              )
            : [],
        };
      }

      // @ts-ignore
      issue.contextVector = contextVector;

      // -------------------------------
      // htmlRef: structured info for ontology (HTML / Tag / Field)
      // -------------------------------
      // @ts-ignore
      issue.htmlRef = this.buildHtmlRef(contextVector, scripts, forms, iframes);

      // -------------------------------
      // findingId for stable IRIs
      // -------------------------------
      // @ts-ignore
      issue.findingId = this.buildFindingId(issue, fId, location, pageUrl);

      // @ts-ignore
      issues.push(issue);
    }

    return issues;
  }

  /**
   * Extract JS bodies from inline HTML event handlers
   * (onclick="...", onload="...", etc.).
   *
   * @param {string} htmlText
   * @returns {string[]}
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
   * Build a JS snippet based on line/column information.
   *
   * @param {string} code
   * @param {AnalyzerLocation} location
   * @returns {string}
   */
  getCodeSnippetExt(code, location) {
    if (!code || !location || typeof location.start !== 'object') return '';
    const lines = code.split(/\r?\n/);

    const startLoc = /** @type {{ line: number, column: number }} */ (
      location.start
    );
    const endLoc =
      location.end && typeof location.end === 'object'
        ? /** @type {{ line: number, column: number }} */ (location.end)
        : startLoc;

    const startLine = Math.max(0, (startLoc.line || 1) - 2);
    const endLine = Math.min(
      lines.length - 1,
      (endLoc.line || startLoc.line || 1) + 1
    );
    const context = lines.slice(startLine, endLine + 1);
    return context.join('\n');
  }

  /**
   * Build an HTML snippet based on offset information
   * (start/end numeric positions in the HTML text).
   *
   * @param {string} htmlText
   * @param {AnalyzerLocation} location
   * @returns {string}
   */
  getHtmlSnippet(htmlText, location) {
    if (!htmlText || !location || typeof location.start !== 'number') return '';

    const startNum = /** @type {number} */ (location.start ?? 0);
    const endNum =
      typeof location.end === 'number'
        ? location.end
        : startNum;

    const start = Math.max(0, startNum - 80);
    const end = Math.min(htmlText.length, endNum + 80);
    return htmlText.slice(start, end);
  }

  /**
   * Build a structured HTML reference (Tag + Fields) aligned with the ontology.
   *
   * @param {AnalyzerContextVector} contextVector
   * @param {AnalyzerScriptInput[]} scripts
   * @param {AnalyzerFormInput[]} forms
   * @param {AnalyzerIframeInput[]} iframes
   * @returns {AnalyzerHtmlRef | null}
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

      return /** @type {AnalyzerHtmlRef} */ ({
        type: 'script',
        tag: 'script',
        index: idx,
        attributes,
        fields: [],
      });
    }

    // Inline handler or generic HTML context
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

    // Default: no structured HTML reference
    return null;
  }

  /**
   * Build a stable finding ID (useful for ontology IRIs).
   *
   * @param {AnalyzerFinding} issue
   * @param {string} [fileId]
   * @param {AnalyzerLocation} [location]
   * @param {string} [pageUrl]
   * @returns {string}
   */
  buildFindingId(issue, fileId, location, pageUrl) {
    const ruleId = issue.ruleId || 'rule';
    const filePart = fileId || issue.file || 'file';

    let locPart = 'loc-unknown';
    if (location) {
      if (typeof location.start === 'number') {
        const startNum = /** @type {number} */ (location.start ?? 0);
        const endNum =
          typeof location.end === 'number'
            ? location.end
            : startNum;
        locPart = `off-${startNum}-${endNum}`;
      } else if (typeof location.start === 'object') {
        const startLoc = /** @type {{ line: number, column: number }} */ (
          location.start
        );
        const endLoc =
          location.end && typeof location.end === 'object'
            ? /** @type {{ line: number, column: number }} */ (location.end)
            : startLoc;

        const sLine = startLoc.line ?? 0;
        const sCol = startLoc.column ?? 0;
        const eLine = endLoc.line ?? sLine;
        const eCol = endLoc.column ?? sCol;
        locPart = `l${sLine}c${sCol}-l${eLine}c${eCol}`;
      }
    }

    const urlPart = pageUrl ? `@${pageUrl}` : '';
    return `${ruleId}:${filePart}:${locPart}${urlPart}`;
  }
}

module.exports = { sastEngine };
