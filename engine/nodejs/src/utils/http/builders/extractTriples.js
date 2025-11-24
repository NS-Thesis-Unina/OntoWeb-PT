// @ts-check

/** @typedef {import('../../_types/http/builders/types').HttpRequest} HttpRequest */
/** @typedef {import('../../_types/http/builders/types').SelectFilters} SelectFilters */
/** @typedef {import('../../_types/http/builders/types').HttpHeader} HttpHeader */
/** @typedef {import('../../_types/http/builders/types').BuilderRequestInput} BuilderRequestInput */

const { EX, CONTENT } = require('../../constants');
const { escapeStringLiteral } = require('../../strings/escape');
const {
  xmlLiteralFromQueryRaw,
  xmlLiteralFromParams,
  asXmlLiteral,
} = require('../../sparql/format');
const {
  classifyRequestHeader,
  classifyResponseHeader,
} = require('../headers');
const {
  iriRequest,
  iriURI,
  iriHeader,
  iriParam,
  iriResponse,
  iriResHeader,
  iriStatus,
  iriConnection,
} = require('../../iri/http');

/**
 * Internal helper: expand **Set-Cookie** response headers that contain multiple
 * cookies separated by newlines into one header per cookie.
 *
 * Many HTTP capture stacks aggregate multiple `Set-Cookie` lines into a single
 * header entry whose `value` contains `\n`-separated cookies:
 *
 *   Set-Cookie: cookieA=...; Domain=...
 *   Set-Cookie: cookieB=...; Domain=...
 *
 * becomes:
 *
 *   { name: "set-cookie", value: "cookieA=...; Domain=...\ncookieB=...; Domain=..." }
 *
 * This helper turns that into:
 *
 *   [
 *     { name: "set-cookie", value: "cookieA=...; Domain=..." },
 *     { name: "set-cookie", value: "cookieB=...; Domain=..." },
 *   ]
 *
 * so that each cookie is modeled as an independent `Set-Cookie` header resource
 * in RDF.
 *
 * @param {Array<Partial<HttpHeader>>} headers Raw response headers.
 * @returns {Array<Partial<HttpHeader>>} Expanded headers where multi-line
 *          `Set-Cookie` values have been split into separate entries.
 */
function expandSetCookieHeaders(headers) {
  /** @type {Array<Partial<HttpHeader>>} */
  const out = [];

  for (const h of Array.isArray(headers) ? headers : []) {
    if (!h || typeof h.name !== 'string') continue;

    const name = String(h.name);
    const lower = name.toLowerCase();

    // Only special-case Set-Cookie; everything else is passed through.
    if (lower === 'set-cookie' && typeof h.value === 'string') {
      const raw = String(h.value);

      // Split on CRLF or LF, trim each line, and keep only non-empty entries.
      const lines = raw.split(/\r?\n/);
      for (const line of lines) {
        const v = line.trim();
        if (!v) continue;
        out.push({ name, value: v });
      }
    } else {
      out.push(h);
    }
  }

  return out;
}

/**
 * Internal helper: when dealing with a `Set-Cookie` header value, attempt to
 * extract the cookie **name** and **domain** according to the common pattern:
 *
 *   cookieName=cookieValue; Domain=.example.com; Expires=...; Path=/; Secure
 *
 * This is not a full RFC6265 parser; it only:
 * - Uses the first `name=value` pair for `cookieName`.
 * - Looks for an attribute starting with `Domain=` for `cookieDomain`.
 *
 * If extraction fails, no triples are emitted and the plain `fieldValue`
 * remains the canonical representation.
 *
 * @param {string} rawValue The raw `Set-Cookie` header value for a single cookie.
 * @returns {{ cookieName?: string; cookieDomain?: string }} Parsed attributes (optional).
 */
function parseSetCookieAttributes(rawValue) {
  const result = {};

  const str = String(rawValue);
  const parts = str.split(';');

  // First part: "cookieName=cookieValue"
  if (parts.length > 0) {
    const first = parts[0].trim();
    const eqIndex = first.indexOf('=');
    if (eqIndex > 0) {
      result.cookieName = first.slice(0, eqIndex).trim();
    }
  }

  // Look for Domain=...
  for (const p of parts.slice(1)) {
    const seg = p.trim();
    if (!seg.toLowerCase().startsWith('domain=')) continue;
    const domain = seg.slice('domain='.length).trim();
    if (domain) {
      result.cookieDomain = domain;
      break;
    }
  }

  return result;
}

/**
 * Extract RDF triple fragments (as Turtle/N-Triples lines) for a single HTTP request.
 *
 * This builder:
 * - Emits core identification and typing triples for the request and its URI node.
 * - Emits optional request-level fields: `httpVersion`, `bodyBase64`.
 * - Emits a `Connection` node when `connection.authority` is present (linked via `rdfs:seeAlso`).
 * - Decomposes `uri` into `scheme`, `authority`, `path`, `fragment`, `full`.
 * - Serializes the query component (`ex:query`) as an `rdf:XMLLiteral` using, in order of precedence:
 *   `uri.queryXml` → `uri.queryRaw` → `uri.params`.
 * - Emits each query parameter as a separate `ex:Parameter` resource linked by `ex:param`.
 * - Classifies and emits request headers via `classifyRequestHeader` and links them with the appropriate property.
 * - Optionally emits a `Response` node with status, reason, httpVersion, bodyBase64 and classified response headers.
 * - For **Set-Cookie** response headers, splits multi-line values into distinct header resources
 *   (one per cookie) and, when possible, enriches them with `ex:cookieName` and `ex:cookieDomain`.
 *
 * **Required fields**
 * - `p.id`, `p.method`, `p.uri.full`
 *
 * **Escaping**
 * - String literal values are escaped using `escapeStringLiteral`, while XML payloads are wrapped with
 *   `asXmlLiteral` / `xmlLiteralFromQueryRaw` / `xmlLiteralFromParams`.
 *
 * @param {Partial<BuilderRequestInput>} [p={}] Normalized HTTP request input used to generate RDF triples. It can be partial, the function validates required fields.
 * @returns {string[]} Array of RDF triples as strings (each string represents one triple statement ending with `.`).
 * @throws {Error} If required fields are missing (`id`, `method`, or `uri.full`).
 *
 * @example
 * const triples = extractTriplesForSingleRequest({
 *   id: "req-001",
 *   method: "GET",
 *   httpVersion: "HTTP/1.1",
 *   uri: {
 *     full: "https://api.example.com/v1/search?q=node",
 *     scheme: "https",
 *     authority: "api.example.com",
 *     path: "/v1/search",
 *     params: [{ name: "q", value: "node" }]
 *   },
 *   requestHeaders: [
 *     { name: "Accept", value: "application/json" }
 *   ],
 *   connection: { authority: "proxy.local" },
 *   response: {
 *     status: 200,
 *     reason: "OK",
 *     httpVersion: "HTTP/1.1",
 *     headers: [
 *       { name: "Content-Type", value: "application/json" },
 *       { name: "Set-Cookie", value: "session-id=...; Domain=.example.com; Path=/; Secure\nubid=...; Domain=.example.com; Path=/; Secure" }
 *     ]
 *   }
 * });
 * // triples is a string[] with all statements ready to be inserted.
 */
function extractTriplesForSingleRequest(p = {}) {
  if (!p.id || !p.method || !p.uri || !p.uri.full) {
    throw new Error('Missing id/method/uri.full');
  }

  const reqIri = `<${iriRequest(p.id)}>`;
  const uriIri = `<${iriURI(p.id)}>`;
  const methodName = String(p.method || '').toUpperCase();
  const methodInd = `<${EX}${methodName}>`;

  /** @type {string[]} */
  const triples = [];

  // Core types and identity
  triples.push(
    `${reqIri} a <${EX}Request> .`,
    `${uriIri} a <${EX}URI> .`,
    `${reqIri} <${EX}id> "${escapeStringLiteral(p.id)}" .`,
    `${reqIri} <${EX}uriRequest> ${uriIri} .`,
    `${reqIri} <${EX}mthd> ${methodInd} .`
  );

  // Optional request-level fields
  if (p.httpVersion) {
    triples.push(
      `${reqIri} <${EX}httpVersion> "${escapeStringLiteral(p.httpVersion)}" .`
    );
  }
  if (p.bodyBase64) {
    triples.push(
      `${reqIri} <${EX}body> "${escapeStringLiteral(
        p.bodyBase64
      )}"^^<${CONTENT}ContentAsBase64> .`
    );
  }

  // Optional Connection
  if (p.connection && (p.connection.authority ?? '') !== '') {
    const connIri = `<${iriConnection(p.id)}>`;
    triples.push(
      `${connIri} a <${EX}Connection> .`,
      `${connIri} <${EX}connectionAuthority> "${escapeStringLiteral(
        String(p.connection.authority)
      )}" .`,
      `${reqIri} <http://www.w3.org/2000/01/rdf-schema#seeAlso> ${connIri} .`
    );
  }

  // URI decomposition
  /** @type {Partial<NonNullable<BuilderRequestInput['uri']>>} */
  const u = p.uri || {};
  if (u.scheme) {
    triples.push(
      `${uriIri} <${EX}scheme> "${escapeStringLiteral(u.scheme)}" .`
    );
  }
  if (u.authority) {
    triples.push(
      `${uriIri} <${EX}authority> "${escapeStringLiteral(u.authority)}" .`
    );
  }
  if (u.path) {
    triples.push(
      `${uriIri} <${EX}path> "${escapeStringLiteral(u.path)}" .`
    );
  }
  if (u.fragment) {
    triples.push(
      `${uriIri} <${EX}fragment> "${escapeStringLiteral(u.fragment)}" .`
    );
  }
  if (u.full) {
    triples.push(
      `${uriIri} <${EX}uri> "${escapeStringLiteral(u.full)}" .`
    );
  }

  // Query representation (XMLLiteral)
  if (u.queryXml && String(u.queryXml).trim()) {
    triples.push(
      `${uriIri} <${EX}query> ${asXmlLiteral(String(u.queryXml))} .`
    );
  } else if (u.queryRaw && String(u.queryRaw).trim()) {
    triples.push(
      `${uriIri} <${EX}query> ${xmlLiteralFromQueryRaw(u.queryRaw)} .`
    );
  } else if (Array.isArray(u.params) && u.params.length > 0) {
    triples.push(
      `${uriIri} <${EX}query> ${xmlLiteralFromParams(u.params)} .`
    );
  }

  // Params
  const params = Array.isArray(u.params) ? u.params : [];
  params.forEach((prm, i) => {
    const paramIri = `<${iriParam(p.id, i)}>`;
    triples.push(
      `${paramIri} a <${EX}Parameter> .`,
      `${paramIri} <${EX}nameParameter> "${escapeStringLiteral(
        prm.name || ''
      )}"^^<http://www.w3.org/2001/XMLSchema#string> .`
    );
    if (prm.value !== undefined && prm.value !== null) {
      triples.push(
        `${paramIri} <${EX}valueParameter> "${escapeStringLiteral(
          String(prm.value)
        )}" .`
      );
    }
    triples.push(`${uriIri} <${EX}param> ${paramIri} .`);
  });

  // Request headers
  const headers = Array.isArray(p.requestHeaders) ? p.requestHeaders : [];
  headers.forEach((h, i) => {
    const hdrIri = `<${iriHeader(p.id, i)}>`;
    const { cls, prop } = classifyRequestHeader(h?.name || '');
    triples.push(
      `${hdrIri} a <${EX}${cls}> .`,
      `${hdrIri} <${EX}fieldName> "${escapeStringLiteral(
        h?.name || ''
      )}"^^<http://www.w3.org/2001/XMLSchema#string> .`
    );
    if (h?.value !== undefined && h?.value !== null) {
      triples.push(
        `${hdrIri} <${EX}fieldValue> "${escapeStringLiteral(
          String(h.value)
        )}" .`
      );
    }
    triples.push(`${reqIri} <${EX}${prop}> ${hdrIri} .`);
  });

  // Optional response
  const r = p.response || null;
  if (r) {
    const resIri = `<${iriResponse(p.id)}>`;
    const scIri = `<${iriStatus(p.id)}>`;
    triples.push(
      `${resIri} a <${EX}Response> .`,
      `${reqIri} <${EX}resp> ${resIri} .`
    );
    if (r.httpVersion) {
      triples.push(
        `${resIri} <${EX}httpVersion> "${escapeStringLiteral(
          r.httpVersion
        )}" .`
      );
    }
    if (r.bodyBase64) {
      triples.push(
        `${resIri} <${EX}body> "${escapeStringLiteral(
          r.bodyBase64
        )}"^^<${CONTENT}ContentAsBase64> .`
      );
    }
    if (typeof r.status === 'number' || r.reason) {
      triples.push(
        `${scIri} a <${EX}StatusCodes> .`,
        `${resIri} <${EX}sc> ${scIri} .`
      );
      if (typeof r.status === 'number') {
        triples.push(
          `${scIri} <${EX}statusCodeNumber> "${r.status}"^^<http://www.w3.org/2001/XMLSchema#int> .`
        );
      }
      if (r.reason) {
        triples.push(
          `${scIri} <${EX}reasonPhrase> "${escapeStringLiteral(
            r.reason
          )}" .`
        );
      }
    }

    // Response headers (with Set-Cookie expansion)
    const expandedHeaders = expandSetCookieHeaders(r.headers || []);
    expandedHeaders.forEach((h, i) => {
      const hdrIri = `<${iriResHeader(p.id, i)}>`;
      const { cls, prop } = classifyResponseHeader(h?.name || '');

      triples.push(
        `${hdrIri} a <${EX}${cls}> .`,
        `${hdrIri} <${EX}fieldName> "${escapeStringLiteral(
          h?.name || ''
        )}"^^<http://www.w3.org/2001/XMLSchema#string> .`
      );

      if (h?.value !== undefined && h?.value !== null) {
        const rawValue = String(h.value);
        triples.push(
          `${hdrIri} <${EX}fieldValue> "${escapeStringLiteral(
            rawValue
          )}" .`
        );

        // Optional enrichment for Set-Cookie: extract cookieName / cookieDomain
        if (String(h?.name || '').toLowerCase() === 'set-cookie') {
          const { cookieName, cookieDomain } = parseSetCookieAttributes(rawValue);
          if (cookieName) {
            triples.push(
              `${hdrIri} <${EX}cookieName> "${escapeStringLiteral(
                cookieName
              )}" .`
            );
          }
          if (cookieDomain) {
            triples.push(
              `${hdrIri} <${EX}cookieDomain> "${escapeStringLiteral(
                cookieDomain
              )}" .`
            );
          }
        }
      }

      triples.push(`${resIri} <${EX}${prop}> ${hdrIri} .`);
    });
  }

  return triples;
}

module.exports = extractTriplesForSingleRequest;
