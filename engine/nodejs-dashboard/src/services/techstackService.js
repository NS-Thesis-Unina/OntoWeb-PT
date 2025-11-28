import httpClient from './httpClient';

/**
 * POST /techstack/analyze
 */
export async function analyzeTechstack(body) {
  const res = await httpClient.post('/techstack/analyze', body);
  return res.data;
}

/**
 * GET /techstack/results/:jobId
 */
export async function getTechstackResult(jobId) {
  const res = await httpClient.get(`/techstack/results/${encodeURIComponent(jobId)}`);
  return res.data;
}

/**
 * GET /techstack/finding/list
 */
export async function listTechstackFindings(params = {}) {
  const res = await httpClient.get('/techstack/finding/list', { params });
  return res.data;
}

/**
 * GET /techstack/finding/:id
 */
export async function getTechstackFindingById(id) {
  const res = await httpClient.get(`/techstack/finding/${encodeURIComponent(id)}`);
  return res.data;
}
