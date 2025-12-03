/**
 * Health Service
 *
 * Retrieves overall health information for the backend and derives a compact
 * UI status for the tool. Intended for status badges, headers, and diagnostics.
 *
 * Endpoint:
 * - GET /health
 */

import httpClient from './httpClient';

/**
 * Fetch overall health from the backend.
 * GET /health
 *
 * @returns {Promise<{ok: boolean, components: Record<string, string>}>}
 */
export async function getHealth() {
  const res = await httpClient.get('/health');
  return res.data;
}

/**
 * Derive a coarse-grained status for the UI given the /health payload.
 *
 * States:
 * - "tool_on"   -> ok === true AND all components report 'up'
 * - "checking"  -> not ok, but at least one component is up (partial availability)
 * - "tool_off"  -> no health object, API unreachable, or all components down
 *
 * @param {{ok?: boolean, components?: Record<string,string>} | null} health
 * @returns {'tool_on' | 'checking' | 'tool_off'}
 */
export function deriveToolStatus(health) {
  if (!health) return 'tool_off';

  const ok = health.ok;
  const components = health.components || {};
  const values = Object.values(components);
  const hasComponents = values.length > 0;

  const allUp = hasComponents && values.every((v) => v === 'up');
  const noneUp = hasComponents && values.every((v) => v !== 'up');

  if (ok === true && allUp) return 'tool_on';
  if (!ok && !noneUp) return 'checking';
  return 'tool_off';
}
