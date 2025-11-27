/** @typedef {import('../types').HttpRequest} HttpRequest */
/** @typedef {import('../types').SelectFilters} SelectFilters */
/** @typedef {import('../types').HttpHeader} HttpHeader */
/** @typedef {import('../builders/types').RequestParam} RequestParam */
/** @typedef {import('../builders/types').RequestConnection} RequestConnection */
/** @typedef {import('../builders/types').RequestResponse} RequestResponse */

/**
 * HTTP request object produced by GraphDB bindings normalization.
 *
 * This extends the base {@link HttpRequest} shape with:
 * - `graph`       → named graph IRI where the triples are stored (usually `G_HTTP`)
 * - `connection`  → optional connection information (authority)
 * - `response`    → optional HTTP response model (status, headers, body, ...)
 * - `uri.params`  → normalized list of query parameters
 * - `uri.queryRaw`→ raw query string reconstructed from `params`, when present
 *
 * @typedef {HttpRequest & {
 *   graph?: string,
 *   connection?: RequestConnection,
 *   response?: RequestResponse,
 *   uri: HttpRequest['uri'] & {
 *     queryRaw?: string,
 *     params?: RequestParam[]
 *   }
 * }} HttpRequestFromBindings
 */

/**
 * A normalized list payload for HTTP requests produced by bindings.
 * Wraps the array of requests under an `items` property to allow future metadata (e.g., total).
 *
 * @typedef {Object} HttpRequestList
 * @property {HttpRequestFromBindings[]} items - The list of normalized HTTP requests.
 */

module.exports = {};
