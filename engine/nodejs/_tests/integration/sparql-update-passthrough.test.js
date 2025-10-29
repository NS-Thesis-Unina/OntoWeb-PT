/* eslint-disable no-console */
const { getHealth, postSparqlUpdate, postGraphDBSelect, postGraphDBUpdate } = require('../helpers/http');
const { pollUntil } = require('../helpers/wait');

jest.setTimeout(60000);

// Use the same default graph employed elsewhere
const TEST_GRAPH = process.env.TEST_GRAPH_DEFAULT
  || 'http://example.com/graphs/http-requests';

// Unique triple to avoid collisions between runs
const S = `urn:test:update:${Date.now()}`;
const P = 'urn:test:prop';
const O = `ok-${Date.now()}`;

describe('SPARQL update passthrough enqueues and applies an UPDATE', () => {
  beforeAll(async () => {
    // Verifies nginx → node health endpoint
    const health = await getHealth();
    if (health.status !== 200) {
      throw new Error(`/health not OK. Status=${health.status} Body=${JSON.stringify(health.data)}`);
    }
  });

  afterAll(async () => {
    // Cleanup: delete the inserted triple (synchronous call directly to GraphDB)
    const del = `
      DELETE WHERE {
        GRAPH <${TEST_GRAPH}> { <${S}> <${P}> "${O}" }
      }
    `;
    try {
      await postGraphDBUpdate(del);
    } catch (e) {
      console.warn('Cleanup failed:', e?.response?.status, e?.response?.data || e.message);
    }
  });

  it('accepts an INSERT DATA, returns 202, and the triple becomes visible in GraphDB', async () => {
    // Build a minimal INSERT DATA into the chosen graph
    const insert = `
      INSERT DATA {
        GRAPH <${TEST_GRAPH}> {
          <${S}> <${P}> "${O}"
        }
      }
    `;

    // Enqueue the update via API (asynchronous path)
    const r = await postSparqlUpdate(insert);
    expect([202, 200]).toContain(r.status);
    // The API normally returns { accepted: true, jobId }
    expect(r.data).toBeDefined();

    // Poll GraphDB until the triple exists
    const ask = `
      ASK {
        GRAPH <${TEST_GRAPH}> { <${S}> <${P}> "${O}" }
      }
    `;

    const ok = await pollUntil(async () => {
      try {
        const res = await postGraphDBSelect(ask);
        return res.status === 200 && Boolean(res.data?.boolean);
      } catch (_e) {
        return false;
      }
    }, { intervalMs: 800, timeoutMs: 30000 });

    expect(ok).toBe(true);
  });

  it('rejects non-UPDATE statements', async () => {
    const invalid = 'SELECT (1 AS ?x) WHERE {} LIMIT 1';
    const r = await postSparqlUpdate(invalid);
    // The API validates that only UPDATE forms are allowed
    expect([400, 415, 422]).toContain(r.status);
  });
});
