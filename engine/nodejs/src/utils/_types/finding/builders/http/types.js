// @ts-check

/**
 * HTTP resolver finding as produced by analyzeHttpRequests.
 * Re-exported here for convenience in finding builders.
 *
 * @typedef {import('../../../resolvers/http/types').HttpResolverFinding} HttpResolverFinding
 */

/**
 * Parameters accepted by buildSelectHttpFindingById.
 *
 * @typedef {Object} HttpFindingByIdParams
 * @property {string} id - Full IRI/URN of the HttpFinding (e.g. "urn:finding:...").
 */

/**
 * Parameters accepted by buildSelectHttpFindingsPaged.
 *
 * @typedef {Object} HttpFindingsPagedParams
 * @property {number} [limit]  - Page size (will be sanitized).
 * @property {number} [offset] - Page offset (will be sanitized).
 */

module.exports = {};
