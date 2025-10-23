// @ts-check
/** @typedef {import('../_types/http/types').HttpRequest} HttpRequest */
/** @typedef {import('../_types/http/types').SelectFilters} SelectFilters */
/** @typedef {import('../_types/http/types').HttpHeader} HttpHeader */
/** @typedef {import('../_types/http/types').HeaderClassification} HeaderClassification */

const payloadReq = new Set(['content-type','content-length','content-encoding','content-language','content-location','content-md5','content-range']);
const representationReq = new Set(['accept','accept-language','accept-encoding','accept-charset','accept-datetime']);
/**
 * Classify and normalize **HTTP request** headers into ontology-aware categories.
 *
 * Normalization:
 * - The header `name` is lowercased before matching.
 *
 * Categories:
 * - **PayloadHeaders**  (linked with `ex:payHeader`): content-* headers that describe the request body
 *   → `content-type`, `content-length`, `content-encoding`, `content-language`,
 *      `content-location`, `content-md5`, `content-range`
 * - **RepresentationHeaders** (linked with `ex:repHeader`): negotiation / representation preferences
 *   → `accept`, `accept-language`, `accept-encoding`, `accept-charset`, `accept-datetime`
 * - **RequestHeader** (linked with `ex:reqHeader`): any other request header
 *
 * @param {string} [name=''] Raw header name (any case).
 * @returns {HeaderClassification} Object with ontology class `cls` and linking property `prop`.
 *
 * @example
 * classifyRequestHeader('Content-Type');
 * // { cls: 'PayloadHeaders', prop: 'payHeader' }
 *
 * @example
 * classifyRequestHeader('Accept');
 * // { cls: 'RepresentationHeaders', prop: 'repHeader' }
 *
 * @example
 * classifyRequestHeader('X-Request-ID');
 * // { cls: 'RequestHeader', prop: 'reqHeader' }
 */
function classifyRequestHeader(name = '') {
  const n = String(name).toLowerCase();
  if (payloadReq.has(n))        return { cls: 'PayloadHeaders',        prop: 'payHeader' };
  if (representationReq.has(n)) return { cls: 'RepresentationHeaders', prop: 'repHeader' };
  return { cls: 'RequestHeader', prop: 'reqHeader' };
}

/**
 * Classify and normalize **HTTP response** headers into ontology-aware categories.
 *
 * Normalization:
 * - The header `name` is lowercased before matching.
 *
 * Categories:
 * - **PayloadHeaders**  (linked with `ex:payHeader`): content-* headers that describe the response body
 *   → `content-type`, `content-length`, `content-encoding`, `content-language`,
 *      `content-location`, `content-md5`, `content-range`
 * - **RepresentationHeaders** (linked with `ex:repHeader`): validators / cache / negotiation
 *   → `vary`, `accept-ranges`, `etag`, `last-modified`, `cache-control`, `expires`
 * - **ResponseHeader** (linked with `ex:resHeader`): any other response header
 *
 * @param {string} [name=''] - Raw header name (any case).
 * @returns {HeaderClassification} An object with the ontology class `cls` and the linking property `prop`.
 *
 * @example
 * classifyResponseHeader('Content-Length');
 * // { cls: 'PayloadHeaders', prop: 'payHeader' }
 *
 * @example
 * classifyResponseHeader('ETag');
 * // { cls: 'RepresentationHeaders', prop: 'repHeader' }
 *
 * @example
 * classifyResponseHeader('X-Trace-Id');
 * // { cls: 'ResponseHeader', prop: 'resHeader' }
 */
function classifyResponseHeader(name = '') {
  const n = String(name).toLowerCase();
  const payload = new Set(['content-type','content-length','content-encoding','content-language','content-location','content-md5','content-range']);
  const representation = new Set(['vary','accept-ranges','etag','last-modified','cache-control','expires']);
  if (payload.has(n))        return { cls: 'PayloadHeaders',        prop: 'payHeader' };
  if (representation.has(n)) return { cls: 'RepresentationHeaders', prop: 'repHeader' };
  return { cls: 'ResponseHeader', prop: 'resHeader' };
}

module.exports = { classifyRequestHeader, classifyResponseHeader };