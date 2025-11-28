import httpClient from './httpClient';

/**
 * GET /health
 * @returns {Promise<{ok: boolean, components: Record<string, string>}>}
 */
export async function getHealth() {
  const res = await httpClient.get('/health');
  return res.data;
}

/**
 * - tool_on      -> ok === true and all 'up'
 * - checking     -> almost one 'up' but is not all down
 * - tool_off     -> API not reachable or all down
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
