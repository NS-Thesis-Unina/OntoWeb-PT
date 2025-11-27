// @ts-check

/** @typedef {import('../../_types/http/builders/types').HttpRequest} HttpRequest */
/** @typedef {import('../../_types/http/builders/types').SelectFilters} SelectFilters */
/** @typedef {import('../../_types/http/builders/types').HttpHeader} HttpHeader */
/** @typedef {import('../../_types/http/builders/types').BuilderRequestInput} BuilderRequestInput */
/** @typedef {import('../../_types/http/builders/types').InsertItem} InsertItem */

const { EX, CONTENT, G_HTTP } = require('../../constants');
const extractTriplesForSingleRequest = require('./extractTriples');

/**
 * Build a single `INSERT DATA` SPARQL statement for **one HTTP request**.
 *
 * The function:
 * 1) Selects the target graph from `p.graph` or falls back to `G_HTTP`.
 * 2) Calls `extractTriplesForSingleRequest(p)` to generate all RDF triple lines for the request.
 * 3) Emits a complete `INSERT DATA` block with common prefixes and a single `GRAPH <...> { ... }`.
 *
 * **Prefixes included**:
 * - `ex:`      → ontology base from `EX`
 * - `content:` → for `ContentAsBase64`
 * - `rdf:`, `rdfs:` (common RDF schema prefixes)
 *
 * **Validation & errors**:
 * - `extractTriplesForSingleRequest` throws if required fields are missing (`id`, `method`, `uri.full`).
 *
 * @param {Partial<InsertItem>} [p={}] - The request to insert. Must contain at least `id`, `method`, and `uri.full`; other fields (headers, params, response, connection, etc.) are optional.
 * @returns {string} A complete `INSERT DATA` statement that inserts the request into the chosen named graph.
 *
 * @example
 * // Minimal insert
 * const sparql = buildInsertFromHttpRequest({
 *   id: "req-001",
 *   method: "GET",
 *   uri: { full: "https://api.example.com/v1/search?q=node" }
 * });
 *
 * @example
 * // Insert into a custom graph
 * const sparql2 = buildInsertFromHttpRequest({
 *   id: "req-002",
 *   method: "POST",
 *   uri: { full: "https://api.example.com/v1/items" },
 *   graph: "http://example.com/graphs/http-requests"
 * });
 *
 * @example
 * // Rich request with headers, params, and response
 * const sparql3 = buildInsertFromHttpRequest({
 *   id: "req-003",
 *   method: "GET",
 *   httpVersion: "HTTP/1.1",
 *   uri: {
 *     full: "https://api.example.com/v1/search?q=node",
 *     scheme: "https",
 *     authority: "api.example.com",
 *     path: "/v1/search",
 *     params: [{ name: "q", value: "node" }]
 *   },
 *   requestHeaders: [{ name: "Accept", value: "application/json" }],
 *   response: {
 *     status: 200,
 *     reason: "OK",
 *     headers: [{ name: "Content-Type", value: "application/json" }]
 *   }
 * });
 */
function buildInsertFromHttpRequest(p = {}) {
  const g = p.graph || G_HTTP;
  const triples = extractTriplesForSingleRequest(p);
  return `
PREFIX ex: <${EX}>
PREFIX content: <${CONTENT}>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
INSERT DATA {
  GRAPH <${g}> {
    ${triples.join('\n    ')}
  }
}`.trim();
}

module.exports = buildInsertFromHttpRequest;
