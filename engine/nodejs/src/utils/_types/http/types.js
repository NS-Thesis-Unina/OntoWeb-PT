/** @typedef {{ name: string, value: string }} HttpHeader */

/**
 * @typedef {Object} RequestURI
 * @property {string} full
 * @property {string} [scheme]
 * @property {string} [authority]
 * @property {string} [path]
 * @property {string} [fragment]
 * @property {string} [queryXml]
 */

/**
 * @typedef {Object} HttpRequest
 * @property {string} id
 * @property {string} method
 * @property {RequestURI} uri
 * @property {string} [httpVersion]
 * @property {string} [bodyBase64]
 * @property {HttpHeader[]} [requestHeaders]
 */

/**
 * @typedef {Object} SelectFilters
 * @property {string} [method]
 * @property {string} [scheme]
 * @property {string} [authority]
 * @property {string} [path]
 * @property {string} [headerName]
 * @property {string} [headerValue]
 * @property {string} [text] - free-text match on uri.full
 */

/**
 * Ontology classes used for header resources.
 * - For request: 'PayloadHeaders' | 'RepresentationHeaders' | 'RequestHeader'
 * - For response: 'PayloadHeaders' | 'RepresentationHeaders' | 'ResponseHeader'
 * @typedef {'PayloadHeaders'|'RepresentationHeaders'|'RequestHeader'|'ResponseHeader'} HeaderClass
 */

/**
 * Ontology properties linking the header resource to the request/response node.
 * - Request: 'payHeader' | 'repHeader' | 'reqHeader'
 * - Response: 'payHeader' | 'repHeader' | 'resHeader'
 * @typedef {'payHeader'|'repHeader'|'reqHeader'|'resHeader'} HeaderProp
 */

/** @typedef {{ cls: HeaderClass, prop: HeaderProp }} HeaderClassification */

module.exports = {};