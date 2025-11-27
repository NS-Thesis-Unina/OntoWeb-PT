// @ts-check

/** @typedef {import('../../_types/http/builders/types').HttpRequest} HttpRequest */
/** @typedef {import('../../_types/http/builders/types').SelectFilters} SelectFilters */
/** @typedef {import('../../_types/http/builders/types').HttpHeader} HttpHeader */
/** @typedef {import('../../_types/http/builders/types').BuilderRequestInput} BuilderRequestInput */
/** @typedef {import('../../_types/http/builders/types').InsertItem} InsertItem */

const { EX, CONTENT, G_HTTP } = require('../../constants');
const extractTriplesForSingleRequest = require('./extractTriples');

/**
 * Build a single `INSERT DATA` SPARQL statement that covers **multiple HTTP requests**,
 * grouping the generated triples by named graph.
 *
 * For each item in `list`, the function:
 * 1) Picks the target graph from `item.graph` or falls back to `defaultGraph`.
 * 2) Calls `extractTriplesForSingleRequest(item)` to generate the RDF triples (as strings).
 * 3) Accumulates triples per-graph and finally emits one `INSERT DATA { GRAPH <g> { ... } }` block per graph.
 *
 * **Prefixes included**:
 * - `ex:` (ontology base from `EX`)
 * - `content:` (for `ContentAsBase64`)
 * - `rdf:`, `rdfs:` (common RDF schema prefixes)
 *
 * **Validation & errors**:
 * - Throws if `list` is not a non-empty array.
 * - `extractTriplesForSingleRequest` will throw if an item is missing required fields (`id`, `method`, `uri.full`).
 *
 * @param {Array<Partial<InsertItem>>} [list=[]] - Array of requests to insert. Each item should provide at least `id`, `method`, and `uri.full`; other fields are optional.
 * @param {string} [defaultGraph=G_HTTP] - Fallback named graph IRI used when an item has no `graph` property.
 * @returns {string} A complete `INSERT DATA` SPARQL statement with one `GRAPH <...>` block per group.
 *
 * @example
 * // Minimal inputs (two requests, different graphs)
 * const sparql = buildInsertFromHttpRequestsArray([
 *   {
 *     id: "req-001",
 *     method: "GET",
 *     uri: { full: "https://api.example.com/v1/search?q=node" },
 *     graph: "http://example.com/graphs/http-requests"
 *   },
 *   {
 *     id: "req-002",
 *     method: "POST",
 *     uri: { full: "https://api.example.com/v1/items" }
 *     // no graph -> will use defaultGraph
 *   }
 * ], "http://example.com/graphs/default");
 * // Result: INSERT DATA with two GRAPH blocks (one for each graph).
 *
 * @example
 * // Rich input with headers/params/response
 * const sparql2 = buildInsertFromHttpRequestsArray([{
 *   id: "req-003",
 *   method: "GET",
 *   httpVersion: "HTTP/1.1",
 *   uri: {
 *     full: "https://api.example.com/v1/search?q=node",
 *     scheme: "https", authority: "api.example.com", path: "/v1/search",
 *     params: [{ name: "q", value: "node" }]
 *   },
 *   requestHeaders: [{ name: "Accept", value: "application/json" }],
 *   response: {
 *     status: 200,
 *     reason: "OK",
 *     headers: [{ name: "Content-Type", value: "application/json" }]
 *   }
 * }]);
 *
 * @example
 * // Error: empty list
 * buildInsertFromHttpRequestsArray([]); // throws Error("Expected a non-empty array of requests")
 */
function buildInsertFromHttpRequestsArray(list = [], defaultGraph = G_HTTP) {
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('Expected a non-empty array of requests');
  }
  const graphs = new Map();

  for (const p of list) {
    const g = p.graph || defaultGraph;
    const triples = extractTriplesForSingleRequest(p);
    if (!graphs.has(g)) graphs.set(g, []);
    graphs.get(g).push(...triples);
  }

  const parts = [
    `PREFIX ex: <${EX}>`,
    `PREFIX content: <${CONTENT}>`,
    `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>`,
    `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>`,
    `INSERT DATA {`,
  ];

  for (const [g, triples] of graphs.entries()) {
    parts.push(`  GRAPH <${g}> {`);
    parts.push(`    ${triples.join('\n    ')}`);
    parts.push(`  }`);
  }
  parts.push(`}`);

  return parts.join('\n');
}

module.exports = buildInsertFromHttpRequestsArray;
