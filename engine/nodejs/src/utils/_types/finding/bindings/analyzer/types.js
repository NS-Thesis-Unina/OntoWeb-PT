// @ts-check

/**
 * Analyzer bindings types (detail + list) for findings.
 */

/**
 * A single SPARQL binding row (variable name → cell).
 *
 * @typedef {import('../types').SparqlBindingRow} SparqlBindingRow
 */

/**
 * Single HTML Field attached to a Tag.
 *
 * @typedef {Object} AnalyzerHtmlField
 * @property {string} iri
 * @property {string} [source]
 */

/**
 * HTML Tag node with attributes and nested child tags.
 *
 * @typedef {Object} AnalyzerHtmlTagNode
 * @property {string} iri
 * @property {string} [source]
 * @property {AnalyzerHtmlField[]} [fields]
 * @property {AnalyzerHtmlTagNode[]} [children]
 */

/**
 * Context information attached to AnalyzerScan (form, script, iframe, etc.).
 *
 * @typedef {Object} AnalyzerContext
 * @property {string} [type]
 * @property {number} [index]
 * @property {string} [origin]
 * @property {string} [src]
 * @property {string} [formAction]
 * @property {string} [formMethod]
 */

/**
 * Detailed AnalyzerScan finding JSON shape.
 *
 * @typedef {Object} AnalyzerFindingDetail
 * @property {string} id
 * @property {string} [resolver]
 * @property {string} [vulnerabilityType]
 * @property {string} [severity]
 * @property {string} [findingCategory]
 * @property {string} [owaspCategory]
 * @property {string} [ruleId]
 * @property {string} [description]
 * @property {string} [remediation]
 * @property {AnalyzerContext} [context]
 * @property {string} [codeSnippet]
 * @property {AnalyzerHtmlTagNode[]} [html]
 */

/**
 * Normalized result for a paginated list of Analyzer findings.
 *
 * @typedef {Object} AnalyzerFindingsList
 * @property {string[]} items - Array of finding IDs (subject IRIs as strings).
 * @property {number} total  - Total number of matching findings.
 */

module.exports = {};
