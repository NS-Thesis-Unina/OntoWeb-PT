// @ts-check

/**
 * Techstack resolver finding as produced by resolveTechstack.
 * Re-exported here for convenience in finding builders.
 *
 * @typedef {import('../../../resolvers/techstack/types').TechstackFinding} TechstackFinding
 */

/**
 * Parameters accepted by buildSelectTechstackFindingById.
 *
 * @typedef {Object} TechstackFindingByIdParams
 * @property {string} id - Full IRI/URN of the TechstackScan finding (e.g. "urn:finding:...").
 */

/**
 * Parameters accepted by buildSelectTechstackFindingsPaged.
 *
 * @typedef {Object} TechstackFindingsPagedParams
 * @property {number} [limit]  - Page size (will be sanitized).
 * @property {number} [offset] - Page offset (will be sanitized).
 */

module.exports = {};
