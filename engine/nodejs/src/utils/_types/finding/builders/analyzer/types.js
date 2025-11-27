// @ts-check

/**
 * Analyzer finding as produced by resolveAnalyzer.
 * Re-exported here for convenience in finding builders.
 *
 * @typedef {import('../../../resolvers/analyzer/types').AnalyzerFinding} AnalyzerFinding
 */

/**
 * Parameters accepted by buildSelectAnalyzerFindingById.
 *
 * @typedef {Object} AnalyzerFindingByIdParams
 * @property {string} id - Full IRI/URN of the AnalyzerScan finding (e.g. "urn:finding:...").
 */

/**
 * Parameters accepted by buildSelectAnalyzerFindingsPaged.
 *
 * @typedef {Object} AnalyzerFindingsPagedParams
 * @property {number} [limit]  - Page size (will be sanitized).
 * @property {number} [offset] - Page offset (will be sanitized).
 */

module.exports = {};
