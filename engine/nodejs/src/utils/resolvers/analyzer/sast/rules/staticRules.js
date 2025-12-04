const xssRule = {
  id: 'no-innerhtml',
  description: 'Disallow innerHTML assignments to prevent XSS.',
  severity: 'medium',
  check(ast, meta, walk) {
    const self = this;
    const issues = [];
    walk(ast, {
      AssignmentExpression(node) {
        if (node.left.type === 'MemberExpression' && node.left.property.name === 'innerHTML') {
          issues.push({
            ruleId: self.id,
            description: self.description,
            severity: self.severity,
            category: 'DOM XSS',
            owasp: 'A03:2021 – Injection',
            file: node.sourceFile || meta.fileId,
            type: node.type,
            location: node.loc,
          });
        }
      },
    });
    return issues;
  },
};

const noEvalRule = {
  id: 'no-eval',
  description: 'Disallow use of eval() to prevent remote code execution.',
  severity: 'high',
  check(ast, meta, walk) {
    const self = this;
    const issues = [];
    walk(ast, {
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'eval') {
          issues.push({
            ruleId: self.id,
            description: self.description,
            severity: self.severity,
            category: 'Code Injection',
            owasp: 'A03:2021 – Injection',
            file: node.sourceFile || meta.fileId,
            type: node.type,
            location: node.loc,
          });
        }
      },
    });
    return issues;
  },
};

const documentWriteRule = {
  id: 'no-document-write',
  description: 'Disallow use of document.write() to prevent XSS.',
  severity: 'medium',
  check(ast, meta, walk) {
    const self = this;
    const issues = [];
    walk(ast, {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.name === 'document' &&
          node.callee.property.name === 'write'
        ) {
          issues.push({
            ruleId: self.id,
            description: self.description,
            severity: self.severity,
            category: 'DOM XSS',
            owasp: 'A03:2021 – Injection',
            file: node.sourceFile || meta.fileId,
            type: node.type,
            location: node.loc,
          });
        }
      },
    });
    return issues;
  },
};

const insertAdjacentHTMLRule = {
  id: 'no-insertadjacenthtml',
  description: 'Disallow use of insertAdjacentHTML() to prevent DOM-based XSS.',
  severity: 'medium',
  check(ast, meta, walk) {
    const self = this;
    const issues = [];
    walk(ast, {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.name &&
          node.callee.property.name.toLowerCase() === 'insertadjacenthtml'
        ) {
          issues.push({
            ruleId: self.id,
            description: self.description,
            severity: self.severity,
            category: 'DOM XSS',
            owasp: 'A03:2021 – Injection',
            file: node.sourceFile || meta.fileId,
            type: node.type,
            location: node.loc,
          });
        }
      },
    });
    return issues;
  },
};

const appendChildRule = {
  id: 'no-appendchild',
  description: 'Detect appendChild() used for unsanitized HTML injection.',
  severity: 'medium',
  check(ast, meta, walk) {
    const self = this;
    const issues = [];
    walk(ast, {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.name === 'appendChild'
        ) {
          issues.push({
            ruleId: self.id,
            description: self.description,
            severity: self.severity,
            category: 'DOM Manipulation Injection',
            owasp: 'A03:2021 – Injection',
            file: node.sourceFile || meta.fileId,
            type: node.type,
            location: node.loc,
          });
        }
      },
    });
    return issues;
  },
};

const functionConstructorRule = {
  id: 'no-function-constructor',
  description: 'Disallow Function constructor to prevent dynamic code execution.',
  severity: 'high',
  check(ast, meta, walk) {
    const self = this;
    const issues = [];
    walk(ast, {
      NewExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'Function') {
          issues.push({
            ruleId: self.id,
            description: self.description,
            severity: self.severity,
            category: 'Code Injection',
            owasp: 'A03:2021 – Injection',
            file: node.sourceFile || meta.fileId,
            type: node.type,
            location: node.loc,
          });
        }
      },
    });
    return issues;
  },
};

const openRedirectRule = {
  id: 'no-open-redirect',
  description: 'Detect potential open redirects via window.open() or location.assign().',
  severity: 'medium',
  check(ast, meta, walk) {
    const self = this;
    const issues = [];
    walk(ast, {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          ((node.callee.object.name === 'window' && node.callee.property.name === 'open') ||
            (node.callee.object.name === 'location' && node.callee.property.name === 'assign'))
        ) {
          issues.push({
            ruleId: self.id,
            description: self.description,
            severity: self.severity,
            category: 'Open Redirect',
            owasp: 'A01:2021 – Broken Access Control',
            file: node.sourceFile || meta.fileId,
            type: node.type,
            location: node.loc,
          });
        }
      },
    });
    return issues;
  },
};

const localStorageRule = {
  id: 'no-localstorage-sensitive',
  description: 'Detect access to localStorage/sessionStorage which may expose sensitive data.',
  severity: 'medium',
  check(ast, meta, walk) {
    const self = this;
    const issues = [];
    walk(ast, {
      MemberExpression(node) {
        if (node.object.name && ['localStorage', 'sessionStorage'].includes(node.object.name)) {
          issues.push({
            ruleId: self.id,
            description: self.description,
            severity: self.severity,
            category: 'Client-Side Storage Exposure',
            owasp: 'A02:2021 – Cryptographic Failures',
            file: node.sourceFile || meta.fileId,
            type: node.type,
            location: node.loc,
          });
        }
      },
    });
    return issues;
  },
};

const insecureHttpRule = {
  id: 'no-insecure-http',
  description: 'Detect HTTP (non-HTTPS) external resource loads.',
  severity: 'high',
  check(ast, meta, walk) {
    const self = this;
    const issues = [];
    walk(ast, {
      Literal(node) {
        if (typeof node.value === 'string' && node.value.startsWith('http://')) {
          issues.push({
            ruleId: self.id,
            description: self.description,
            severity: self.severity,
            category: 'Insecure Transport',
            owasp: 'A02:2021 – Cryptographic Failures',
            file: node.sourceFile || meta.fileId,
            type: node.type,
            location: node.loc,
          });
        }
      },
    });
    return issues;
  },
};

const cookieManipulationRule = {
  id: 'no-document-cookie-write',
  description: 'Detect document.cookie assignments (session hijacking risk).',
  severity: 'medium',
  check(ast, meta, walk) {
    const self = this;
    const issues = [];
    walk(ast, {
      AssignmentExpression(node) {
        if (
          node.left.type === 'MemberExpression' &&
          node.left.object.name === 'document' &&
          node.left.property.name === 'cookie'
        ) {
          issues.push({
            ruleId: self.id,
            description: self.description,
            severity: self.severity,
            category: 'Insecure Cookie Manipulation',
            owasp: 'A07:2021 – Identification and Authentication Failures',
            file: node.sourceFile || meta.fileId,
            type: node.type,
            location: node.loc,
          });
        }
      },
    });
    return issues;
  },
};

const innerScriptRule = {
  id: 'no-inline-script-creation',
  description: 'Detect dynamic script creation using createElement("script").',
  severity: 'medium',
  check(ast, meta, walk) {
    const self = this;
    const issues = [];
    walk(ast, {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.name === 'document' &&
          node.callee.property.name === 'createElement' &&
          node.arguments?.[0]?.value === 'script'
        ) {
          issues.push({
            ruleId: self.id,
            description: self.description,
            severity: self.severity,
            category: 'Dynamic Script Injection',
            owasp: 'A03:2021 – Injection',
            file: node.sourceFile || meta.fileId,
            type: node.type,
            location: node.loc,
          });
        }
      },
    });
    return issues;
  },
};

/* ===============================================================
   🧩 HTML-LEVEL RULES
================================================================= */

const htmlInlineEventRule = {
  id: 'html-inline-event',
  description: 'Detect inline event handlers (onclick, onerror, onload, etc.).',
  severity: 'medium',
  checkHtml(htmlText) {
    const issues = [];
    const attrs = [
      'onclick',
      'onerror',
      'onload',
      'onmouseover',
      'onfocus',
      'onchange',
      'onkeydown',
      'onkeyup',
      'oninput',
      'onsubmit',
    ];
    for (const attr of attrs) {
      const re = new RegExp(`\\b${attr}\\s*=\\s*["']`, 'gi');
      let match;
      while ((match = re.exec(htmlText))) {
        issues.push({
          ruleId: 'html-inline-event',
          description: 'Inline event handler detected.',
          severity: 'medium',
          category: 'Inline Script Injection',
          owasp: 'A03:2021 – Injection',
          location: { start: match.index, end: match.index + attr.length },
          file: 'HTML Document',
        });
      }
    }
    return issues;
  },
};

const htmlInlineStyleRule = {
  id: 'html-inline-style-expression',
  description: 'Detect inline CSS expressions (potential XSS in old browsers).',
  severity: 'low',
  checkHtml(htmlText) {
    const issues = [];
    const re = /style\s*=\s*["'][^"']*expression\s*\(/gi;
    let match;
    while ((match = re.exec(htmlText))) {
      issues.push({
        ruleId: 'html-inline-style-expression',
        description: 'Inline style contains expression()',
        severity: 'low',
        category: 'Legacy CSS Injection',
        owasp: 'A03:2021 – Injection',
        location: { start: match.index, end: match.index + 10 },
        file: 'HTML Document',
      });
    }
    return issues;
  },
};

const htmlIframeRule = {
  id: 'html-iframe-srcdoc',
  description: 'Detect iframes using srcdoc or base64 HTML (potential content injection).',
  severity: 'medium',
  checkHtml(htmlText) {
    const issues = [];
    const re = /<iframe[^>]+(srcdoc=|src=['"]data:text\/html)/gi;
    let match;
    while ((match = re.exec(htmlText))) {
      issues.push({
        ruleId: 'html-iframe-srcdoc',
        description: 'Iframe contains inline HTML or base64 payload.',
        severity: 'medium',
        category: 'Content Injection',
        owasp: 'A05:2021 – Security Misconfiguration',
        location: { start: match.index, end: match.index + 15 },
        file: 'HTML Document',
      });
    }
    return issues;
  },
};

module.exports = [
  xssRule,
  noEvalRule,
  documentWriteRule,
  insertAdjacentHTMLRule,
  appendChildRule,
  functionConstructorRule,
  openRedirectRule,
  localStorageRule,
  insecureHttpRule,
  cookieManipulationRule,
  innerScriptRule,
  htmlInlineEventRule,
  htmlInlineStyleRule,
  htmlIframeRule,
];
