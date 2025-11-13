
const formRules = [
  {
    id: 'form-method-get',
    description: 'Form uses GET method, potentially exposing sensitive data in URL.',
    severity: 'medium',
    category: 'Insecure Data Transmission',
    owasp: 'A04:2021 – Insecure Design',

    checkHtml(html) {
      const issues = [];
      const regex = /<form[^>]*method=["']get["'][^>]*>/gi;
      let match;
      while ((match = regex.exec(html))) {
        issues.push({
          ruleId: this.id,
          description: this.description,
          severity: this.severity,
          category: this.category,
          owasp: this.owasp,
          file: 'HTML Document',
          location: { start: match.index, end: regex.lastIndex },
        });
      }
      return issues;
    },
  },

  {
    id: 'form-external-action',
    description: 'Form action points to an external domain (possible data exfiltration).',
    severity: 'high',
    category: 'Cross-Domain Submission',
    owasp: 'A03:2021 – Injection',

    checkHtml(html) {
      const issues = [];
      const regex = /<form[^>]*action=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
      let match;
      while ((match = regex.exec(html))) {
        const target = match[1];
        issues.push({
          ruleId: this.id,
          description: this.description,
          severity: this.severity,
          category: this.category,
          owasp: this.owasp,
          file: 'HTML Document',
          location: { start: match.index, end: regex.lastIndex },
          externalTarget: target,
        });
      }
      return issues;
    },
  },

  {
    id: 'form-open-redirect',
    description: 'Form may contain open redirect parameter in action or inputs.',
    severity: 'high',
    category: 'Open Redirect',
    owasp: 'A01:2021 – Broken Access Control',

    checkHtml(html) {
      const issues = [];
      const regex = /(redirect|target)=https?:\/\/[^"']+/gi;
      let match;
      while ((match = regex.exec(html))) {
        issues.push({
          ruleId: this.id,
          description: this.description,
          severity: this.severity,
          category: this.category,
          owasp: this.owasp,
          file: 'HTML Document',
          location: { start: match.index, end: regex.lastIndex },
        });
      }
      return issues;
    },
  },
];

module.exports = formRules;
