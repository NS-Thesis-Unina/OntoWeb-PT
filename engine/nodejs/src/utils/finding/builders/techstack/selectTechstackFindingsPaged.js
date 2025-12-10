// @ts-check

const { EX, G_FINDINGS } = require('../../../constants');
const { sanitizeLimit, sanitizeOffset } = require('../../../sparql/pagination');

/** @typedef {import('../../../_types/finding/builders/techstack/types').TechstackFindingsPagedParams} TechstackFindingsPagedParams */

/**
 * Build a paginated SPARQL SELECT that returns:
 *  - one row per TechstackFinding detected by TechstackResolverInstance (for the current page)
 *  - a ?total column with the global COUNT(DISTINCT ?finding) repeated on each row
 *
 * Output variables:
 *  - ?id    → string form of the finding IRI (subject)
 *  - ?total → total number of matching findings
 *
 * Behavior:
 *  1) Subquery #1 computes the global total of matching TechstackFinding.
 *  2) Subquery #2 selects a stable page of ?finding IRIs (ORDER BY ?finding, LIMIT, OFFSET).
 *  3) Outer query exposes STR(?finding) as ?id, plus ?total.
 *  4) The page block is OPTIONAL so that empty pages still return one row with ?total only.
 *
 * @param {TechstackFindingsPagedParams} [params={}] - Builder parameters.
 * @returns {string} A complete SPARQL SELECT string ready to be executed on GraphDB.
 */
function buildSelectTechstackFindingsPaged({ limit = 10, offset = 0 } = {}) {
  const lim = sanitizeLimit(limit, 10);
  const off = sanitizeOffset(offset, 0);

  return `
PREFIX ex: <${EX}>

SELECT ?id ?total
WHERE {
  # 1) Global total of TechstackFinding detected by TechstackResolverInstance
  {
    SELECT (COUNT(DISTINCT ?finding) AS ?total)
    WHERE {
      GRAPH <${G_FINDINGS}> {
        ?finding a ex:TechstackFinding ;
              ex:detectedByResolver ex:TechstackResolverInstance .
      }
    }
  }

  # 2) Page of finding IRIs (OPTIONAL to keep ?total when page is empty)
  OPTIONAL {
    {
      SELECT DISTINCT ?finding
      WHERE {
        GRAPH <${G_FINDINGS}> {
          ?finding a ex:TechstackFinding ;
                ex:detectedByResolver ex:TechstackResolverInstance .
        }
      }
      ORDER BY ?finding
      LIMIT ${lim}
      OFFSET ${off}
    }

    # Expose the subject IRI as plain string
    BIND(STR(?finding) AS ?id)
  }
}
`.trim();
}

module.exports = buildSelectTechstackFindingsPaged;
