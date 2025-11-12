const acorn = require('acorn');
const { ancestor, full } = require('acorn-walk');
const staticRules = require('./rules/staticRules');
const taintRules = require('./rules/taintRules');
const axios = require('axios').default;


class sastEngine {
  /**
   * @param {object} [options]
   * @param {number} [options.policy] 
   * @param {boolean} [options.includeSnippets] 
   */
  constructor(options = {}) {
    this.rules = staticRules.concat(taintRules);
    this.policy = options.policy || 0;
    this.includeSnippets = options.includeSnippets ?? false;
  }

  /**
   * @param {Array<{code: string, src?: string}>} scripts
   * @param {string} html
   * @param {string} file
   * @returns {Promise<Array>}
   */
  async scanCode(scripts = [], html = '', file = '') {
    const codeByFile = Object.create(null);
    const allBodies = [];
    const rawFindings = [];


    for (const rule of this.rules) {
      try {
        if (typeof rule.checkHtml === 'function') {
          const htmlFindings = rule.checkHtml(html);
          if (Array.isArray(htmlFindings)) rawFindings.push(...htmlFindings);
        }
      } catch (err) {
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
    // @ts-ignore
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
      const re = new RegExp(`\\b${attr}\\s*=\\s*"(.*?)"|\\b${attr}\\s*=\\s*'(.*?)'`, 'gi');
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
