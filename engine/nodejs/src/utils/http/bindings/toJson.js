// @ts-check

/** @typedef {import('../../_types/http/bindings/types').HttpRequest} HttpRequest */
/** @typedef {import('../../_types/http/bindings/types').SelectFilters} SelectFilters */
/** @typedef {import('../../_types/http/bindings/types').HttpHeader} HttpHeader */
/** @typedef {import('../../_types/http/bindings/types').HttpRequestList} HttpRequestList */
/** @typedef {import('../../_types/http/bindings/types').HttpRequestFromBindings} HttpRequestFromBindings */
/** @typedef {import('../../_types/graphdb/types').SparqlBindingCell} SparqlBindingCell */

/**
 * A single SPARQL binding row as returned by GraphDB for SELECT queries.
 * Keys are variable names, values are SPARQL binding cells.
 *
 * @typedef {Record<string, SparqlBindingCell>} SparqlBindingRow
 */

const { G_HTTP } = require('../../constants');

/**
 * Transform SPARQL JSON bindings into normalized HTTP request JSON objects.
 *
 * This function groups rows by `id` and builds a compact HTTP request structure:
 * - Deduplicates request headers.
 * - Collects query params under `uri.params` and synthesizes `uri.queryRaw` when missing.
 * - Optionally attaches `connection.authority`.
 * - Optionally attaches `response` (status/reason/httpVersion/bodyBase64/headers) when present.
 * - Removes empty/undefined properties for a clean shape.
 *
 * Input shape expectation (per binding row):
 * - `id`, `httpVersion`, `methodName`
 * - `uriFull`, `scheme`, `authority`, `path`, `fragment`
 * - `hdrName`, `hdrValue` (request headers)
 * - `paramName`, `paramValue` (query parameters)
 * - `connAuthority`
 * - `resHttpVersion`, `resBodyBase64`, `statusCodeNumber`, `reasonPhrase`
 * - `rhdrName`, `rhdrValue` (response headers)
 *
 * The returned structure matches {@link HttpRequestList}, where each item
 * is an {@link HttpRequestFromBindings} (base HttpRequest plus `graph`,
 * `connection`, `response`, `uri.params`, `uri.queryRaw`).
 *
 * @param {SparqlBindingRow[]} bindings - SPARQL JSON `results.bindings` array (W3C format).
 * @returns {HttpRequestList} Object containing the normalized items `{ items: HttpRequestFromBindings[] }`.
 *
 * @example
 * // Given `bindings` from a SELECT, turn them into normalized requests:
 * const { items } = bindingsToRequestsJson(results.bindings);
 * console.log(items.length); // number of distinct requests by id
 *
 * @example
 * // Access headers and query params:
 * const first = bindingsToRequestsJson(results.bindings).items[0];
 * console.log(first.requestHeaders?.map(h => `${h.name}: ${h.value}`));
 * console.log(first.uri?.params); // [{ name, value }, ...]
 */
function bindingsToRequestsJson(bindings) {
  const byId = new Map();

  for (const b of bindings) {
    const id = valueOf(b.id);
    if (!id) continue;

    if (!byId.has(id)) {
      byId.set(id, {
        id,
        httpVersion: valueOf(b.httpVersion) || undefined,
        method: valueOf(b.methodName) || undefined,
        uri: {
          full: valueOf(b.uriFull) || undefined,
          scheme: valueOf(b.scheme) || undefined,
          authority: valueOf(b.authority) || undefined,
          path: valueOf(b.path) || undefined,
          fragment: valueOf(b.fragment) || undefined,
        },
        requestHeaders: [],
        bodyBase64: valueOf(b.bodyBase64) || '',
        graph: G_HTTP,
        response: undefined,
        connection: undefined,
      });
    }

    const obj = byId.get(id);

    // Request headers
    const hn = valueOf(b.hdrName);
    if (hn) {
      const hv = valueOf(b.hdrValue) ?? '';
      if (!obj.requestHeaders.some((h) => h.name === hn && h.value === hv)) {
        obj.requestHeaders.push({ name: hn, value: hv });
      }
    }

    // Params
    const pn = valueOf(b.paramName);
    if (pn) {
      const pv = valueOf(b.paramValue) ?? '';
      obj.uri.params ||= [];
      if (!obj.uri.params.some((p) => p.name === pn && String(p.value ?? '') === pv)) {
        obj.uri.params.push({ name: pn, value: pv });
      }
    }

    // Connection
    const connAuthority = valueOf(b.connAuthority);
    if (connAuthority) {
      obj.connection ||= {};
      obj.connection.authority = connAuthority;
    }

    // Response basics
    const resHttpVer = valueOf(b.resHttpVersion);
    const resBody = valueOf(b.resBodyBase64);
    const scNum = valueOf(b.statusCodeNumber);
    const scReason = valueOf(b.reasonPhrase);
    if (resHttpVer || resBody || scNum || scReason) {
      obj.response ||= {};
      if (resHttpVer) obj.response.httpVersion = resHttpVer;
      if (resBody) obj.response.bodyBase64 = resBody;
      if (scNum !== undefined) obj.response.status = Number(scNum);
      if (scReason) obj.response.reason = scReason;
    }

    // Response headers
    const rhn = valueOf(b.rhdrName);
    if (rhn) {
      const rhv = valueOf(b.rhdrValue) ?? '';
      obj.response ||= {};
      obj.response.headers ||= [];
      if (!obj.response.headers.some((h) => h.name === rhn && h.value === rhv)) {
        obj.response.headers.push({ name: rhn, value: rhv });
      }
    }
  }

  // Post-process cleanup & normalization
  for (const r of byId.values()) {
    if (r.requestHeaders?.length) r.requestHeaders.sort((a, b) => a.name.localeCompare(b.name));
    if (r.uri?.params?.length) {
      r.uri.params.sort((a, b) => a.name.localeCompare(b.name));
      if (!r.uri.queryRaw) {
        r.uri.queryRaw = r.uri.params
          .map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.value ?? '')}`)
          .join('&');
      }
    }

    // Remove empties
    if (!r.httpVersion) delete r.httpVersion;
    if (!r.uri.fragment) delete r.uri.fragment;
    if (!r.uri.scheme) delete r.uri.scheme;
    if (!r.uri.authority) delete r.uri.authority;
    if (!r.uri.path) delete r.uri.path;
    if (!r.uri.full) delete r.uri.full;
    if (!r.uri.queryRaw) delete r.uri.queryRaw;
    if (!r.uri.params || r.uri.params.length === 0) delete r.uri.params;
    if (!r.requestHeaders || r.requestHeaders.length === 0) delete r.requestHeaders;
    if (!r.bodyBase64) delete r.bodyBase64;

    if (r.response) {
      if (!r.response.httpVersion) delete r.response.httpVersion;
      if (!('status' in r.response)) delete r.response.status;
      if (!r.response.reason) delete r.response.reason;
      if (!r.response.bodyBase64) delete r.response.bodyBase64;
      if (!r.response.headers || r.response.headers.length === 0) delete r.response.headers;
      if (Object.keys(r.response).length === 0) delete r.response;
    }

    if (r.connection && !r.connection.authority) delete r.connection;
  }

  return { items: Array.from(byId.values()) };
}

/**
 * Extract the raw string value from a SPARQL binding term.
 *
 * Expects a cell like `{ type: 'literal' | 'uri' | 'bnode', value: string, ... }`
 * and returns the `value` field, or `undefined` if the term is null/invalid.
 *
 * @param {any} bindingTerm - A single binding cell from the SPARQL JSON.
 * @returns {string|undefined} The raw value string, or `undefined` when not present.
 *
 * @example
 * valueOf({ type: 'literal', value: 'GET' }) // "GET"
 * valueOf(null) // undefined
 */
function valueOf(bindingTerm) {
  if (!bindingTerm) return undefined;
  if (Object.prototype.hasOwnProperty.call(bindingTerm, 'value')) return bindingTerm.value;
  return undefined;
}

module.exports = bindingsToRequestsJson;
