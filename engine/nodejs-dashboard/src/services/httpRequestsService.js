/**
 * HTTP Requests Service
 *
 * Thin client for ingesting raw HTTP data, polling ingest results,
 * and browsing stored HTTP requests and derived findings.
 *
 * Endpoint Summary:
 * - POST /http-requests/ingest-http
 * - GET  /http-requests/results/:jobId
 * - GET  /http-requests/list
 * - GET  /http-requests/:id
 * - GET  /http-requests/finding/list
 * - GET  /http-requests/finding/:id
 */

import httpClient from './httpClient';

/**
 * Ingest raw HTTP requests (bulk payload).
 * POST /http-requests/ingest-http
 *
 * @param {object} payload - Backend-defined structure with HTTP entries.
 * @returns {Promise<any>} Acknowledgement or job metadata.
 */
export async function ingestHttpRequests(payload) {
  const res = await httpClient.post('/http-requests/ingest-http', payload);
  return res.data;
}

/**
 * Retrieve ingest job result.
 * GET /http-requests/results/:jobId
 *
 * @param {string} jobId - Identifier of the ingest job.
 * @returns {Promise<any>} Result object for the job.
 */
export async function getHttpIngestResult(jobId) {
  const res = await httpClient.get(`/http-requests/results/${encodeURIComponent(jobId)}`);
  return res.data;
}

/**
 * List stored HTTP requests with optional filters/pagination.
 * GET /http-requests/list
 *
 * @param {object} [params={}] - Query params (e.g., page, filters).
 * @returns {Promise<any>} Paginated list or array, as defined by backend.
 */
export async function listHttpRequests(params = {}) {
  const res = await httpClient.get('/http-requests/list', { params });
  return res.data;
}

/**
 * Fetch a single HTTP request by ID.
 * GET /http-requests/:id
 *
 * @param {string} id - Request identifier.
 * @returns {Promise<any>} The request document.
 */
export async function getHttpRequestById(id) {
  const res = await httpClient.get(`/http-requests/${encodeURIComponent(id)}`);
  return res.data;
}

/**
 * List findings derived from HTTP requests.
 * GET /http-requests/finding/list
 *
 * @param {object} [params={}] - Query params (e.g., severity, tags, paging).
 * @returns {Promise<any>} Findings collection.
 */
export async function listHttpFindings(params = {}) {
  const res = await httpClient.get('/http-requests/finding/list', { params });
  return res.data;
}

/**
 * Fetch a single HTTP finding by ID.
 * GET /http-requests/finding/:id
 *
 * @param {string} id - Finding identifier.
 * @returns {Promise<any>} The finding document.
 */
export async function getHttpFindingById(id) {
  const res = await httpClient.get(`/http-requests/finding/${encodeURIComponent(id)}`);
  return res.data;
}
