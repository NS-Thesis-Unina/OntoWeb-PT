// @ts-check

/** @typedef {import('../../_types/http/builders/types').HttpRequest} HttpRequest */
/** @typedef {import('../../_types/http/builders/types').SelectFilters} SelectFilters */
/** @typedef {import('../../_types/http/builders/types').HttpHeader} HttpHeader */
const { EX, G_HTTP } = require('../../constants');
const { sanitizeLimit, sanitizeOffset } = require('../../sparql/pagination');
const { escapeStr } = require('../../strings/escape');

/**
 * Build a SPARQL `SELECT DISTINCT ?idVal` query that returns **only** request IDs
 * matching the provided filters, with optional ordering and pagination.
 *
 * The query:
 * - Targets the named graph `<${G_HTTP}>`.
 * - Resolves the ID as `COALESCE(?idExplicit, STRAFTER(STR(?req), "urn:req:")) AS ?idVal`.
 * - Extracts `?methodName` from the method IRI local name.
 * - Supports URI decomposition and header matching.
 *
 * **Supported filters** (all optional):
 * - `method` (string): exact match on uppercased method name (e.g., "GET", "POST").
 * - `scheme` (string): exact match of URI scheme (e.g., "https").
 * - `authority` (string): exact match of host/authority (e.g., "api.example.com").
 * - `path` (string): exact match of path (e.g., "/v1/search").
 * - `headerName` (string): case-insensitive match on header name.
 * - `headerValue` (string): exact match on header value.
 * - `text` (string): substring `CONTAINS` match on the full URI.
 *
 * **Ordering & pagination**
 * - `orderBy`: currently supports `"id"` (translates to `ORDER BY ?idVal`) or any other value (no ordering).
 * - `limit`, `offset`: sanitized via `sanitizeLimit` / `sanitizeOffset` with defaults (50 / 0).
 *
 * @param {object} [params={}] - Builder parameters.
 * @param {SelectFilters} [params.filters] - Filters to narrow the results.
 * @param {number} [params.limit=50] - Maximum number of IDs to return (sanitized).
 * @param {number} [params.offset=0] - Number of IDs to skip (sanitized).
 * @param {'id'|string} [params.orderBy='id'] - Ordering key; only `'id'` is recognized, anything else disables ORDER BY.
 * @returns {string} A SPARQL `SELECT DISTINCT ?idVal` query with optional `ORDER BY`, `LIMIT`, `OFFSET`.
 *
 * @example
 * // Basic usage with filters and pagination
 * const q = buildSelectRequestIds({
 *   filters: { method: 'GET', scheme: 'https', text: 'q=node' },
 *   limit: 25,
 *   offset: 0,
 *   orderBy: 'id'
 * });
 *
 * @example
 * // No ordering
 * const q2 = buildSelectRequestIds({ filters: { authority: 'api.example.com' }, orderBy: 'none' });
 */
function buildSelectRequestIds({ filters = {}, limit = 50, offset = 0, orderBy = 'id' } = {}) {
  const { method, scheme, authority, path, headerName, headerValue, text } = filters || {};
  const whereFilters = [];
  if (method)     whereFilters.push(`FILTER(ucase(str(?methodName)) = "${escapeStr(String(method).toUpperCase())}")`);
  if (scheme)     whereFilters.push(`FILTER(str(?scheme) = "${escapeStr(scheme)}")`);
  if (authority)  whereFilters.push(`FILTER(str(?authority) = "${escapeStr(authority)}")`);
  if (path)       whereFilters.push(`FILTER(str(?path) = "${escapeStr(path)}")`);
  if (text)       whereFilters.push(`FILTER(CONTAINS(str(?uriFull), "${escapeStr(text)}"))`);
  if (headerName) whereFilters.push(`FILTER(lcase(str(?hdrName)) = "${escapeStr(headerName.toLowerCase())}")`);
  if (headerValue)whereFilters.push(`FILTER(str(?hdrValue) = "${escapeStr(headerValue)}")`);

  const lim = sanitizeLimit(limit, 50);
  const off = sanitizeOffset(offset, 0);
  const order = (orderBy === 'id') ? 'ORDER BY ?idVal' : '';

  return `
PREFIX ex: <${EX}>
SELECT DISTINCT ?idVal
WHERE {
  GRAPH <${G_HTTP}> {
    ?req a ex:Request ;
         ex:uriRequest ?uriRes ;
         ex:mthd ?methodInd .
    OPTIONAL { ?req ex:id ?idExplicit . }
    BIND(COALESCE(?idExplicit, STRAFTER(STR(?req), "urn:req:")) AS ?idVal)
    BIND(STRAFTER(STR(?methodInd), "#") AS ?methodName)

    ?uriRes a ex:URI .
    OPTIONAL { ?uriRes ex:uri       ?uriFull . }
    OPTIONAL { ?uriRes ex:scheme    ?scheme . }
    OPTIONAL { ?uriRes ex:authority ?authority . }
    OPTIONAL { ?uriRes ex:path      ?path . }

    OPTIONAL {
      { ?req ex:reqHeader ?hdr . } UNION
      { ?req ex:repHeader ?hdr . } UNION
      { ?req ex:payHeader ?hdr . }
      ?hdr ex:fieldName ?hdrName .
      OPTIONAL { ?hdr ex:fieldValue ?hdrValue . }
    }

    ${whereFilters.join('\n    ')}
  }
}
${order}
LIMIT ${lim}
OFFSET ${off}`.trim();
}

module.exports = buildSelectRequestIds;