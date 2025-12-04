// @ts-check

/** @typedef {import('../../_types/http/builders/types').HttpRequest} HttpRequest */
/** @typedef {import('../../_types/http/builders/types').SelectFilters} SelectFilters */
/** @typedef {import('../../_types/http/builders/types').HttpHeader} HttpHeader */

const { EX, G_HTTP } = require('../../constants');
const { sanitizeLimit, sanitizeOffset } = require('../../sparql/pagination');
const { escapeStr } = require('../../strings/escape');

/**
 * Parameters accepted by {@link buildSelectRequests}.
 *
 * @typedef {Object} SelectRequestsParams
 * @property {string[]} [ids] - Optional list of request IDs to restrict the results to.
 * @property {SelectFilters} [filters] - Optional filters to narrow results.
 * @property {number} [limit] - Maximum number of rows to return (sanitized).
 * @property {number} [offset] - Number of rows to skip (sanitized).
 */

/**
 * Build a SPARQL `SELECT` query that lists HTTP requests matching optional filters and pagination.
 *
 * The generated query returns **denormalized rows** joining request core fields, URI parts,
 * headers, query parameters, optional response, and optional connection. It projects the variables:
 *
 * - Request core: `?id` (alias of `?idVal`), `?httpVersion`, `?methodName`, `?bodyBase64`
 * - URI: `?uriFull`, `?scheme`, `?authority`, `?path`, `?fragment`, `?queryXml`
 * - Request headers: `?hdrName`, `?hdrValue`
 * - Query params: `?paramName`, `?paramValue`
 * - Response: `?resHttpVersion`, `?resBodyBase64`, `?statusCodeNumber`, `?reasonPhrase`, `?rhdrName`, `?rhdrValue`
 * - Connection: `?connAuthority`
 *
 * **Filtering**
 * - `ids`: restricts to a fixed set of request IDs via `VALUES`.
 * - `filters`: same semantics used across the library:
 *   - `method` (case-insensitive via uppercasing)
 *   - `scheme`, `authority`, `path` (exact match)
 *   - `text` (substring `CONTAINS` over full URI)
 *   - `headerName` (case-insensitive) and `headerValue` (exact)
 *
 * **Pagination**
 * - `limit` and `offset` are sanitized via `sanitizeLimit` / `sanitizeOffset`.
 *
 * @param {SelectRequestsParams} [params={}] - Builder parameters.
 * @returns {string} A SPARQL `SELECT` query ready to execute against the `<${G_HTTP}>` named graph.
 *
 * @example
 * // Paginated list of GET requests on https with a free-text match in the full URI
 * const q = buildSelectRequests({
 *   ids: [],
 *   filters: { method: 'GET', scheme: 'https', text: 'q=node' },
 *   limit: 25,
 *   offset: 0
 * });
 *
 * @example
 * // Limit to a specific set of request IDs
 * const q2 = buildSelectRequests({ ids: ['req-001', 'req-005', 'req-010'] });
 */
function buildSelectRequests({ ids = [], filters = {}, limit = 50, offset = 0 } = {}) {
  const { method, scheme, authority, path, headerName, headerValue, text } = filters || {};

  const idFilters =
    Array.isArray(ids) && ids.length
      ? `VALUES ?idVal { ${ids.map((id) => `"${escapeStr(id)}"`).join(' ')} }`
      : '';

  const whereFilters = [];
  if (method)
    whereFilters.push(
      `FILTER(ucase(str(?methodName)) = "${escapeStr(String(method).toUpperCase())}")`
    );
  if (scheme) whereFilters.push(`FILTER(str(?scheme) = "${escapeStr(scheme)}")`);
  if (authority) whereFilters.push(`FILTER(str(?authority) = "${escapeStr(authority)}")`);
  if (path) whereFilters.push(`FILTER(str(?path) = "${escapeStr(path)}")`);
  if (text) whereFilters.push(`FILTER(CONTAINS(str(?uriFull), "${escapeStr(text)}"))`);
  if (headerName)
    whereFilters.push(`FILTER(lcase(str(?hdrName)) = "${escapeStr(headerName.toLowerCase())}")`);
  if (headerValue) whereFilters.push(`FILTER(str(?hdrValue) = "${escapeStr(headerValue)}")`);

  const lim = sanitizeLimit(limit, 50);
  const off = sanitizeOffset(offset, 0);

  return `
PREFIX ex: <${EX}>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT
  (?idVal AS ?id) ?httpVersion ?methodName
  ?uriFull ?scheme ?authority ?path ?fragment ?queryXml
  ?bodyBase64
  ?hdrName ?hdrValue
  ?paramName ?paramValue
  # Response
  ?resHttpVersion ?resBodyBase64 ?statusCodeNumber ?reasonPhrase
  ?rhdrName ?rhdrValue
  # Connection
  ?connAuthority
WHERE {
  GRAPH <${G_HTTP}> {
    ?req a ex:Request ;
         ex:uriRequest ?uriRes ;
         ex:mthd ?methodInd .
    OPTIONAL { ?req ex:id ?idExplicit . }
    BIND(COALESCE(?idExplicit, STRAFTER(STR(?req), "urn:req:")) AS ?idVal)
    BIND(STRAFTER(STR(?methodInd), "#") AS ?methodName)

    OPTIONAL { ?req ex:httpVersion ?httpVersion . }
    OPTIONAL { ?req ex:body ?bodyBase64 . }

    ?uriRes a ex:URI .
    OPTIONAL { ?uriRes ex:uri       ?uriFull . }
    OPTIONAL { ?uriRes ex:scheme    ?scheme . }
    OPTIONAL { ?uriRes ex:authority ?authority . }
    OPTIONAL { ?uriRes ex:path      ?path . }
    OPTIONAL { ?uriRes ex:fragment  ?fragment . }
    OPTIONAL { ?uriRes ex:query     ?queryXml . }

    OPTIONAL {
      { ?req ex:reqHeader ?hdr . } UNION
      { ?req ex:repHeader ?hdr . } UNION
      { ?req ex:payHeader ?hdr . }
      ?hdr ex:fieldName ?hdrName . 
      OPTIONAL { ?hdr ex:fieldValue ?hdrValue . }
    }

    OPTIONAL {
      ?uriRes ex:param ?param .
      ?param a ex:Parameter ;
             ex:nameParameter ?paramName .
      OPTIONAL { ?param ex:valueParameter ?paramValue . }
    }

    # Connection via seeAlso or deterministic fallback
    OPTIONAL {
      ?req rdfs:seeAlso ?conn .
      ?conn a ex:Connection . 
      OPTIONAL { ?conn ex:connectionAuthority ?connAuthority . }
    }
    OPTIONAL {
      BIND(IRI(CONCAT("urn:req:", ENCODE_FOR_URI(?idVal), ":conn")) AS ?conn2)
      ?conn2 a ex:Connection . 
      OPTIONAL { ?conn2 ex:connectionAuthority ?connAuthority . }
    }

    # Response (optional)
    OPTIONAL {
      ?req ex:resp ?res .
      ?res a ex:Response .
      OPTIONAL { ?res ex:httpVersion ?resHttpVersion . }
      OPTIONAL { ?res ex:body ?resBodyBase64 . }
      OPTIONAL {
        ?res ex:sc ?scNode .
        OPTIONAL { ?scNode ex:statusCodeNumber ?statusCodeNumber . }
        OPTIONAL { ?scNode ex:reasonPhrase ?reasonPhrase . }
      }
      OPTIONAL {
        { ?res ex:resHeader ?rhdr . } UNION
        { ?res ex:repHeader ?rhdr . } UNION
        { ?res ex:payHeader ?rhdr . }
        ?rhdr ex:fieldName ?rhdrName . 
        OPTIONAL { ?rhdr ex:fieldValue ?rhdrValue . }
      }
    }

    ${idFilters}
    ${whereFilters.join('\n    ')}
  }
}
LIMIT ${lim}
OFFSET ${off}`.trim();
}

module.exports = buildSelectRequests;
