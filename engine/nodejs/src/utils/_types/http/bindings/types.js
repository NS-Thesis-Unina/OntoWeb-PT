/** @typedef {import('../types').HttpRequest} HttpRequest */
/** @typedef {import('../types').SelectFilters} SelectFilters */
/** @typedef {import('../types').HttpHeader} HttpHeader */

/**
 * A normalized list payload for HTTP requests.
 * Wraps the array of requests under an `items` property to allow future metadata (e.g., total).
 * @typedef {Object} HttpRequestList
 * @property {HttpRequest[]} items - The list of normalized HTTP requests.
 */

module.exports = {};