// @ts-check

/** @typedef {import('../../../_types/graphdb/types').SparqlBindingCell} SparqlBindingCell */
/** @typedef {import('../../../_types/finding/bindings/types').SparqlBindingRow} SparqlBindingRow */
/** @typedef {import('../../../_types/finding/bindings/techstack/types').TechstackFindingsList} TechstackFindingsList */

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
 * @returns {TechstackFindingsList} Normalized list with `{ items, total }`.
 */
function bindingsToTechstackFindingsList(bindings) {
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

module.exports = bindingsToTechstackFindingsList;
