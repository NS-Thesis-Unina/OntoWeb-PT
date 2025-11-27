/**
 * A single SPARQL binding cell in the JSON result format.
 * It represents a term bound to a variable (literal, URI, or blank node).
 *
 * @typedef {Object} SparqlBindingCell
 * @property {string} type - Term type ("uri", "bnode", "literal", "typed-literal", ...).
 * @property {string} value - Raw lexical form of the term.
 * @property {string} [xmlLang]
 *   Optional language tag (for language-tagged literals).
 *   In the raw SPARQL JSON this is exposed as the "xml:lang" field.
 * @property {string} [datatype] - Optional datatype IRI (for typed literals).
 */

/**
 * SPARQL result "head" section.
 *
 * @typedef {Object} SparqlHead
 * @property {string[]} vars - List of variable names present in the result set.
 */

/**
 * SPARQL JSON result for SELECT queries.
 *
 * @typedef {Object} SparqlSelectResult
 * @property {SparqlHead} head - Result head (variable names).
 * @property {{ bindings: Record<string, SparqlBindingCell>[] }} results - Array of binding rows.
 */

/**
 * SPARQL JSON result for ASK queries.
 * GraphDB usually returns an object with a boolean field and an optional head.
 *
 * @typedef {Object} SparqlAskResult
 * @property {SparqlHead} [head] - Optional head section (often empty for ASK).
 * @property {boolean} boolean - Result of the ASK query.
 */

/**
 * Union of all supported SPARQL JSON results (SELECT or ASK).
 *
 * @typedef {SparqlSelectResult | SparqlAskResult} SparqlJsonResult
 */

module.exports = {};
