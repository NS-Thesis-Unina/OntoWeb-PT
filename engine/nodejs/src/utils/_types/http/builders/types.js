/** @typedef {import('../types').HttpRequest} HttpRequest */
/** @typedef {import('../types').SelectFilters} SelectFilters */
/** @typedef {import('../types').HttpHeader} HttpHeader */

/**
 * A single query parameter entry.
 *
 * @typedef {Object} RequestParam
 * @property {string} name - Parameter name.
 * @property {string|number|boolean|undefined|null} [value]
 *   Optional parameter value; may be missing (e.g. `?flag`).
 */

/**
 * Optional connection info attached to the request.
 *
 * @typedef {Object} RequestConnection
 * @property {string} [authority] - Connection authority (e.g. proxy host).
 */

/**
 * Optional HTTP response info attached to the request.
 *
 * @typedef {Object} RequestResponse
 * @property {string} [httpVersion] - HTTP version string for the response.
 * @property {number} [status] - Numeric status code (e.g. 200, 404).
 * @property {string} [reason] - Reason phrase (e.g. "OK", "Not Found").
 * @property {string} [bodyBase64] - Optional response body encoded as Base64.
 * @property {HttpHeader[]} [headers] - Normalized response headers.
 */

/**
 * Builder input accepted by `extractTriplesForSingleRequest`.
 *
 * Extends the base {@link HttpRequest} with optional fields used by RDF generation:
 * - Requires: `id`, `method`, `uri.full`
 * - Optional:
 *   - `httpVersion`, `bodyBase64`
 *   - `connection` (authority)
 *   - `response` (status, headers, body, ...)
 *   - `uri` decomposed into `scheme`, `authority`, `path`, `fragment`,
 *     plus query-related fields (`queryRaw`, `queryXml`, `params`).
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

/**
 * Internal item used by HTTP INSERT builders.
 * Adds an optional `graph` field to {@link BuilderRequestInput}.
 *
 * @typedef {BuilderRequestInput & { graph?: string }} InsertItem
 */

module.exports = {};
