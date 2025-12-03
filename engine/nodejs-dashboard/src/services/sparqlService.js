/**
 * SPARQL Service
 *
 * Minimal client for running SPARQL queries and queueing updates against
 * the backend. Queries return data immediately; updates may be enqueued
 * for asynchronous processing depending on server behavior.
 *
 * Notes:
 * - No client-side parsing of results; consumers should interpret the shape.
 */

import httpClient from './httpClient';

/**
 * Execute a SPARQL SELECT/ASK/DESCRIBE/CONSTRUCT query.
 * POST /sparql/query
 *
 * @param {string} sparql - Raw SPARQL query string.
 * @returns {Promise<any>} Query result as returned by the backend.
 */
export async function runSparqlQuery(sparql) {
  const res = await httpClient.post('/sparql/query', { sparql });
  return res.data;
}

/**
 * Enqueue a SPARQL UPDATE statement.
 * POST /sparql/update
 *
 * @param {string} sparqlUpdate - Raw SPARQL UPDATE statement.
 * @returns {Promise<any>} Backend acknowledgement or job metadata.
 */
export async function enqueueSparqlUpdate(sparqlUpdate) {
  const res = await httpClient.post('/sparql/update', { sparqlUpdate });
  return res.data;
}
