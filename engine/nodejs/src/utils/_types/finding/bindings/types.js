// @ts-check

/**
 * Shared GraphDB binding types for Finding bindings.
 */

/**
 * Single SPARQL binding cell as returned by GraphDB.
 *
 * @typedef {import('../../graphdb/types').SparqlBindingCell} SparqlBindingCell
 */

/**
 * A single SPARQL binding row as returned by GraphDB for SELECT queries.
 * Keys are variable names, values are SPARQL binding cells.
 *
 * @typedef {Record<string, SparqlBindingCell>} SparqlBindingRow
 */

module.exports = {};
