/**
 * HTTP Security Rules (v2.0 – ontology-aware)
 * Basate su OWASP Top 10 2021
 *
 * Nota importante:
 *   - Ogni regola NON ritorna più solo boolean, ma:
 *       - false / null / undefined -> nessun match
 *       - object -> match, con campo "evidence" specifico
 *
 *   - La struttura di base dell'evidence è:
 *       {
 *         kind: 'header' | 'cookie' | 'param' | 'body' | 'transport',
 *         headers?: [{ where:'request'|'response', index, name, value }],
 *         cookies?: [{
 *           where:'request'|'response',
 *           headerIndex,
 *           cookieIndex,
 *           name,
 *           value,
 *           attributes: { secure, httpOnly, sameSite, domain, path },
 *           missingFlags?: string[]
 *         }],
 *         params?: [{ index, name, value }],
 *         rawQuery?: string,
 *         insecureResources?: string[], // per mixed-content
 *         pattern?: string,             // per leak-stacktrace ecc.
 *         snippet?: string              // snippet corpo risposta
 *       }
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

/**
 * Parsifica il valore di un header Set-Cookie (che può contenere più cookie
 * separati da newline) in una lista strutturata.
 *
 * @param {string} raw
 * @returns {Array<{
 *   name: string,
 *   value: string,
 *   attributes: {
 *     secure: boolean,
 *     httpOnly: boolean,
 *     sameSite: string | null,
 *     domain: string | null,
 *     path: string | null,
 *   },
 *   raw: string
 * }>}
 */
function parseSetCookieHeader(raw) {
  if (!raw) return [];
  const cookies = [];
  const lines = String(raw).split(/\r?\n/);

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line) continue;

    const parts = line.split(';');
    if (!parts.length) continue;

    const [nameValue, ...attrParts] = parts;
    const [nameRaw, ...rest] = nameValue.split('=');
    const cookieName = (nameRaw || '').trim();
    const cookieValue = rest.join('=').trim();

    const attrs = {
      secure: false,
      httpOnly: false,
      sameSite: null,
      domain: null,
      path: null,
    };

    for (const attrRaw of attrParts) {
      const attr = attrRaw.trim();
      if (!attr) continue;
      const [kRaw, ...vRest] = attr.split('=');
      const key = (kRaw || '').toLowerCase();
      const v = vRest.join('=').trim();

      if (key === 'secure') {
        attrs.secure = true;
      } else if (key === 'httponly') {
        attrs.httpOnly = true;
      } else if (key === 'samesite') {
        attrs.sameSite = v || null;
      } else if (key === 'domain') {
        attrs.domain = v || null;
      } else if (key === 'path') {
        attrs.path = v || null;
      }
    }

    cookies.push({
      name: cookieName,
      value: cookieValue,
      attributes: attrs,
      raw: line,
    });
  }

  return cookies;
}

// Regex di supporto condivise
const TOKEN_NAME_RE = /(token|apikey|auth|secret|password)/i;
const SQLI_RE = /\b(select|union|drop|insert|delete|update|exec)\b/i;
const XSS_RE = /(<script|onerror=|onload=|javascript:)/i;
const PATH_TRAVERSAL_RE = /\.\.\//;
const OPEN_REDIRECT_RE = /\b(redirect|next|url)=https?:\/\//i;

const httpRules = [
  // === Transport & Configuration (A05) ===
  {
    id: 'insecure-http',
    description: 'Request sent over HTTP instead of HTTPS.',
    category: 'Transport Security',
    owasp: 'A05:2021 – Security Misconfiguration',
    severity: 'high',
    check: (req) => {
      const url = req?.uri?.full || '';
      if (!url.startsWith('http://')) return false;

      return {
        kind: 'transport',
        scheme: 'http',
        uri: {
          full: url,
          scheme: req?.uri?.scheme || 'http',
        },
      };
    },
  },
  {
    id: 'cors-misconfig',
    description: 'CORS policy too permissive (Access-Control-Allow-Origin: *).',
    category: 'Transport Security',
    owasp: 'A05:2021 – Security Misconfiguration',
    severity: 'medium',
    check: (req) => {
      const headers = Array.isArray(req?.response?.headers)
        ? req.response.headers
        : [];

      const hits = [];
      headers.forEach((h, index) => {
        if (
          String(h?.name || '').toLowerCase() === 'access-control-allow-origin' &&
          String(h?.value || '').trim() === '*'
        ) {
          hits.push({
            where: 'response',
            index,
            name: h.name,
            value: h.value,
          });
        }
      });

      if (!hits.length) return false;

      return {
        kind: 'header',
        headers: hits,
      };
    },
  },
  {
    id: 'mixed-content',
    description: 'HTTPS page loads insecure HTTP subresource.',
    category: 'Transport Security',
    owasp: 'A05:2021 – Security Misconfiguration',
    severity: 'medium',
    check: (req) => {
      const origin = req?.uri?.full || '';
      if (!origin.startsWith('https://')) return false;

      const body = decodeBody(req?.response?.bodyBase64);
      if (!body) return false;

      const regex = /http:\/\/[^"']+\.(js|css|png|jpg|gif)/gi;
      const insecureResources = [];
      let m;
      while ((m = regex.exec(body)) !== null && insecureResources.length < 10) {
        insecureResources.push(m[0]);
      }

      if (!insecureResources.length) return false;

      return {
        kind: 'body',
        location: 'responseBody',
        insecureResources,
      };
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
      const headers = Array.isArray(req?.response?.headers)
        ? req.response.headers
        : [];

      const offenders = [];

      headers.forEach((h, headerIndex) => {
        if (String(h?.name || '').toLowerCase() !== 'set-cookie') return;

        const parsed = parseSetCookieHeader(h.value || '');
        parsed.forEach((c, cookieIndex) => {
          const missingFlags = [];
          if (!c.attributes.secure) missingFlags.push('Secure');
          if (!c.attributes.httpOnly) missingFlags.push('HttpOnly');

          if (missingFlags.length > 0) {
            offenders.push({
              where: 'response',
              headerIndex,
              headerName: h.name,
              cookieIndex,
              name: c.name,
              value: c.value,
              attributes: c.attributes,
              missingFlags,
              raw: c.raw,
            });
          }
        });
      });

      if (!offenders.length) return false;

      return {
        kind: 'cookie',
        cookies: offenders,
      };
    },
  },
  {
    id: 'missing-samesite',
    description: 'Cookie missing SameSite attribute.',
    category: 'Authentication & Session',
    owasp: 'A07:2021 – Identification and Authentication Failures',
    severity: 'low',
    check: (req) => {
      const headers = Array.isArray(req?.response?.headers)
        ? req.response.headers
        : [];

      const offenders = [];

      headers.forEach((h, headerIndex) => {
        if (String(h?.name || '').toLowerCase() !== 'set-cookie') return;

        const parsed = parseSetCookieHeader(h.value || '');
        parsed.forEach((c, cookieIndex) => {
          if (!c.attributes.sameSite) {
            offenders.push({
              where: 'response',
              headerIndex,
              headerName: h.name,
              cookieIndex,
              name: c.name,
              value: c.value,
              attributes: c.attributes,
              raw: c.raw,
            });
          }
        });
      });

      if (!offenders.length) return false;

      return {
        kind: 'cookie',
        cookies: offenders,
      };
    },
  },
  {
    id: 'token-in-url',
    description: 'Sensitive token or API key found in query string.',
    category: 'Authentication & Session',
    owasp: 'A07:2021 – Identification and Authentication Failures',
    severity: 'high',
    check: (req) => {
      const uri = req?.uri || {};
      const params = Array.isArray(uri.params) ? uri.params : [];
      const suspects = [];

      params.forEach((p, index) => {
        const name = String(p?.name || '');
        const value = p?.value != null ? String(p.value) : '';
        if (TOKEN_NAME_RE.test(name)) {
          suspects.push({ index, name, value });
        }
      });

      if (suspects.length) {
        return {
          kind: 'param',
          params: suspects,
        };
      }

      const raw = uri.queryRaw || '';
      if (/(token|apikey|auth|secret|password)=/i.test(raw)) {
        return {
          kind: 'param',
          rawQuery: raw,
        };
      }

      return false;
    },
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
      if (!body) return false;

      const regex =
        /(ReferenceError|TypeError|Exception|Traceback|at\s+\w+\s+\()/i;
      const match = body.match(regex);
      if (!match) return false;

      const idx = match.index || 0;
      const snippet = body.substring(Math.max(0, idx - 80), idx + 80);

      return {
        kind: 'body',
        location: 'responseBody',
        pattern: match[0],
        snippet,
      };
    },
  },
  {
    id: 'server-fingerprint',
    description: 'Server or framework version exposed via headers.',
    category: 'Data Exposure',
    owasp: 'A05:2021 – Security Misconfiguration',
    severity: 'low',
    check: (req) => {
      const headers = Array.isArray(req?.response?.headers)
        ? req.response.headers
        : [];
      const hits = [];

      headers.forEach((h, index) => {
        const name = String(h?.name || '').toLowerCase();
        const value = String(h?.value || '');

        if (
          ['server', 'x-powered-by'].includes(name) &&
          /\d+\.\d+/.test(value)
        ) {
          hits.push({
            where: 'response',
            index,
            name: h.name,
            value: h.value,
          });
        }
      });

      if (!hits.length) return false;

      return {
        kind: 'header',
        headers: hits,
      };
    },
  },

  // === Injection (A03) ===
  {
    id: 'sql-injection-pattern',
    description: 'Suspicious SQL keywords found in query parameters.',
    category: 'Injection',
    owasp: 'A03:2021 – Injection',
    severity: 'high',
    check: (req) => {
      const uri = req?.uri || {};
      const params = Array.isArray(uri.params) ? uri.params : [];
      const suspects = [];

      params.forEach((p, index) => {
        const name = String(p?.name || '');
        const value = p?.value != null ? String(p.value) : '';
        if (SQLI_RE.test(name) || SQLI_RE.test(value)) {
          suspects.push({ index, name, value });
        }
      });

      if (suspects.length) {
        return {
          kind: 'param',
          params: suspects,
          pattern: SQLI_RE.source,
        };
      }

      const raw = uri.queryRaw || '';
      if (SQLI_RE.test(raw)) {
        return {
          kind: 'param',
          rawQuery: raw,
          pattern: SQLI_RE.source,
        };
      }

      return false;
    },
  },
  {
    id: 'xss-payload-detected',
    description: 'Potential XSS payload found in parameters.',
    category: 'Injection',
    owasp: 'A03:2021 – Injection',
    severity: 'high',
    check: (req) => {
      const uri = req?.uri || {};
      const params = Array.isArray(uri.params) ? uri.params : [];
      const suspects = [];

      params.forEach((p, index) => {
        const name = String(p?.name || '');
        const value = p?.value != null ? String(p.value) : '';
        if (XSS_RE.test(name) || XSS_RE.test(value)) {
          suspects.push({ index, name, value });
        }
      });

      if (suspects.length) {
        return {
          kind: 'param',
          params: suspects,
          pattern: XSS_RE.source,
        };
      }

      const raw = uri.queryRaw || '';
      if (XSS_RE.test(raw)) {
        return {
          kind: 'param',
          rawQuery: raw,
          pattern: XSS_RE.source,
        };
      }

      return false;
    },
  },
  {
    id: 'path-traversal',
    description: 'Potential path traversal attempt detected.',
    category: 'Injection',
    owasp: 'A03:2021 – Injection',
    severity: 'medium',
    check: (req) => {
      const uri = req?.uri || {};
      const params = Array.isArray(uri.params) ? uri.params : [];
      const suspects = [];

      params.forEach((p, index) => {
        const name = String(p?.name || '');
        const value = p?.value != null ? String(p.value) : '';
        if (PATH_TRAVERSAL_RE.test(name) || PATH_TRAVERSAL_RE.test(value)) {
          suspects.push({ index, name, value });
        }
      });

      const path = String(uri.path || '');
      const hasInPath = PATH_TRAVERSAL_RE.test(path);

      if (suspects.length || hasInPath) {
        return {
          kind: 'param',
          params: suspects,
          path: hasInPath ? path : undefined,
          pattern: PATH_TRAVERSAL_RE.source,
        };
      }

      const raw = uri.queryRaw || '';
      if (PATH_TRAVERSAL_RE.test(raw)) {
        return {
          kind: 'param',
          rawQuery: raw,
          pattern: PATH_TRAVERSAL_RE.source,
        };
      }

      return false;
    },
  },

  // === Access Control (A01) ===
  {
    id: 'open-redirect',
    description: 'Potential open redirect via redirect parameter.',
    category: 'Access Control',
    owasp: 'A01:2021 – Broken Access Control',
    severity: 'high',
    check: (req) => {
      const uri = req?.uri || {};
      const params = Array.isArray(uri.params) ? uri.params : [];
      const suspects = [];

      params.forEach((p, index) => {
        const name = String(p?.name || '').toLowerCase();
        const value = p?.value != null ? String(p.value) : '';
        if (
          ['redirect', 'next', 'url'].includes(name) &&
          /^https?:\/\//i.test(value)
        ) {
          suspects.push({ index, name: p.name, value });
        }
      });

      if (suspects.length) {
        return {
          kind: 'param',
          params: suspects,
          pattern: 'redirect|next|url=http/https',
        };
      }

      const raw = uri.queryRaw || '';
      if (OPEN_REDIRECT_RE.test(raw)) {
        return {
          kind: 'param',
          rawQuery: raw,
          pattern: OPEN_REDIRECT_RE.source,
        };
      }

      return false;
    },
  },
];

module.exports = { httpRules, decodeBody };
