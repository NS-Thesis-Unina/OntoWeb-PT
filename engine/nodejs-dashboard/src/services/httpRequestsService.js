import httpClient from './httpClient';

/**
 * POST /http-requests/ingest-http
 */
export async function ingestHttpRequests(payload) {
  const res = await httpClient.post('/http-requests/ingest-http', payload);
  return res.data;
}

/**
 * GET /http-requests/results/:jobId
 */
export async function getHttpIngestResult(jobId) {
  const res = await httpClient.get(`/http-requests/results/${encodeURIComponent(jobId)}`);
  return res.data;
}

/**
 * GET /http-requests/list
 * @param {object} params
 */
export async function listHttpRequests(params = {}) {
  const res = await httpClient.get('/http-requests/list', { params });
  return res.data;
}

/**
 * GET /http-requests/:id
 */
export async function getHttpRequestById(id) {
  const res = await httpClient.get(`/http-requests/${encodeURIComponent(id)}`);
  return res.data;
}

/**
 * GET /http-requests/finding/list
 */
export async function listHttpFindings(params = {}) {
  const res = await httpClient.get('/http-requests/finding/list', { params });
  return res.data;
}

/**
 * GET /http-requests/finding/:id
 */
export async function getHttpFindingById(id) {
  const res = await httpClient.get(`/http-requests/finding/${encodeURIComponent(id)}`);
  return res.data;
}
