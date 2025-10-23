// @ts-check

/** @typedef {import('../../_types/http/builders/types').HttpRequest} HttpRequest */
/** @typedef {import('../../_types/http/builders/types').SelectFilters} SelectFilters */
/** @typedef {import('../../_types/http/builders/types').HttpHeader} HttpHeader */
const { EX, G_HTTP } = require('../../constants');
const { escapeStringLiteral, escapeStr } = require('../../strings/escape');

/**
 * Build a SPARQL `SELECT (COUNT DISTINCT ?req)` query for HTTP requests matching the given filters.
 *
 * The query:
 * - Targets the named graph `<${G_HTTP}>`.
 * - Counts distinct `ex:Request` resources as `?total`.
 * - Extracts `?methodName` from the method IRI (local name after '#').
 * - Supports optional URI fields (`ex:uri`, `ex:scheme`, `ex:authority`, `ex:path`).
 * - Supports matching request/representation/payload headers.
 *
 * **Supported filters** (all optional):
 * - `method` (string): exact match on uppercased method name (e.g., "GET", "POST").
 * - `scheme` (string): exact match on URI scheme (e.g., "https").
 * - `authority` (string): exact match on authority/host (e.g., "api.example.com").
 * - `path` (string): exact match on path (e.g., "/v1/search").
 * - `headerName` (string): case-insensitive match on header name.
 * - `headerValue` (string): exact match on header value.
 * - `text` (string): substring `CONTAINS` match on the full URI.
 *
 * **Case sensitivity semantics**
 * - `method` is compared with `UCASE(...)`, so `"get"` or `"GET"` behave the same, but must equal exactly after uppercasing.
 * - `headerName` is compared with `LCASE(...)`, i.e., case-insensitive.
 * - `text`, `scheme`, `authority`, `path`, `headerValue` are compared case-sensitively as raw strings.
 *
 * **Escaping**
 * All string filters are escaped via `escapeStr` to keep the SPARQL string literal safe.
 *
 * @param {{filters?: {
 *   method?: string, scheme?: string, authority?: string, path?: string,
 *   headerName?: string, headerValue?: string, text?: string
 * }}} [params]
 * @returns {string}
 *
 * @example
 * // Count all GET requests to https host with header 'accept: application/json'
 * const query = buildCountRequests({
 *   filters: {
 *     method: 'GET',
 *     scheme: 'https',
 *     headerName: 'Accept',
 *     headerValue: 'application/json'
 *   }
 * });
 *
 * // Execute with your GraphDB client:
 * // const res = await graphdb.runSelect(query);
 * // if ('results' in res) {
 * //   const total = Number(res.results.bindings[0]?.total?.value ?? 0);
 * //   console.log('Total matching requests:', total);
 * // }
 *
 * @example
 * // Free-text search on the full URI (CONTAINS)
 * const q2 = buildCountRequests({ filters: { text: 'q=node' } });
 */
function buildCountRequests({ filters = {} } = {}) {
  const { method, scheme, authority, path, headerName, headerValue, text } = filters || {};
  const whereFilters = [];
  if (method)     whereFilters.push(`FILTER(ucase(str(?methodName)) = "${escapeStr(String(method).toUpperCase())}")`);
  if (scheme)     whereFilters.push(`FILTER(str(?scheme) = "${escapeStr(scheme)}")`);
  if (authority)  whereFilters.push(`FILTER(str(?authority) = "${escapeStr(authority)}")`);
  if (path)       whereFilters.push(`FILTER(str(?path) = "${escapeStr(path)}")`);
  if (text)       whereFilters.push(`FILTER(CONTAINS(str(?uriFull), "${escapeStr(text)}"))`);
  if (headerName) whereFilters.push(`FILTER(lcase(str(?hdrName)) = "${escapeStr(headerName.toLowerCase())}")`);
  if (headerValue)whereFilters.push(`FILTER(str(?hdrValue) = "${escapeStr(headerValue)}")`);

  return `
PREFIX ex: <${EX}>
SELECT (COUNT(DISTINCT ?req) AS ?total)
WHERE {
  GRAPH <${G_HTTP}> {
    ?req a ex:Request ;
         ex:uriRequest ?uriRes ;
         ex:mthd ?methodInd .
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
}`.trim();
}

module.exports = buildCountRequests;