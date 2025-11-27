// @ts-check
/** @typedef {import('../_types/http/types').HttpRequest} HttpRequest */
/** @typedef {import('../_types/http/types').SelectFilters} SelectFilters */
/** @typedef {import('../_types/http/types').HttpHeader} HttpHeader */
/** @typedef {import('../_types/http/types').HeaderClassification} HeaderClassification */

const payloadReq = new Set([
  'content-type',
  'content-length',
  'content-encoding',
  'content-language',
  'content-location',
  'content-md5',
  'content-range',
]);

const representationReq = new Set([
  'accept',
  'accept-language',
  'accept-encoding',
  'accept-charset',
  'accept-datetime',
]);

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
 * - **Cookie** (linked with `ex:reqHeader`): the `Cookie` request header, modeled as
 *   a dedicated subclass of `RequestHeader` in the ontology
 *   → `cookie`
 * - **RequestHeader** (linked with `ex:reqHeader`): any other request header
 *
 * @param {string} [name=''] Raw header name (any case).
 * @returns {HeaderClassification} Object with ontology class `cls` and linking property `prop`.
 */
function classifyRequestHeader(name = '') {
  const n = String(name).toLowerCase();

  // Ontology v1.0.1: "Cookie" has its own class (ex:Cookie) as a subclass of RequestHeader.
  // We keep the link via ex:reqHeader to stay consistent with the domain/range.
  if (n === 'cookie') {
    return { cls: 'Cookie', prop: 'reqHeader' };
  }

  if (payloadReq.has(n)) {
    return { cls: 'PayloadHeaders', prop: 'payHeader' };
  }
  if (representationReq.has(n)) {
    return { cls: 'RepresentationHeaders', prop: 'repHeader' };
  }
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
 * - **Set-Cookie** (linked with `ex:resHeader`): the `Set-Cookie` response header, modeled as
 *   a dedicated subclass of `ResponseHeader` in the ontology
 *   → `set-cookie`
 * - **ResponseHeader** (linked with `ex:resHeader`): any other response header
 *
 * @param {string} [name=''] - Raw header name (any case).
 * @returns {HeaderClassification} An object with the ontology class `cls` and the linking property `prop`.
 */
function classifyResponseHeader(name = '') {
  const n = String(name).toLowerCase();

  // Ontology v1.0.1: "Set-Cookie" has its own class (ex:Set-Cookie)
  // as a subclass of ResponseHeader. We still link via ex:resHeader.
  if (n === 'set-cookie') {
    return { cls: 'Set-Cookie', prop: 'resHeader' };
  }

  const payload = new Set([
    'content-type',
    'content-length',
    'content-encoding',
    'content-language',
    'content-location',
    'content-md5',
    'content-range',
  ]);

  const representation = new Set([
    'vary',
    'accept-ranges',
    'etag',
    'last-modified',
    'cache-control',
    'expires',
  ]);

  if (payload.has(n)) {
    return { cls: 'PayloadHeaders', prop: 'payHeader' };
  }
  if (representation.has(n)) {
    return { cls: 'RepresentationHeaders', prop: 'repHeader' };
  }
  return { cls: 'ResponseHeader', prop: 'resHeader' };
}

module.exports = { classifyRequestHeader, classifyResponseHeader };
