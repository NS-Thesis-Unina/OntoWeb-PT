// @ts-check

/**
 * HTTP bindings types (detail + list) for findings.
 */

/**
 * A single SPARQL binding row (variable name → cell).
 *
 * @typedef {import('../types').SparqlBindingRow} SparqlBindingRow
 */

/**
 * Detailed HttpScan finding JSON shape.
 *
 * @typedef {Object} HttpFindingDetail
 * @property {string} id
 * @property {string} [resolver]
 * @property {string} [vulnerabilityType]
 * @property {string} [severity]
 * @property {string} [findingCategory]
 * @property {string} [owaspCategory]
 * @property {string} [ruleId]
 * @property {string} [description]
 * @property {string} [remediation]
 * @property {{ method?: string, url?: string, status?: number }} [http]
 * @property {string[]} [relatedHttp]
 */

/**
 * Normalized result for a paginated list of HTTP findings.
 *
 * @typedef {Object} HttpFindingsList
 * @property {string[]} items - Array of finding IDs (subject IRIs as strings).
 * @property {number} total  - Total number of matching findings.
 */

module.exports = {};
