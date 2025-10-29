/* eslint-disable no-console */
const { getHealth, postSparqlUpdate, postGraphDBUpdate } = require('../helpers/http');
const { pollUntil } = require('../helpers/wait');
const { askTripleExists, ONT_EX } = require('../helpers/graphdb');

// Default test graph
const TEST_GRAPH = process.env.TEST_GRAPH_DEFAULT
  || 'http://example.com/graphs/http-requests';

// Unique identifiers to avoid collisions
const SUBJECT_URI = `urn:test:sparql-update-${Date.now()}`;

jest.setTimeout(90000);

describe('E2E - SPARQL update passthrough', () => {
  beforeAll(async () => {
    // Check nginx → node health
    const health = await getHealth();
    if (health.status !== 200) {
      throw new Error(`/health not OK. Status=${health.status} Body=${JSON.stringify(health.data)}`);
    }
  });

  afterAll(async () => {
    // Cleanup: remove inserted triple
    const cleanup = `
      DELETE WHERE {
        GRAPH <${TEST_GRAPH}> {
          <${SUBJECT_URI}> <${ONT_EX}label> ?o
        }
      }
    `;
    try {
      await postGraphDBUpdate(cleanup);
    } catch (e) {
      console.warn('Cleanup failed:', e?.response?.status, e?.response?.data || e.message);
    }
  });

  it('accepts INSERT DATA and the worker writes to GraphDB', async () => {
    // Build minimal INSERT DATA update
    const update = `
      INSERT DATA {
        GRAPH <${TEST_GRAPH}> {
          <${SUBJECT_URI}> <${ONT_EX}label> "Hello world"
        }
      }
    `;

    // Submit to /sparql/update (async enqueue)
    const res = await postSparqlUpdate(update);
    expect([202, 200]).toContain(res.status);
    expect(res.data).toBeDefined();
    expect(res.data.jobId || res.data.jobIds || res.data.id).toBeDefined();

    // Poll GraphDB until the inserted triple is visible
    const ok = await pollUntil(
      () => askTripleExists(TEST_GRAPH, SUBJECT_URI, `${ONT_EX}label`, 'Hello world').catch(() => false),
      { intervalMs: 1000, timeoutMs: 45000 }
    );

    expect(ok).toBe(true);
  });

  it('rejects non-UPDATE SPARQL content', async () => {
    const invalid = 'SELECT (1 AS ?x) WHERE {} LIMIT 1';
    const r = await postSparqlUpdate(invalid);
    expect([400, 415, 422]).toContain(r.status);
  });
});
