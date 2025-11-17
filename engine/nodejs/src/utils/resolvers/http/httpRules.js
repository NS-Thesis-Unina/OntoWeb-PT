/**
 * HTTP Security Rules (v1.0)
 * Basate su OWASP Top 10 2021
 */
const Buffer = require('buffer').Buffer;

function decodeBody(base64) {
  if (!base64) return '';
  try {
    return Buffer.from(base64, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

const httpRules = [
  // === Transport & Configuration (A05) ===
  {
    id: 'insecure-http',
    description: 'Request sent over HTTP instead of HTTPS.',
    category: 'Transport Security',
    owasp: 'A05:2021 – Security Misconfiguration',
    severity: 'high',
    check: (req) => req?.uri?.full?.startsWith('http://'),
  },
  {
    id: 'cors-misconfig',
    description: 'CORS policy too permissive (Access-Control-Allow-Origin: *).',
    category: 'Transport Security',
    owasp: 'A05:2021 – Security Misconfiguration',
    severity: 'medium',
    check: (req) =>
      (req?.response?.headers || []).some(
        (h) => h.name?.toLowerCase() === 'access-control-allow-origin' && h.value.trim() === '*'
      ),
  },
  {
    id: 'mixed-content',
    description: 'HTTPS page loads insecure HTTP subresource.',
    category: 'Transport Security',
    owasp: 'A05:2021 – Security Misconfiguration',
    severity: 'medium',
    check: (req) => {
      const body = decodeBody(req?.response?.bodyBase64);
      const origin = req?.uri?.full || '';
      return origin.startsWith('https://') && /http:\/\/[^"']+\.(js|css|png|jpg|gif)/i.test(body);
    },
  },

  // === Authentication & Session (A07) ===
  {
    id: 'insecure-cookie',
    description: 'Cookie not marked as Secure or HttpOnly.',
    category: 'Authentication & Session',
    owasp: 'A07:2021 – Identification and Authentication Failures',
    severity: 'medium',
    check: (req) => {
      const cookies = (req?.response?.headers || []).filter((h) => h.name?.toLowerCase() === 'set-cookie');
      return cookies.some(
        (c) => !/httponly/i.test(c.value || '') || !/secure/i.test(c.value || '')
      );
    },
  },
  {
    id: 'missing-samesite',
    description: 'Cookie missing SameSite attribute.',
    category: 'Authentication & Session',
    owasp: 'A07:2021 – Identification and Authentication Failures',
    severity: 'low',
    check: (req) => {
      const cookies = (req?.response?.headers || []).filter((h) => h.name?.toLowerCase() === 'set-cookie');
      return cookies.some((c) => !/samesite=/i.test(c.value || ''));
    },
  },
  {
    id: 'token-in-url',
    description: 'Sensitive token or API key found in query string.',
    category: 'Authentication & Session',
    owasp: 'A07:2021 – Identification and Authentication Failures',
    severity: 'high',
    check: (req) => /(token|apikey|auth|secret|password)=/i.test(req?.uri?.queryRaw || ''),
  },

  // === Data Exposure (A02) ===
  {
    id: 'leak-stacktrace',
    description: 'Stack trace or exception found in response body.',
    category: 'Data Exposure',
    owasp: 'A02:2021 – Cryptographic Failures',
    severity: 'high',
    check: (req) => {
      const body = decodeBody(req?.response?.bodyBase64);
      return /(ReferenceError|TypeError|Exception|Traceback|at\s+\w+\s+\()/i.test(body);
    },
  },
  {
    id: 'server-fingerprint',
    description: 'Server or framework version exposed via headers.',
    category: 'Data Exposure',
    owasp: 'A05:2021 – Security Misconfiguration',
    severity: 'low',
    check: (req) =>
      (req?.response?.headers || []).some(
        (h) =>
          ['server', 'x-powered-by'].includes(h.name?.toLowerCase()) &&
          /\d+\.\d+/.test(h.value || '')
      ),
  },

  // === Injection (A03) ===
  {
    id: 'sql-injection-pattern',
    description: 'Suspicious SQL keywords found in query parameters.',
    category: 'Injection',
    owasp: 'A03:2021 – Injection',
    severity: 'high',
    check: (req) =>
      /\b(select|union|drop|insert|delete|update|exec)\b/i.test(req?.uri?.queryRaw || ''),
  },
  {
    id: 'xss-payload-detected',
    description: 'Potential XSS payload found in parameters.',
    category: 'Injection',
    owasp: 'A03:2021 – Injection',
    severity: 'high',
    check: (req) => /(<script|onerror=|onload=|javascript:)/i.test(req?.uri?.queryRaw || ''),
  },
  {
    id: 'path-traversal',
    description: 'Potential path traversal attempt detected.',
    category: 'Injection',
    owasp: 'A03:2021 – Injection',
    severity: 'medium',
    check: (req) => /\.\.\//.test(req?.uri?.queryRaw || ''),
  },

  // === Access Control (A01) ===
  {
    id: 'open-redirect',
    description: 'Potential open redirect via redirect parameter.',
    category: 'Access Control',
    owasp: 'A01:2021 – Broken Access Control',
    severity: 'high',
    check: (req) => /\b(redirect|next|url)=https?:\/\//i.test(req?.uri?.queryRaw || ''),
  },
];

module.exports = { httpRules, decodeBody };
