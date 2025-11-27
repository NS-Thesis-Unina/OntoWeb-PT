// @ts-check

/** @typedef {import('../../../_types/graphdb/types').SparqlBindingCell} SparqlBindingCell */

/**
 * A single SPARQL binding row as returned by GraphDB for SELECT queries.
 * Keys are variable names, values are SPARQL binding cells.
 *
 * @typedef {Record<string, SparqlBindingCell>} SparqlBindingRow
 */

/**
 * Normalized result for a paginated list of HTTP findings.
 *
 * @typedef {Object} HttpFindingsList
 * @property {string[]} items - Array of finding IDs (subject IRIs as strings).
 * @property {number} total  - Total number of matching findings.
 */

/**
 * Transform SPARQL JSON bindings into a list of finding IDs and a total count.
 *
 * Input expectation (per row):
 *  - ?id    (string form of the finding IRI) — may be unbound on the “total only” row
 *  - ?total (global count of distinct findings) — repeated on each row
 *
 * When the page is empty, GraphDB will still return one row with only ?total bound.
 *
 * @param {SparqlBindingRow[]} bindings - SPARQL JSON `results.bindings` array.
 * @returns {HttpFindingsList} Normalized list with `{ items, total }`.
 */
function bindingsToHttpFindingsList(bindings) {
  /** @type {string[]} */
  const items = [];
  let total = 0;

  for (const b of bindings) {
    // Extract total, if present
    const totalCell = b.total;
    if (totalCell && typeof totalCell.value === 'string') {
      const t = Number(totalCell.value);
      if (!Number.isNaN(t)) {
        total = t;
      }
    }

    // Extract finding ID (subject IRI as string)
    const idCell = b.id;
    if (idCell && typeof idCell.value === 'string') {
      items.push(idCell.value);
    }
  }

  return { items, total };
}

module.exports = bindingsToHttpFindingsList;
