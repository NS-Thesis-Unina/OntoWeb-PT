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
 * - ASK    → `{ head?: { ... }, boolean: boolean }`
 *
 * @param {string} sparql - The SPARQL query string (either SELECT or ASK).
 * @returns {Promise<SparqlJsonResult>} The SPARQL JSON result as specified by the W3C format.
 * @throws {Error} Throws an Error whose message is derived from the GraphDB response
 *                 or the underlying Axios error (code/message).
 */
async function runSelect(sparql) {
  const url = repoUrlBase();
  try {
    const res = await axios.post(url, `query=${encodeURIComponent(sparql)}`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/sparql-results+json',
      },
      timeout: 30000,
    });
    return res.data;
  } catch (err) {
    const e = /** @type {any} */ (err);
    const msg =
      e?.response?.data?.message ||
      e?.code ||
      e?.message ||
      'GraphDB SELECT error';
    throw new Error(msg);
  }
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
 * @throws {Error} Throws an Error whose message is derived from the GraphDB response
 *                 or the underlying Axios error (code/message).
 */
async function runUpdate(sparqlUpdate) {
  const url = `${repoUrlBase()}/statements`;
  try {
    const res = await axios.post(url, sparqlUpdate, {
      headers: { 'Content-Type': 'application/sparql-update' },
      timeout: 60000,
    });
    return res.status;
  } catch (err) {
    const e = /** @type {any} */ (err);
    const msg =
      e?.response?.data?.message ||
      e?.code ||
      e?.message ||
      'GraphDB UPDATE error';
    throw new Error(msg);
  }
}

module.exports = { runSelect, runUpdate };
