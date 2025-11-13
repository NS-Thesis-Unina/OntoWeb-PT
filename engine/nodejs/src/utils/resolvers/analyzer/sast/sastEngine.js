const acorn = require('acorn');
const { ancestor, full } = require('acorn-walk');
const staticRules = require('./rules/staticRules');
const formRules = require('./rules/formRules'); // 👈 nuovo
const taintRules = require('./rules/taintRules');
const axios = require('axios').default;


class sastEngine {
  /**
   * @param {object} [options]
   * @param {number} [options.policy]
   * @param {boolean} [options.includeSnippets]
   */
  constructor(options = {}) {

    this.rules = staticRules.concat(formRules, taintRules);
    this.policy = options.policy || 0;
    this.includeSnippets = options.includeSnippets ?? false;
  }

  /**
   * 
   * @param {Array<{code: string, src?: string}>} scripts
   * @param {string} html
   * @param {string} file
   * @param {Array} forms
   * @param {Array} iframes
   * @returns {Promise<Array>}
   */
  async scanCode(scripts = [], html = '', file = '', forms = [], iframes = []) {
    const codeByFile = Object.create(null);
    const allBodies = [];
    const rawFindings = [];

   
    for (const rule of this.rules) {
      try {
        if (typeof rule.checkHtml === 'function') {
          const htmlFindings = rule.checkHtml(html);
          if (Array.isArray(htmlFindings)) rawFindings.push(...htmlFindings);
        }
      } catch {
        continue;
      }
    }

  
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

   
    for (const script of scripts) {
      const fileId = script.src || `inline-script[#${allBodies.length}]`;
      let code = script.code || '';

      if (script.src) {
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

    if (allBodies.length === 0) return rawFindings;

 
    const firstFileId = Object.keys(codeByFile)[0];
    const firstCode = codeByFile[firstFileId];
    const templateAST = acorn.parse(firstCode, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
    });
    templateAST.body = allBodies.flat();


    for (const rule of this.rules) {
      if (typeof rule.check !== 'function') continue;
      try {
        const findings = rule.check.call(rule, templateAST, { file }, ancestor);
        if (Array.isArray(findings)) rawFindings.push(...findings);
      } catch {
        continue;
      }
      if (rawFindings.length > 300) break;
    }

 
    const issues = [];

    for (const issue of rawFindings) {
      const { file: fId, location, sourceFile, sourceLoc, sinkFile, sinkLoc } = issue;

      if (this.includeSnippets && fId && codeByFile[fId] && location) {
        issue.snippet = this.getCodeSnippetExt(codeByFile[fId], location);
      }
      if (this.includeSnippets && sourceFile && sourceLoc && codeByFile[sourceFile]) {
        issue.sourceSnippet = this.getCodeSnippetExt(codeByFile[sourceFile], sourceLoc);
      }
      if (this.includeSnippets && sinkFile && sinkLoc && codeByFile[sinkFile]) {
        issue.sinkSnippet = this.getCodeSnippetExt(codeByFile[sinkFile], sinkLoc);
      }

    
      let contextVector = { type: 'unknown', index: null };


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


      else if (fId?.startsWith('inline-handler')) {
        const idx = Number(fId.match(/\[#(\d+)\]/)?.[1] ?? -1);
        contextVector = {
          type: 'html-inline-handler',
          index: idx,
          origin: 'markup',
        };
      }


      else if (fId === 'HTML Document') {
        // @ts-ignore
        contextVector = { type: 'html', origin: 'markup' };
      }

    
      else {
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


      if (issue.ruleId?.includes('form')) {
        const idx = forms.findIndex((f) =>
          (f.action && html.includes(f.action)) ||
          issue.snippet?.includes(f.action)
        );
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
      issues.push(issue);
    }

    return issues;
  }

 
  extractInlineHandlers(htmlText) {
    const attrs = [
      'onclick', 'onload', 'onerror', 'onsubmit', 'onmouseover',
      'onfocus', 'onchange', 'onkeydown', 'onkeyup', 'oninput',
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

  
  getCodeSnippetExt(code, location) {
    if (!code || !location) return '';
    const lines = code.split(/\r?\n/);
    const { start, end } = location;
    const startLine = Math.max(0, (start.line || 1) - 2);
    const endLine = Math.min(lines.length - 1, (end.line || start.line) + 1);
    const context = lines.slice(startLine, endLine + 1);
    return context.join('\n');
  }
}

module.exports = { sastEngine };
