// @ts-check

/** @typedef {import('../../_types/http/builders/types').SelectFilters} SelectFilters */
const { EX, G_HTTP } = require('../../constants');
const { sanitizeLimit, sanitizeOffset } = require('../../sparql/pagination');
const { escapeStr } = require('../../strings/escape');

/**
 * Build a single **paginated** SPARQL SELECT that returns:
 *  - denormalized rows for the **IDs in the requested page** (request, URI, headers, params, optional response, optional connection)
 *  - a **?total** column (COUNT DISTINCT of matching requests) available on every result row
 *
 * Design:
 *  1) Subquery #1 computes a **global total** of matching requests using the provided filters.
 *  2) Subquery #2 selects a **stable page of IDs** (`ORDER BY ?idVal`, `LIMIT`, `OFFSET`) using the **same filters**.
 *  3) Final JOIN returns full details **only** for IDs from the current page.
 *  4) The entire “page + details” block is wrapped in `OPTIONAL { ... }` so that when a page is empty
 *     (e.g., `OFFSET` beyond the last page) the result still contains **one row** with `?total` defined and
 *     all other variables unbound. This avoids losing the total in empty pages.
 *
 * Supported filters (all optional):
 *  - `method` (case-insensitive via `UCASE`)
 *  - `scheme`, `authority`, `path` (exact match on string value)
 *  - `text` (substring match on the full URI via `CONTAINS`)
 *  - `headerName` (case-insensitive) and `headerValue` (exact) — evaluated on request/representation/payload headers
 *
 * Safety & normalization:
 *  - `limit` and `offset` are sanitized (`sanitizeLimit`, `sanitizeOffset` → non-negative integers).
 *  - All dynamic string literals in FILTERs are escaped via `escapeStr`.
 *
 * Output shape:
 *  - Denormalized rowset with variables:
 *      ?id, ?httpVersion, ?methodName,
 *      ?uriFull, ?scheme, ?authority, ?path, ?fragment, ?queryXml,
 *      ?bodyBase64,
 *      ?hdrName ?hdrValue,
 *      ?paramName ?paramValue,
 *      ?resHttpVersion ?resBodyBase64 ?statusCodeNumber ?reasonPhrase ?rhdrName ?rhdrValue,
 *      ?connAuthority,
 *      ?total
 *
 * @param {object} [params={}]               Builder parameters.
 * @param {SelectFilters} [params.filters]    Optional filters (see above).
 * @param {number} [params.limit=10]          Page size (sanitized, default 10).
 * @param {number} [params.offset=0]          Page offset (sanitized, default 0).
 * @returns {string}                          A complete SPARQL SELECT string ready to run on GraphDB.
 *
 * @example
 * const q = buildSelectRequestsPaged({
 *   filters: { method: 'GET', scheme: 'https', text: 'q=node' },
 *   limit: 10,
 *   offset: 0
 * });
 * // await graphdb.runSelect(q)
 */
function buildSelectRequestsPaged({ filters = {}, limit = 10, offset = 0 } = {}) {
  const { method, scheme, authority, path, headerName, headerValue, text } = filters || {};
  const whereFilters = [];
  if (method)      whereFilters.push(`FILTER(UCASE(STR(?methodName0)) = "${escapeStr(String(method).toUpperCase())}")`);
  if (scheme)      whereFilters.push(`FILTER(STR(?scheme0) = "${escapeStr(scheme)}")`);
  if (authority)   whereFilters.push(`FILTER(STR(?authority0) = "${escapeStr(authority)}")`);
  if (path)        whereFilters.push(`FILTER(STR(?path0) = "${escapeStr(path)}")`);
  if (text)        whereFilters.push(`FILTER(CONTAINS(STR(?uriFull0), "${escapeStr(text)}"))`);
  if (headerName)  whereFilters.push(`FILTER(LCASE(STR(?hdrName0)) = "${escapeStr(String(headerName).toLowerCase())}")`);
  if (headerValue) whereFilters.push(`FILTER(STR(?hdrValue0) = "${escapeStr(headerValue)}")`);

  const lim = sanitizeLimit(limit, 10);
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
  # Response fields
  ?resHttpVersion ?resBodyBase64 ?statusCodeNumber ?reasonPhrase
  ?rhdrName ?rhdrValue
  # Connection field
  ?connAuthority
  # Global total (repeated on each row)
  ?total
WHERE {
  # 1) Global total is always present
  {
    SELECT (COUNT(DISTINCT ?req0) AS ?total)
    WHERE {
      GRAPH <${G_HTTP}> {
        ?req0 a ex:Request ;
              ex:uriRequest ?uriRes0 ;
              ex:mthd ?methodInd0 .
        BIND(STRAFTER(STR(?methodInd0), "#") AS ?methodName0)

        ?uriRes0 a ex:URI .
        OPTIONAL { ?uriRes0 ex:uri       ?uriFull0 . }
        OPTIONAL { ?uriRes0 ex:scheme    ?scheme0 . }
        OPTIONAL { ?uriRes0 ex:authority ?authority0 . }
        OPTIONAL { ?uriRes0 ex:path      ?path0 . }

        OPTIONAL {
          { ?req0 ex:reqHeader ?hdr0 . } UNION
          { ?req0 ex:repHeader ?hdr0 . } UNION
          { ?req0 ex:payHeader ?hdr0 . }
          ?hdr0 ex:fieldName ?hdrName0 .
          OPTIONAL { ?hdr0 ex:fieldValue ?hdrValue0 . }
        }

        ${whereFilters.join('\n        ')}
      }
    }
  }

  # 2) Page + details made OPTIONAL, so empty pages still return one row with ?total only
  OPTIONAL {
    {
      SELECT DISTINCT ?idVal
      WHERE {
        GRAPH <${G_HTTP}> {
          ?req1 a ex:Request ;
                ex:uriRequest ?uriRes1 ;
                ex:mthd ?methodInd1 .
          OPTIONAL { ?req1 ex:id ?idExplicit1 . }
          BIND(COALESCE(?idExplicit1, STRAFTER(STR(?req1), "urn:req:")) AS ?idVal)
          BIND(STRAFTER(STR(?methodInd1), "#") AS ?methodName0)

          ?uriRes1 a ex:URI .
          OPTIONAL { ?uriRes1 ex:uri       ?uriFull0 . }
          OPTIONAL { ?uriRes1 ex:scheme    ?scheme0 . }
          OPTIONAL { ?uriRes1 ex:authority ?authority0 . }
          OPTIONAL { ?uriRes1 ex:path      ?path0 . }

          OPTIONAL {
            { ?req1 ex:reqHeader ?hdr0 . } UNION
            { ?req1 ex:repHeader ?hdr0 . } UNION
            { ?req1 ex:payHeader ?hdr0 . }
            ?hdr0 ex:fieldName ?hdrName0 .
            OPTIONAL { ?hdr0 ex:fieldValue ?hdrValue0 . }
          }

          ${whereFilters.join('\n          ')}
        }
      }
      ORDER BY ?idVal
      LIMIT ${lim}
      OFFSET ${off}
    }

    GRAPH <${G_HTTP}> {
      ?req a ex:Request ;
           ex:uriRequest ?uriRes ;
           ex:mthd ?methodInd .
      OPTIONAL { ?req ex:id ?idExplicit . }
      BIND(COALESCE(?idExplicit, STRAFTER(STR(?req), "urn:req:")) AS ?idVal2)
      FILTER(?idVal2 = ?idVal)
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

      # Connection via rdfs:seeAlso or deterministic fallback IRI
      OPTIONAL {
        ?req rdfs:seeAlso ?conn .
        ?conn a ex:Connection .
        OPTIONAL { ?conn ex:connectionAuthority ?connAuthority . }
      }
      OPTIONAL {
        BIND(IRI(CONCAT("urn:req:", ENCODE_FOR_URI(?idVal2), ":conn")) AS ?conn2)
        ?conn2 a ex:Connection .
        OPTIONAL { ?conn2 ex:connectionAuthority ?connAuthority . }
      }

      # Optional response (version, body, status code, reason, headers)
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
    }
  }
}
`.trim();
}

module.exports = buildSelectRequestsPaged;
