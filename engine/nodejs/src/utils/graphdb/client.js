// @ts-check

/** @typedef {import('../_types/graphdb/types').SparqlJsonResult} SparqlJsonResult */

const axios = require('axios').default;
const GRAPHDB_BASE = process.env.GRAPHDB_BASE;
const GRAPHDB_REPO = process.env.GRAPHDB_REPO;

/**
 * Compute the GraphDB repository base URL from environment variables.
 *
 * The URL has the form:
 *   `${GRAPHDB_BASE}/repositories/${encodeURIComponent(GRAPHDB_REPO)}`
 *
 * Required environment variables:
 * - GRAPHDB_BASE (e.g. "http://localhost:7200")
 * - GRAPHDB_REPO (e.g. "ontowebpt")
 *
 * @returns {string} The repository base URL (e.g. "http://localhost:7200/repositories/ontowebpt").
 * @throws {Error} If either GRAPHDB_BASE or GRAPHDB_REPO is not defined.
 *
 * @example
 * // Given:
 * //   process.env.GRAPHDB_BASE = "http://localhost:7200"
 * //   process.env.GRAPHDB_REPO = "ontowebpt"
 * const baseUrl = repoUrlBase();
 * // baseUrl === "http://localhost:7200/repositories/ontowebpt"
 */
function repoUrlBase() {
  if (!GRAPHDB_BASE || !GRAPHDB_REPO) {
    throw new Error('GRAPHDB_BASE and GRAPHDB_REPO must be set');
  }
  return `${GRAPHDB_BASE}/repositories/${encodeURIComponent(GRAPHDB_REPO)}`;
}

/**
 * Run a SPARQL SELECT or ASK against GraphDB over HTTP (synchronous request).
 *
 * - Endpoint: POST `${GRAPHDB_BASE}/repositories/${GRAPHDB_REPO}`
 * - Body: `query=<URL-encoded SPARQL>`
 * - Headers:
 *   - 'Content-Type': 'application/x-www-form-urlencoded'
 *   - 'Accept': 'application/sparql-results+json'
 * - Timeout: 30 seconds
 *
 * Returns the SPARQL JSON payload **as-is**:
 * - SELECT → `{ head: { vars: string[] }, results: { bindings: Record<string, {type,value,...}>[] } }`
 * - ASK    → `{ boolean: boolean }`
 *
 * @param {string} sparql - The SPARQL query string (either SELECT or ASK).
 * @returns {Promise<SparqlJsonResult>} The SPARQL JSON result as specified by the W3C format.
 * @throws {Error} Propagates Axios errors (network errors, non-2xx responses, timeouts).
 *
 * @example
 * // SELECT example
 * const q = `
 *   SELECT ?s ?p ?o
 *   WHERE { ?s ?p ?o }
 *   LIMIT 10
 * `;
 * const res = await runSelect(q);
 * if ('results' in res) {
 *   // Array of bindings: each binding has variables as keys and { type, value, ... } as cells
 *   console.log(res.results.bindings.map(row => row.s?.value));
 * }
 *
 * @example
 * // ASK example
 * const ask = `
 *   ASK { ?s a <http://example.com/SomeType> }
 * `;
 * const ok = await runSelect(ask);
 * if ('boolean' in ok && ok.boolean) {
 *   console.log('At least one resource of SomeType exists');
 * }
 */
async function runSelect(sparql) {
  const url = repoUrlBase();
  const res = await axios.post(url, `query=${encodeURIComponent(sparql)}`, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/sparql-results+json'
    },
    timeout: 30000
  });
  return res.data;
}

/**
 * Run a SPARQL UPDATE against GraphDB over HTTP (synchronous request).
 *
 * - Endpoint: POST `${GRAPHDB_BASE}/repositories/${GRAPHDB_REPO}/statements`
 * - Body: raw SPARQL UPDATE string (INSERT/DELETE/etc.)
 * - Headers:
 *   - 'Content-Type': 'application/sparql-update'
 * - Timeout: 60 seconds
 *
 * Returns the HTTP status code (e.g., 204 on success). GraphDB handles persistence internally.
 *
 * @param {string} sparqlUpdate - The SPARQL UPDATE statement (e.g., INSERT DATA / DELETE WHERE / DELETE/INSERT ... WHERE).
 * @returns {Promise<number>} The HTTP status code from the GraphDB response.
 * @throws {Error} Propagates Axios errors (network errors, non-2xx responses, timeouts).
 *
 * @example
 * // INSERT DATA into a named graph
 * const status = await runUpdate(`
 *   INSERT DATA {
 *     GRAPH <http://example.com/graphs/http-requests> {
 *       <urn:ex:s> <urn:ex:p> "o"
 *     }
 *   }
 * `);
 * if (status === 204) {
 *   console.log('Update applied successfully');
 * }
 *
 * @example
 * // DELETE WHERE pattern
 * const del = await runUpdate(`
 *   WITH <http://example.com/graphs/http-requests>
 *   DELETE { ?s ?p ?o }
 *   WHERE  { ?s ?p ?o FILTER(?p = <urn:ex:p>) }
 * `);
 * console.log('HTTP status:', del); // usually 204
 */
async function runUpdate(sparqlUpdate) {
  const url = `${repoUrlBase()}/statements`;
  const res = await axios.post(url, sparqlUpdate, {
    headers: { 'Content-Type': 'application/sparql-update' },
    timeout: 60000
  });
  return res.status;
}

module.exports = { runSelect, runUpdate };
