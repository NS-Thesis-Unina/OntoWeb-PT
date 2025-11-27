// @ts-check

/** @typedef {import('../../http/builders/types').BuilderRequestInput} BuilderRequestInput */

/**
 * Request object consumed by the HTTP resolver.
 * Extends the core HTTP builder input with an optional `graph` property
 * indicating the named graph where the request has been inserted.
 *
 * @typedef {BuilderRequestInput & { graph?: string }} HttpResolverRequest
 */

/**
 * Severity levels used by HTTP resolver findings.
 *
 * @typedef {'high'|'medium'|'low'|'info'|'unknown'} HttpSeverity
 */

/**
 * Side where an HTTP header/cookie is located.
 *
 * @typedef {'request'|'response'} HttpHeaderLocation
 */

/**
 * Header evidence item returned by HTTP rules.
 *
 * @typedef {Object} HttpEvidenceHeader
 * @property {HttpHeaderLocation} where
 * @property {number} index
 * @property {string} [name]
 * @property {string} [value]
 */

/**
 * Attributes extracted from a Set-Cookie header.
 *
 * @typedef {Object} HttpEvidenceCookieAttributes
 * @property {boolean} [secure]
 * @property {boolean} [httpOnly]
 * @property {string|null} [sameSite]
 * @property {string|null} [domain]
 * @property {string|null} [path]
 */

/**
 * Cookie evidence item returned by HTTP rules.
 *
 * @typedef {Object} HttpEvidenceCookie
 * @property {HttpHeaderLocation} where
 * @property {number} headerIndex
 * @property {string} [headerName]
 * @property {number} cookieIndex
 * @property {string} [name]
 * @property {string} [value]
 * @property {HttpEvidenceCookieAttributes} [attributes]
 * @property {string[]} [missingFlags]
 * @property {string} [raw]
 */

/**
 * Query parameter evidence item.
 *
 * @typedef {Object} HttpEvidenceParam
 * @property {number} index
 * @property {string} [name]
 * @property {string|number|boolean|null} [value]
 */

/**
 * Evidence kinds supported by HTTP rules.
 *
 * @typedef {'header'|'cookie'|'param'|'body'|'transport'} HttpEvidenceKind
 */

/**
 * Normalized evidence structure returned by HTTP rules.
 *
 * @typedef {Object} HttpEvidence
 * @property {HttpEvidenceKind} kind
 * @property {HttpEvidenceHeader[]} [headers]
 * @property {HttpEvidenceCookie[]} [cookies]
 * @property {HttpEvidenceParam[]} [params]
 * @property {string} [rawQuery]
 * @property {string[]} [insecureResources]
 * @property {string} [pattern]
 * @property {string} [snippet]
 * @property {string} [location]
 */

/**
 * Base HTTP context shared by all rules for a single request.
 *
 * @typedef {Object} HttpContextBase
 * @property {string|null} requestId
 * @property {string} graph
 * @property {string} [requestIri]
 * @property {string} [uriIri]
 * @property {string} [responseIri]
 */

/**
 * Parameter reference enriched with its IRI.
 *
 * @typedef {Object} HttpContextParamRef
 * @property {number} index
 * @property {string} [name]
 * @property {string|number|boolean|null} [value]
 * @property {string} [iri]
 */

/**
 * Header reference enriched with its IRI.
 *
 * @typedef {Object} HttpContextHeaderRef
 * @property {HttpHeaderLocation} where
 * @property {number} index
 * @property {string} [name]
 * @property {string} [value]
 * @property {string} [iri]
 */

/**
 * Cookie reference enriched with the header IRI that contains it.
 *
 * @typedef {Object} HttpContextCookieRef
 * @property {HttpHeaderLocation} where
 * @property {number} headerIndex
 * @property {number} cookieIndex
 * @property {string} [name]
 * @property {string} [value]
 * @property {HttpEvidenceCookieAttributes} [attributes]
 * @property {string[]} [missingFlags]
 * @property {string} [raw]
 * @property {string} [headerIri]
 */

/**
 * HTTP context enriched with IRIs for parameters, headers and cookies.
 *
 * @typedef {HttpContextBase & {
 *   params?: HttpContextParamRef[],
 *   headers?: HttpContextHeaderRef[],
 *   cookies?: HttpContextCookieRef[]
 * }} HttpContext
 */

/**
 * Single finding produced by the HTTP resolver.
 *
 * @typedef {Object} HttpResolverFinding
 * @property {string} ruleId
 * @property {HttpSeverity|string} severity
 * @property {string} description
 * @property {string} [category]
 * @property {string} [owasp]
 * @property {string} [url]
 * @property {string} [method]
 * @property {number} [responseStatus]
 * @property {string|null} [requestId]
 * @property {string} [graph]
 * @property {string} [resolver]
 * @property {HttpContext} [httpContext]
 * @property {HttpEvidence} [evidence]
 */

/**
 * Per-severity stats for HTTP findings.
 *
 * @typedef {{ high: number, medium: number, low: number }} HttpResolverStats
 */

/**
 * Result returned by the HTTP analysis.
 *
 * @typedef {Object} HttpResolverResult
 * @property {true} ok
 * @property {number} totalFindings
 * @property {HttpResolverStats} stats
 * @property {HttpResolverFinding[]} findings
 */

module.exports = {};
