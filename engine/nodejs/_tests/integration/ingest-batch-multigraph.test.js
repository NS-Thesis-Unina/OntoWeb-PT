/* eslint-disable no-console */
const { getHealth, postIngestHttp, postGraphDBUpdate } = require('../helpers/http');
const { pollUntil } = require('../helpers/wait');
const { askRequestExistsInGraph, ONT_EX } = require('../helpers/graphdb');

// Two distinct graphs for this test
const TEST_GRAPH_A = process.env.TEST_GRAPH_DEFAULT
  || 'http://example.com/graphs/http-requests';
const TEST_GRAPH_B = process.env.TEST_GRAPH_ALT
  || 'http://example.com/graphs/http-requests-2';

// Unique ids to avoid collisions between runs
const REQ_ID_A = `req-IT-BATCH-A-${Date.now()}`;
const REQ_ID_B = `req-IT-BATCH-B-${Date.now()}`;

jest.setTimeout(60000);

describe('Ingest batch across multiple graphs writes items to their respective graphs', () => {
  beforeAll(async () => {
    // Verifies nginx → node health endpoint
    const health = await getHealth();
    if (health.status !== 200) {
      throw new Error(`/health not OK. Status=${health.status} Body=${JSON.stringify(health.data)}`);
    }
  });

  afterAll(async () => {
    // Cleanup: delete all triples related to the created requests from both graphs
    const cleanupA = `
      PREFIX ex: <${ONT_EX}>
      DELETE { GRAPH <${TEST_GRAPH_A}> { ?s ?p ?o } }
      WHERE  { GRAPH <${TEST_GRAPH_A}> {
        ?req a ex:Request ; ex:id "${REQ_ID_A}" .
        ?s ?p ?o .
      }}
    `;
    const cleanupB = `
      PREFIX ex: <${ONT_EX}>
      DELETE { GRAPH <${TEST_GRAPH_B}> { ?s ?p ?o } }
      WHERE  { GRAPH <${TEST_GRAPH_B}> {
        ?req a ex:Request ; ex:id "${REQ_ID_B}" .
        ?s ?p ?o .
      }}
    `;
    try { await postGraphDBUpdate(cleanupA); } catch (e) {
      console.warn('Cleanup A failed:', e?.response?.status, e?.response?.data || e.message);
    }
    try { await postGraphDBUpdate(cleanupB); } catch (e) {
      console.warn('Cleanup B failed:', e?.response?.status, e?.response?.data || e.message);
    }
  });

  it('accepts a batch with per-item graphs, returns 202/200, and both items appear in their graphs', async () => {
    // Single ingest call with two items targeting two different graphs
    const body = {
      items: [
        {
          id: REQ_ID_A,
          method: 'POST',
          httpVersion: 'HTTP/2',
          graph: TEST_GRAPH_A,
          uri: {
            full: 'https://api.example.com/v1/items',
            scheme: 'https',
            authority: 'api.example.com',
            path: '/v1/items',
            queryRaw: 'page=1&size=20'
          },
          requestHeaders: [{ name: 'Content-Type', value: 'application/json' }],
          response: { status: 201, reason: 'Created' }
        },
        {
          id: REQ_ID_B,
          method: 'PUT',
          httpVersion: 'HTTP/1.1',
          graph: TEST_GRAPH_B,
          uri: {
            full: 'https://api.example.com/v1/items/123?soft=true',
            scheme: 'https',
            authority: 'api.example.com',
            path: '/v1/items/123',
            params: [{ name: 'soft', value: 'true' }]
          },
          requestHeaders: [{ name: 'Accept', value: 'application/json' }],
          response: { status: 204, reason: 'No Content' }
        }
      ]
    };

    const res = await postIngestHttp(body);
    // Some proxies may return 200; the important bit is accepting the batch
    expect([202, 200]).toContain(res.status);
    expect(res.data).toBeDefined();

    // Poll until each id is visible in its specific graph
    const okA = await pollUntil(
      () => askRequestExistsInGraph(TEST_GRAPH_A, REQ_ID_A).catch(() => false),
      { intervalMs: 800, timeoutMs: 30000 }
    );
    const okB = await pollUntil(
      () => askRequestExistsInGraph(TEST_GRAPH_B, REQ_ID_B).catch(() => false),
      { intervalMs: 800, timeoutMs: 30000 }
    );

    expect(okA).toBe(true);
    expect(okB).toBe(true);
  });
});
