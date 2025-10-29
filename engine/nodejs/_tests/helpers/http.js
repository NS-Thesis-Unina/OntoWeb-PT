// @ts-check

// CommonJS HTTP clients for API (via Nginx) and GraphDB.
const axios = require('axios').default;

/** @type {string} */
const API_BASE = process.env.TEST_API_BASE || 'http://localhost';
/** @type {string} */
const GRAPHDB_BASE = process.env.TEST_GRAPHDB_BASE || 'http://localhost:7200';
/** @type {string} */
const GRAPHDB_REPO = process.env.TEST_GRAPHDB_REPO || 'ontowebpt';

/** @type {import('axios').AxiosInstance} */
const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  validateStatus: s => s >= 200 && s < 500
});

/** @type {import('axios').AxiosInstance} */
const graphdb = axios.create({
  baseURL: `${GRAPHDB_BASE}`,
  timeout: 15000,
  validateStatus: s => s >= 200 && s < 500
});

/**
 * GET /health (proxied by Nginx to Node).
 * @returns {Promise<import('axios').AxiosResponse<any>>}
 */
async function getHealth() {
  return api.get('/health');
}

/**
 * POST /http-requests/ingest-http
 * @param {any} body Request body (object/array/{ items: [...] }).
 * @returns {Promise<import('axios').AxiosResponse<any>>}
 */
async function postIngestHttp(body) {
  return api.post('/http-requests/ingest-http', body, {
    headers: { 'content-type': 'application/json' }
  });
}

/**
 * GraphDB SELECT/ASK: POST x-www-form-urlencoded to /repositories/<repo>.
 * @param {string} query SPARQL query (SELECT/ASK).
 * @returns {Promise<import('axios').AxiosResponse<any>>}
 */
async function postGraphDBSelect(query) {
  const url = `/repositories/${encodeURIComponent(GRAPHDB_REPO)}`;
  const params = new URLSearchParams();
  params.set('query', query);
  return graphdb.post(url, params.toString(), {
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'accept': 'application/sparql-results+json'
    }
  });
}

/**
 * GraphDB UPDATE: POST raw SPARQL UPDATE to /repositories/<repo>/statements.
 * @param {string} update SPARQL UPDATE string.
 * @returns {Promise<import('axios').AxiosResponse<any>>}
 */
async function postGraphDBUpdate(update) {
  const url = `/repositories/${encodeURIComponent(GRAPHDB_REPO)}/statements`;
  return graphdb.post(url, update, {
    headers: { 'content-type': 'application/sparql-update' }
  });
}

/**
 * GET /http-requests/list with query params (filters + pagination).
 * @param {Record<string, any>} [params]
 * @returns {Promise<import('axios').AxiosResponse<any>>}
 */
async function getHttpRequestsList(params = {}) {
  return api.get('/http-requests/list', { params });
}

/**
 * GET /http-requests/:id
 * @param {string} id Request id.
 * @returns {Promise<import('axios').AxiosResponse<any>>}
 */
async function getHttpRequestById(id) {
  return api.get(`/http-requests/${encodeURIComponent(id)}`);
}

/**
 * POST /sparql/query expecting { sparql } in JSON body.
 * Returns { data: <SPARQL-JSON> } in the response payload.
 * @param {string} sparql SPARQL SELECT/ASK query.
 * @returns {Promise<import('axios').AxiosResponse<any>>}
 */
async function postSparqlQuery(sparql) {
  return api.post('/sparql/query', { sparql }, {
    headers: {
      'content-type': 'application/json',
      'accept': 'application/sparql-results+json'
    }
  });
}

/**
 * POST /sparql/update expecting { sparqlUpdate } in JSON body (async enqueue).
 * @param {string} sparqlUpdate SPARQL UPDATE statement.
 * @returns {Promise<import('axios').AxiosResponse<any>>}
 */
async function postSparqlUpdate(sparqlUpdate) {
  return api.post('/sparql/update', { sparqlUpdate }, {
    headers: { 'content-type': 'application/json' }
  });
}

/**
 * Extract a job identifier from a variety of accepted shapes.
 * Examples: { jobId }, { jobIds: [id, ...] }, { id }.
 * @param {any} payload Response data payload.
 * @returns {string|null} The first job id found, or null if none is present.
 */
function extractJobId(payload) {
  if (!payload) return null;
  if (typeof payload.jobId === 'string' || typeof payload.jobId === 'number') return String(payload.jobId);
  if (Array.isArray(payload.jobIds) && payload.jobIds.length) return String(payload.jobIds[0]);
  if (typeof payload.id === 'string' || typeof payload.id === 'number') return String(payload.id);
  return null;
}

module.exports = {
  api,
  graphdb,
  getHealth,
  postIngestHttp,
  postGraphDBSelect,
  postGraphDBUpdate,
  getHttpRequestsList,
  getHttpRequestById,
  postSparqlQuery,
  postSparqlUpdate,
  extractJobId,
  API_BASE,
  GRAPHDB_BASE,
  GRAPHDB_REPO
};
