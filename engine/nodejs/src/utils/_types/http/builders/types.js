/** @typedef {import('../types').HttpRequest} HttpRequest */
/** @typedef {import('../types').SelectFilters} SelectFilters */
/** @typedef {import('../types').HttpHeader} HttpHeader */

/**
 * A single query parameter entry.
 * @typedef {Object} RequestParam
 * @property {string} name
 * @property {string|number|boolean|undefined|null} [value]
 */

/**
 * Optional connection info attached to the request.
 * @typedef {Object} RequestConnection
 * @property {string} [authority]
 */

/**
 * Optional HTTP response info attached to the request.
 * @typedef {Object} RequestResponse
 * @property {string} [httpVersion]
 * @property {number} [status]
 * @property {string} [reason]
 * @property {string} [bodyBase64]
 * @property {HttpHeader[]} [headers]
 */

/**
 * Builder input accepted by `extractTriplesForSingleRequest`.
 * Extends the base HttpRequest with optional fields used by the RDF generation.
 * - Requires: `id`, `method`, `uri.full`
 * - Optional: `httpVersion`, `bodyBase64`, `connection`, `response`, plus `uri` decomposed fields.
 *
 * @typedef {HttpRequest & {
 *   uri: HttpRequest['uri'] & {
 *     queryRaw?: string,
 *     queryXml?: string,
 *     params?: RequestParam[]
 *   },
 *   connection?: RequestConnection,
 *   response?: RequestResponse
 * }} BuilderRequestInput
 */

/** @typedef {BuilderRequestInput & { graph?: string }} InsertItem */

module.exports = {};