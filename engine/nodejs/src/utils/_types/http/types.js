/**
 * A single HTTP header entry.
 *
 * @typedef {Object} HttpHeader
 * @property {string} name - Header name as captured (case preserved by the caller).
 * @property {string} value - Raw header value.
 */

/**
 * URI information associated with an HTTP request.
 * This is the **normalized** shape exposed by the library.
 *
 * @typedef {Object} RequestURI
 * @property {string} full - Full URI string (e.g. "https://example.com/path?x=1").
 * @property {string} [scheme] - URI scheme (e.g. "http", "https").
 * @property {string} [authority] - Authority component (e.g. "example.com:443").
 * @property {string} [path] - Path component (e.g. "/api/v1/items").
 * @property {string} [fragment] - Fragment without "#" (e.g. "section-1").
 * @property {string} [queryXml]
 *   Optional query component serialized as an XMLLiteral string.
 *   This is usually produced by SPARQL builders, not by raw captures.
 */

/**
 * Minimal HTTP request model used across the library.
 * Concrete builders may extend this shape with additional fields
 * (e.g. `connection`, `response`, `graph`, `uri.params`, `uri.queryRaw`).
 *
 * @typedef {Object} HttpRequest
 * @property {string} id - Logical identifier for the request (stable per capture).
 * @property {string} method - HTTP method (e.g. "GET", "POST", "PUT" ...).
 * @property {RequestURI} uri - Normalized URI information.
 * @property {string} [httpVersion] - HTTP version string (e.g. "HTTP/1.1").
 * @property {string} [bodyBase64] - Optional request body encoded as Base64.
 * @property {HttpHeader[]} [requestHeaders] - Normalized request headers.
 */

/**
 * Common filters used by SPARQL SELECT builders for HTTP requests.
 *
 * @typedef {Object} SelectFilters
 * @property {string} [method] - HTTP method filter (case-insensitive).
 * @property {string} [scheme] - URI scheme filter (exact match).
 * @property {string} [authority] - URI authority filter (exact match).
 * @property {string} [path] - URI path filter (exact match).
 * @property {string} [headerName] - Request header name filter (case-insensitive).
 * @property {string} [headerValue] - Request header value filter (exact match).
 * @property {string} [text]
 *   Free-text filter applied to the full URI (e.g. substring of `uri.full`).
 */

/**
 * Ontology classes used for header resources in the HTTP model.
 *
 * For request headers:
 * - "PayloadHeaders"        → content-* headers describing the request body
 * - "RepresentationHeaders" → negotiation / representation preferences
 * - "RequestHeader"         → generic request header
 * - "Cookie"                → dedicated subclass for the `Cookie` header
 *
 * For response headers:
 * - "PayloadHeaders"        → content-* headers describing the response body
 * - "RepresentationHeaders" → validators / cache / negotiation
 * - "ResponseHeader"        → generic response header
 * - "Set-Cookie"            → dedicated subclass for the `Set-Cookie` header
 *
 * @typedef {'PayloadHeaders'
 *         | 'RepresentationHeaders'
 *         | 'RequestHeader'
 *         | 'ResponseHeader'
 *         | 'Cookie'
 *         | 'Set-Cookie'} HeaderClass
 */

/**
 * Ontology properties linking the header resource to the request/response node.
 *
 * For request headers:
 * - "payHeader" → payload-related headers
 * - "repHeader" → representation / negotiation headers
 * - "reqHeader" → generic / Cookie headers
 *
 * For response headers:
 * - "payHeader" → payload-related headers
 * - "repHeader" → representation / cache headers
 * - "resHeader" → generic / Set-Cookie headers
 *
 * @typedef {'payHeader'|'repHeader'|'reqHeader'|'resHeader'} HeaderProp
 */

/**
 * Result of header classification for ontology-aware builders.
 *
 * @typedef {Object} HeaderClassification
 * @property {HeaderClass} cls - Ontology class name for the header resource.
 * @property {HeaderProp} prop - Ontology property used to link the header to its owner node.
 */

module.exports = {};
