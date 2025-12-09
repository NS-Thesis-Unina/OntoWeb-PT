// @ts-check

/**
 * Techstack bindings types (detail + list) for findings.
 */

/**
 * A single SPARQL binding row (variable name → cell).
 *
 * @typedef {import('../types').SparqlBindingRow} SparqlBindingRow
 */

/**
 * Summary of a CVE associated with a Technology / WAF.
 *
 * @typedef {Object} TechstackCveSummary
 * @property {string} iri
 * @property {string} [id]
 * @property {number} [score]
 * @property {string} [severity]
 */

/**
 * Software evidence (Technology or WAF) attached to a Techstack finding.
 *
 * @typedef {Object} TechstackSoftwareEvidence
 * @property {string} [type]    - Evidence type ("Technology" | "WAF").
 * @property {string} [name]    - Software name.
 * @property {string} [version] - Software version (if available).
 * @property {string[]} [cpe]   - Array of CPE strings (labels or literals).
 * @property {TechstackCveSummary[]} [cve] - CVE summaries.
 */

/**
 * Header evidence attached to a Techstack finding.
 *
 * @typedef {Object} TechstackHeaderEvidence
 * @property {string} [name]    - Header name (fieldName or headerName).
 * @property {string[]} [urls]  - URLs where the header was observed.
 */

/**
 * Cookie evidence attached to a Techstack finding.
 *
 * @typedef {Object} TechstackCookieEvidence
 * @property {string} iri
 * @property {string} [name]
 * @property {string} [domain]
 * @property {string} [path]
 * @property {boolean} [secure]
 * @property {boolean} [httpOnly]
 * @property {string} [sameSite]
 * @property {number} [expiration]
 */

/**
 * Detailed TechstackScan finding JSON shape.
 *
 * @typedef {Object} TechstackFindingDetail
 * @property {string} id
 * @property {string} [resolver]
 * @property {string} [vulnerabilityType]
 * @property {string} [severity]
 * @property {string} [findingCategory]
 * @property {string} [mainDomain]
 * @property {string} [owaspCategory]
 * @property {string} [ruleId]
 * @property {string} [description]
 * @property {string} [remediation]
 * @property {string} [evidenceType]
 * @property {TechstackSoftwareEvidence} [software]
 * @property {TechstackHeaderEvidence} [header]
 * @property {TechstackCookieEvidence[]} [cookies]
 */

/**
 * Normalized result for a paginated list of Techstack findings.
 *
 * @typedef {Object} TechstackFindingsList
 * @property {string[]} items - Array of finding IDs (subject IRIs as strings).
 * @property {number} total  - Total number of matching findings.
 */

module.exports = {};
