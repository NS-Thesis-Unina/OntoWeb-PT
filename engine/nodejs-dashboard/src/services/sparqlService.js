import httpClient from './httpClient';

/**
 * POST /sparql/query
 * @param {string} sparql
 */
export async function runSparqlQuery(sparql) {
  const res = await httpClient.post('/sparql/query', { sparql });
  return res.data;
}

/**
 * POST /sparql/update
 * @param {string} sparqlUpdate
 */
export async function enqueueSparqlUpdate(sparqlUpdate) {
  const res = await httpClient.post('/sparql/update', { sparqlUpdate });
  return res.data;
}
