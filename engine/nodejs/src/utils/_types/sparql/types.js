/**
 * Single query parameter entry for XML serialization.
 *
 * Used by SPARQL formatting helpers to build `<query><param ...>...</param></query>`
 * structures that are then wrapped as `rdf:XMLLiteral`.
 *
 * @typedef {Object} ParamEntry
 * @property {string} name - Parameter name (will be XML-escaped).
 * @property {string|number|boolean|null|undefined} [value] - Parameter value (stringified and XML-escaped).
 */

/**
 * SPARQL typed literal with `rdf:XMLLiteral` datatype.
 *
 * Represented as a raw SPARQL snippet, for example:
 * `"&lt;query&gt;...&lt;/query&gt;"^^<http://www.w3.org/1999/02/22-rdf-syntax-ns#XMLLiteral>`
 *
 * @typedef {string} XmlLiteralString
 */

/**
 * Generic SPARQL query/update string.
 *
 * @typedef {string} SparqlString
 */

module.exports = {};
