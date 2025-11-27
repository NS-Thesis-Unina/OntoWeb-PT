// @ts-check

/** @typedef {import('../_types/iri/types').IriString} IriString */
/** @typedef {import('../_types/iri/types').RequestId} RequestId */
/** @typedef {import('../_types/iri/types').HeaderIndex} HeaderIndex */
/** @typedef {import('../_types/iri/types').ParamIndex} ParamIndex */

/**
 * Percent-encode a fragment so it is safe inside URN/IRI segments.
 *
 * Uses `encodeURIComponent` to escape any character that might break the
 * structure of the synthetic URNs used throughout the HTTP request domain.
 * This function is NOT meant to be applied to full IRIs with scheme/host,
 * but only to the dynamic fragments (ids, indexes, etc.).
 *
 * @param {string} [s=''] - Raw fragment value.
 * @returns {string} Percent-encoded fragment safe for embedding in URN parts.
 *
 * @example
 * iriFragmentSafe('req 1/α'); // "req%201%2F%CE%B1"
 */
function iriFragmentSafe(s = '') {
  return encodeURIComponent(String(s));
}

/**
 * Build the base URN for a request resource.
 *
 * Shape:
 *   `urn:req:{id}`
 *
 * @param {RequestId} id - Request identifier (will be fragment-escaped).
 * @returns {IriString} A URN identifying the request (e.g., "urn:req:req-001").
 *
 * @example
 * iriRequest('req-001'); // "urn:req:req-001"
 */
function iriRequest(id) {
  return `urn:req:${iriFragmentSafe(id)}`;
}

/**
 * Build the URN for the request's URI node.
 *
 * Shape:
 *   `urn:req:{id}:uri`
 *
 * @param {RequestId} id - Request identifier.
 * @returns {IriString} A URN for the URI resource of the request.
 *
 * @example
 * iriURI('req-001'); // "urn:req:req-001:uri"
 */
function iriURI(id) {
  return `urn:req:${iriFragmentSafe(id)}:uri`;
}

/**
 * Build the URN for a **request** header resource (by index).
 *
 * Shape:
 *   `urn:req:{id}:hdr:{i}`
 *
 * @param {RequestId} id - Request identifier.
 * @param {HeaderIndex} i - Zero-based header index (or a stable key).
 * @returns {IriString} A URN for the i-th request header.
 *
 * @example
 * iriHeader('req-001', 0); // "urn:req:req-001:hdr:0"
 */
function iriHeader(id, i) {
  return `urn:req:${iriFragmentSafe(id)}:hdr:${i}`;
}

/**
 * Build the URN for a query **parameter** resource (by index).
 *
 * Shape:
 *   `urn:req:{id}:param:{i}`
 *
 * @param {RequestId} id - Request identifier.
 * @param {ParamIndex} i - Zero-based parameter index (or a stable key).
 * @returns {IriString} A URN for the i-th query parameter.
 *
 * @example
 * iriParam('req-001', 1); // "urn:req:req-001:param:1"
 */
function iriParam(id, i) {
  return `urn:req:${iriFragmentSafe(id)}:param:${i}`;
}

/**
 * Build the URN for the **response** node of a request.
 *
 * Shape:
 *   `urn:req:{id}:res`
 *
 * @param {RequestId} id - Request identifier.
 * @returns {IriString} A URN for the response resource.
 *
 * @example
 * iriResponse('req-001'); // "urn:req:req-001:res"
 */
function iriResponse(id) {
  return `urn:req:${iriFragmentSafe(id)}:res`;
}

/**
 * Build the URN for a **response** header resource (by index).
 *
 * Shape:
 *   `urn:req:{id}:resh:{i}`
 *
 * @param {RequestId} id - Request identifier.
 * @param {HeaderIndex} i - Zero-based response header index (or a stable key).
 * @returns {IriString} A URN for the i-th response header.
 *
 * @example
 * iriResHeader('req-001', 2); // "urn:req:req-001:resh:2"
 */
function iriResHeader(id, i) {
  return `urn:req:${iriFragmentSafe(id)}:resh:${i}`;
}

/**
 * Build the URN for the **status** node of a response.
 *
 * Shape:
 *   `urn:req:{id}:sc`
 *
 * @param {RequestId} id - Request identifier.
 * @returns {IriString} A URN for the response status node.
 *
 * @example
 * iriStatus('req-001'); // "urn:req:req-001:sc"
 */
function iriStatus(id) {
  return `urn:req:${iriFragmentSafe(id)}:sc`;
}

/**
 * Build the URN for the **connection** node associated with a request.
 *
 * Shape:
 *   `urn:req:{id}:conn`
 *
 * @param {RequestId} id - Request identifier.
 * @returns {IriString} A URN for the connection node.
 *
 * @example
 * iriConnection('req-001'); // "urn:req:req-001:conn"
 */
function iriConnection(id) {
  return `urn:req:${iriFragmentSafe(id)}:conn`;
}

module.exports = {
  iriFragmentSafe,
  iriRequest,
  iriURI,
  iriHeader,
  iriParam,
  iriResponse,
  iriResHeader,
  iriStatus,
  iriConnection,
};
