import httpClient from './httpClient';

/**
 * POST /analyzer/analyze
 */
export async function analyzeWithAnalyzer(body) {
  const res = await httpClient.post('/analyzer/analyze', body);
  return res.data;
}

/**
 * GET /analyzer/results/:jobId
 */
export async function getAnalyzerResult(jobId) {
  const res = await httpClient.get(`/analyzer/results/${encodeURIComponent(jobId)}`);
  return res.data;
}

/**
 * GET /analyzer/finding/list
 */
export async function listAnalyzerFindings(params = {}) {
  const res = await httpClient.get('/analyzer/finding/list', { params });
  return res.data;
}

/**
 * GET /analyzer/finding/:id
 */
export async function getAnalyzerFindingById(id) {
  const res = await httpClient.get(`/analyzer/finding/${encodeURIComponent(id)}`);
  return res.data;
}
