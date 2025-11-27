// @ts-check

/**
 * Shared type definitions for Finding builders (Techstack / HTTP / Analyzer).
 * These types are consumed by:
 *  - utils/finding/builders/common.js
 *  - utils/finding/builders/extractTriples.js
 *  - utils/finding/builders/insertBatch.js
 */

/**
 * Severity values used across resolvers and finding builders.
 * Additional string values are tolerated but normalized to one of these.
 * @typedef {'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'|'INFO'|'UNKNOWN'|string} FindingSeverity
 */

/**
 * Source tag used to route a finding to the proper builder.
 * @typedef {'techstack'|'http'|'http-resolver'|'analyzer'|'sast'|string} FindingSource
 */

/**
 * Base shape for any scan/finding object as seen by builders.
 * Concrete resolver-level findings should extend this shape.
 *
 * @typedef {object} FindingBase
 * @property {string} [id]
 * @property {string} [findingId]
 * @property {FindingSource} [source]
 * @property {string} [resolver]
 * @property {string} [ruleId]
 * @property {string} [rule]
 * @property {string} [category]
 * @property {string} [owasp]
 * @property {string} [message]
 * @property {string} [description]
 * @property {FindingSeverity} [severity]
 * @property {string} [remediation]
 * @property {string|number} [requestId]
 * @property {string} [pageUrl]
 * @property {string} [url]
 */

/**
 * Techstack resolver finding (as produced by resolveTechstack).
 * @typedef {import('../../resolvers/techstack/types').TechstackFinding} TechstackFinding
 */

/**
 * HTTP resolver finding (as produced by analyzeHttpRequests).
 * @typedef {import('../../resolvers/http/types').HttpResolverFinding} HttpResolverFinding
 */

/**
 * Analyzer resolver finding (as produced by resolveAnalyzer).
 * @typedef {import('../../resolvers/analyzer/types').AnalyzerFinding} AnalyzerFinding
 */

/**
 * Union of all findings that can be processed by finding builders.
 * @typedef {FindingBase | TechstackFinding | HttpResolverFinding | AnalyzerFinding | any} AnyFinding
 */

module.exports = {};
