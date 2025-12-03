/**
 * Analyzer Service
 *
 * Client for running Analyzer tasks, polling results, and retrieving findings.
 *
 * Endpoint Summary:
 * - POST /analyzer/analyze
 * - GET  /analyzer/results/:jobId
 * - GET  /analyzer/finding/list
 * - GET  /analyzer/finding/:id
 */

import httpClient from './httpClient';

/**
 * Submit an analysis job to the Analyzer.
 * POST /analyzer/analyze
 *
 * @param {object} body - Analyzer request payload (backend-defined).
 * @returns {Promise<any>} Acknowledgement or job metadata.
 */
export async function analyzeWithAnalyzer(body) {
  const res = await httpClient.post('/analyzer/analyze', body);
  return res.data;
}

/**
 * Retrieve results for a specific Analyzer job.
 * GET /analyzer/results/:jobId
 *
 * @param {string} jobId - Identifier of the analysis job.
 * @returns {Promise<any>} Result document.
 */
export async function getAnalyzerResult(jobId) {
  const res = await httpClient.get(`/analyzer/results/${encodeURIComponent(jobId)}`);
  return res.data;
}

/**
 * List Analyzer findings with optional filters/pagination.
 * GET /analyzer/finding/list
 *
 * @param {object} [params={}] - Query params (e.g., page, filters).
 * @returns {Promise<any>} Findings list/collection.
 */
export async function listAnalyzerFindings(params = {}) {
  const res = await httpClient.get('/analyzer/finding/list', { params });
  return res.data;
}

/**
 * Fetch a single Analyzer finding by ID.
 * GET /analyzer/finding/:id
 *
 * @param {string} id - Finding identifier.
 * @returns {Promise<any>} The finding document.
 */
export async function getAnalyzerFindingById(id) {
  const res = await httpClient.get(`/analyzer/finding/${encodeURIComponent(id)}`);
  return res.data;
}
