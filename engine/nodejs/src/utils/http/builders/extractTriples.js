// @ts-check

/** @typedef {import('../../_types/http/builders/types').HttpRequest} HttpRequest */
/** @typedef {import('../../_types/http/builders/types').SelectFilters} SelectFilters */
/** @typedef {import('../../_types/http/builders/types').HttpHeader} HttpHeader */
/** @typedef {import('../../_types/http/builders/types').BuilderRequestInput} BuilderRequestInput */
const { EX, CONTENT } = require('../../constants');
const { escapeStringLiteral } = require('../../strings/escape');
const { xmlLiteralFromQueryRaw, xmlLiteralFromParams, asXmlLiteral } = require('../../sparql/format');
const { classifyRequestHeader, classifyResponseHeader } = require('../headers');
const { iriRequest, iriURI, iriHeader, iriParam, iriResponse, iriResHeader, iriStatus, iriConnection } = require('../../iri/http');

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
 *     headers: [{ name: "Content-Type", value: "application/json" }]
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
    triples.push(`${reqIri} <${EX}httpVersion> "${escapeStringLiteral(p.httpVersion)}" .`);
  }
  if (p.bodyBase64) {
    triples.push(`${reqIri} <${EX}body> "${escapeStringLiteral(p.bodyBase64)}"^^<${CONTENT}ContentAsBase64> .`);
  }

  // Optional Connection
  if (p.connection && (p.connection.authority ?? '') !== '') {
    const connIri = `<${iriConnection(p.id)}>`;
    triples.push(
      `${connIri} a <${EX}Connection> .`,
      `${connIri} <${EX}connectionAuthority> "${escapeStringLiteral(String(p.connection.authority))}" .`,
      `${reqIri} <http://www.w3.org/2000/01/rdf-schema#seeAlso> ${connIri} .`
    );
  }

  // URI decomposition
  /** @type {Partial<NonNullable<BuilderRequestInput['uri']>>} */
  const u = p.uri || {};
  if (u.scheme)    triples.push(`${uriIri} <${EX}scheme> "${escapeStringLiteral(u.scheme)}" .`);
  if (u.authority) triples.push(`${uriIri} <${EX}authority> "${escapeStringLiteral(u.authority)}" .`);
  if (u.path)      triples.push(`${uriIri} <${EX}path> "${escapeStringLiteral(u.path)}" .`);
  if (u.fragment)  triples.push(`${uriIri} <${EX}fragment> "${escapeStringLiteral(u.fragment)}" .`);
  if (u.full)      triples.push(`${uriIri} <${EX}uri> "${escapeStringLiteral(u.full)}" .`);

  // Query representation (XMLLiteral)
  if (u.queryXml && String(u.queryXml).trim()) {
    triples.push(`${uriIri} <${EX}query> ${asXmlLiteral(String(u.queryXml))} .`);
  } else if (u.queryRaw && String(u.queryRaw).trim()) {
    triples.push(`${uriIri} <${EX}query> ${xmlLiteralFromQueryRaw(u.queryRaw)} .`);
  } else if (Array.isArray(u.params) && u.params.length > 0) {
    triples.push(`${uriIri} <${EX}query> ${xmlLiteralFromParams(u.params)} .`);
  }

  // Params
  const params = Array.isArray(u.params) ? u.params : [];
  params.forEach((prm, i) => {
    const paramIri = `<${iriParam(p.id, i)}>`;
    triples.push(
      `${paramIri} a <${EX}Parameter> .`,
      `${paramIri} <${EX}nameParameter> "${escapeStringLiteral(prm.name || '')}"^^<http://www.w3.org/2001/XMLSchema#string> .`
    );
    if (prm.value !== undefined && prm.value !== null) {
      triples.push(`${paramIri} <${EX}valueParameter> "${escapeStringLiteral(String(prm.value))}" .`);
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
      `${hdrIri} <${EX}fieldName> "${escapeStringLiteral(h?.name || '')}"^^<http://www.w3.org/2001/XMLSchema#string> .`
    );
    if (h?.value !== undefined && h?.value !== null) {
      triples.push(`${hdrIri} <${EX}fieldValue> "${escapeStringLiteral(String(h.value))}" .`);
    }
    triples.push(`${reqIri} <${EX}${prop}> ${hdrIri} .`);
  });

  // Optional response
  const r = p.response || null;
  if (r) {
    const resIri = `<${iriResponse(p.id)}>`;
    const scIri  = `<${iriStatus(p.id)}>`;
    triples.push(
      `${resIri} a <${EX}Response> .`,
      `${reqIri} <${EX}resp> ${resIri} .`
    );
    if (r.httpVersion) {
      triples.push(`${resIri} <${EX}httpVersion> "${escapeStringLiteral(r.httpVersion)}" .`);
    }
    if (r.bodyBase64) {
      triples.push(`${resIri} <${EX}body> "${escapeStringLiteral(r.bodyBase64)}"^^<${CONTENT}ContentAsBase64> .`);
    }
    if (typeof r.status === 'number' || r.reason) {
      triples.push(
        `${scIri} a <${EX}StatusCodes> .`,
        `${resIri} <${EX}sc> ${scIri} .`
      );
      if (typeof r.status === 'number') {
        triples.push(`${scIri} <${EX}statusCodeNumber> "${r.status}"^^<http://www.w3.org/2001/XMLSchema#int> .`);
      }
      if (r.reason) {
        triples.push(`${scIri} <${EX}reasonPhrase> "${escapeStringLiteral(r.reason)}" .`);
      }
    }
    const rHeaders = Array.isArray(r.headers) ? r.headers : [];
    rHeaders.forEach((h, i) => {
      const hdrIri = `<${iriResHeader(p.id, i)}>`;
      const { cls, prop } = classifyResponseHeader(h?.name || '');
      triples.push(
        `${hdrIri} a <${EX}${cls}> .`,
        `${hdrIri} <${EX}fieldName> "${escapeStringLiteral(h?.name || '')}"^^<http://www.w3.org/2001/XMLSchema#string> .`
      );
      if (h?.value !== undefined && h?.value !== null) {
        triples.push(`${hdrIri} <${EX}fieldValue> "${escapeStringLiteral(String(h.value))}" .`);
      }
      triples.push(`${resIri} <${EX}${prop}> ${hdrIri} .`);
    });
  }

  return triples;
}

module.exports = extractTriplesForSingleRequest;