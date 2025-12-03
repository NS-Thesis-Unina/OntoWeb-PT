/**
 * Tech Stack Service
 *
 * Thin HTTP wrapper around backend endpoints that perform technology
 * detection/analysis and expose results and findings.
 *
 * Conventions:
 * - Returns `res.data` directly; caller handles shape/typing.
 * - `jobId`/`id` values are URI-encoded for safety.
 */

import httpClient from './httpClient';

/**
 * Analyze a target to extract its technology stack.
 * POST /techstack/analyze
 *
 * @param {object} body - Request payload required by the backend analyzer.
 * @returns {Promise<any>} Response payload (e.g., job metadata or immediate result).
 */
export async function analyzeTechstack(body) {
  const res = await httpClient.post('/techstack/analyze', body);
  return res.data;
}

/**
 * Retrieve analysis result for a submitted job.
 * GET /techstack/results/:jobId
 *
 * @param {string} jobId - Identifier of the analysis job.
 * @returns {Promise<any>} Result document for the given job.
 */
export async function getTechstackResult(jobId) {
  const res = await httpClient.get(`/techstack/results/${encodeURIComponent(jobId)}`);
  return res.data;
}

/**
 * List tech stack findings with optional filters/pagination.
 * GET /techstack/finding/list
 *
 * @param {object} [params={}] - Query parameters (page, filters, etc.).
 * @returns {Promise<any>} A paginated list or array of findings (backend-defined).
 */
export async function listTechstackFindings(params = {}) {
  const res = await httpClient.get('/techstack/finding/list', { params });
  return res.data;
}

/**
 * Fetch a single tech stack finding by identifier.
 * GET /techstack/finding/:id
 *
 * @param {string} id - Finding identifier.
 * @returns {Promise<any>} The requested finding document.
 */
export async function getTechstackFindingById(id) {
  const res = await httpClient.get(`/techstack/finding/${encodeURIComponent(id)}`);
  return res.data;
}
