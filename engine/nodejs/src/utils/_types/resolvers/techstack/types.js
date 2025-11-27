// @ts-check

/**
 * Severity levels normalized for techstack findings.
 *
 * @typedef {'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'|'INFO'|'UNKNOWN'} TechstackSeverity
 */

/**
 * Single CVE entry returned from NVD.
 *
 * @typedef {Object} NvdCveEntry
 * @property {string} id
 * @property {TechstackSeverity|string} severity
 * @property {number|null} [score]
 */

/**
 * Result of an NVD lookup (CVE + CPE).
 *
 * @typedef {Object} NvdLookupResult
 * @property {NvdCveEntry[]} cve
 * @property {string[]} cpe
 */

/**
 * Technology input passed to the techstack resolver.
 *
 * @typedef {Object} TechstackTechnologyInput
 * @property {string} [name]
 * @property {string|number} [version]
 */

/**
 * WAF input passed to the techstack resolver.
 *
 * @typedef {Object} TechstackWafInput
 * @property {string} [name]
 */

/**
 * Secure header input (as captured by the browser/probe).
 *
 * @typedef {Object} TechstackSecureHeaderInput
 * @property {string} [header]
 * @property {string} [description]
 * @property {string[]} [urls]
 */

/**
 * Cookie input (as captured by the browser).
 *
 * @typedef {Object} TechstackCookieInput
 * @property {string} name
 * @property {string} [domain]
 * @property {string} [path]
 * @property {boolean} [secure]
 * @property {boolean} [httpOnly]
 * @property {string|null} [sameSite]
 * @property {number} [expirationDate]
 */

/**
 * Summarized NVD data for a single technology.
 *
 * @typedef {Object} TechstackTechnologyNvdSummary
 * @property {string} name
 * @property {string|null} [version]
 * @property {NvdCveEntry[]} cve
 * @property {string[]} cpe
 * @property {boolean} hasKnownCVE
 */

/**
 * Summarized NVD data for a single WAF.
 *
 * @typedef {Object} TechstackWafNvdSummary
 * @property {string} name
 * @property {boolean} hasKnownCVE
 * @property {NvdCveEntry[]} cve
 * @property {string[]} cpe
 */

/**
 * Classified security header with risk and remediation info.
 *
 * @typedef {Object} TechstackClassifiedHeader
 * @property {string} [header]
 * @property {string} [description]
 * @property {string[]} [urls]
 * @property {string} [risk]
 * @property {TechstackSeverity} [severity]
 * @property {string} [category]
 * @property {string} [rule]
 * @property {string} [remediation]
 */

/**
 * Single issue detected on a cookie.
 *
 * @typedef {Object} TechstackCookieIssue
 * @property {string} rule
 * @property {string} risk
 * @property {TechstackSeverity} severity
 * @property {string} [category]
 * @property {string} [description]
 * @property {string} [remediation]
 */

/**
 * Aggregated security view for a single cookie.
 *
 * @typedef {Object} TechstackCookieFinding
 * @property {string} name
 * @property {string|null} [domain]
 * @property {string|null} [path]
 * @property {boolean} secure
 * @property {boolean} httpOnly
 * @property {string|null} [sameSite]
 * @property {number|null} [expirationDate]
 * @property {TechstackSeverity} worstSeverity
 * @property {TechstackCookieIssue[]} issues
 */

/**
 * Generic techstack finding aligned with the Finding/Evidence ontology.
 *
 * @typedef {Object} TechstackFinding
 * @property {string} id
 * @property {'techstack'} source
 * @property {string} kind
 * @property {string} rule
 * @property {TechstackSeverity} severity
 * @property {number|null} [score]
 * @property {string} [category]
 * @property {string} [message]
 * @property {Object} [evidence]
 * @property {string} [remediation]
 */

/**
 * Stats collected by the techstack resolver.
 *
 * @typedef {Object} TechstackStats
 * @property {Record<TechstackSeverity, number>} bySeverity
 * @property {Record<string, number>} byCategory
 * @property {Record<string, number>} byKind
 */

/**
 * High-level summary for the techstack resolver run.
 *
 * @typedef {Object} TechstackSummary
 * @property {number} totalTechnologies
 * @property {number} technologiesWithKnownCVE
 * @property {number} totalWaf
 * @property {number} wafWithKnownCVE
 * @property {number} totalHeaderFindings
 * @property {number} totalCookieFindings
 * @property {number} totalFindings
 */

/**
 * Resolver identity / metadata.
 *
 * @typedef {Object} TechstackResolverMeta
 * @property {string} id
 * @property {string} type
 * @property {string} version
 * @property {string} ontologyVersion
 */

/**
 * Input payload for the techstack resolver.
 *
 * @typedef {Object} TechstackResolveInput
 * @property {TechstackTechnologyInput[]} [technologies]
 * @property {TechstackWafInput[]} [waf]
 * @property {TechstackSecureHeaderInput[]} [secureHeaders]
 * @property {TechstackCookieInput[]} [cookies]
 * @property {string} [mainDomain]
 */

/**
 * Output payload for the techstack resolver.
 *
 * @typedef {Object} TechstackResolveResult
 * @property {true} ok
 * @property {TechstackResolverMeta} resolver
 * @property {string} analyzedAt
 * @property {TechstackSummary} summary
 * @property {TechstackStats} stats
 * @property {TechstackFinding[]} findings
 * @property {TechstackTechnologyNvdSummary[]} technologies
 * @property {TechstackWafNvdSummary[]} waf
 * @property {TechstackClassifiedHeader[]} secureHeaders
 * @property {TechstackCookieFinding[]} cookies
 */

/**
 * Callback used to collect findings from helper functions.
 *
 * @callback TechstackFindingCollector
 * @param {TechstackFinding} f
 * @returns {void}
 */

module.exports = {};
