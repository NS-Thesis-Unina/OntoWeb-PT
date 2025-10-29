/* eslint-disable no-console */
const { getHealth, postIngestHttp, postGraphDBUpdate } = require('../helpers/http');
const { pollUntil } = require('../helpers/wait');
const {
  askRequestExistsInGraph,
  countRequestsInGraphById,
  countHeadersInGraphById,
  getStatusCodesInGraphById,
  ONT_EX
} = require('../helpers/graphdb');

jest.setTimeout(90000);

// Use the default graph as in other tests
const TEST_GRAPH = process.env.TEST_GRAPH_DEFAULT
  || 'http://example.com/graphs/http-requests';

// Unique id per run
const REQ_ID = `req-idem-${Date.now()}`;

describe('Idempotence and conflict behavior for repeated ingests with the same id', () => {
  beforeAll(async () => {
    // Health check (Nginx -> Node)
    const health = await getHealth();
    if (health.status !== 200) {
      throw new Error(`/health not OK. Status=${health.status} Body=${JSON.stringify(health.data)}`);
    }
  });

  afterAll(async () => {
    // Cleanup: remove all triples tied to the created request in the test graph
    const update = `
      PREFIX ex: <${ONT_EX}>
      DELETE { GRAPH <${TEST_GRAPH}> { ?s ?p ?o } }
      WHERE  { GRAPH <${TEST_GRAPH}> {
        ?req a ex:Request ; ex:id "${REQ_ID}" .
        ?s ?p ?o .
      }}
    `;
    try {
      await postGraphDBUpdate(update);
    } catch (e) {
      console.warn('Cleanup failed:', e?.response?.status, e?.response?.data || e.message);
    }
  });

  it('re-ingesting the exact same payload is idempotent (no extra resources/headers)', async () => {
    // Base payload with one request header and a 200 response
    const baseBody = {
      items: [
        {
          id: REQ_ID,
          method: 'POST',
          httpVersion: 'HTTP/1.1',
          graph: TEST_GRAPH,
          uri: {
            full: 'https://api.example.com/v1/idempotence',
            scheme: 'https',
            authority: 'api.example.com',
            path: '/v1/idempotence',
            queryRaw: 'page=1&size=20'
          },
          requestHeaders: [{ name: 'Content-Type', value: 'application/json' }],
          response: { status: 200, reason: 'OK' }
        }
      ]
    };

    // First ingest
    const r1 = await postIngestHttp(baseBody);
    expect([202, 200]).toContain(r1.status);

    // Wait until visible
    const exists1 = await pollUntil(
      () => askRequestExistsInGraph(TEST_GRAPH, REQ_ID).catch(() => false),
      { intervalMs: 800, timeoutMs: 30000 }
    );
    expect(exists1).toBe(true);

    // Baseline counts
    const countReqBefore = await countRequestsInGraphById(TEST_GRAPH, REQ_ID);
    const countHdrBefore = await countHeadersInGraphById(TEST_GRAPH, REQ_ID);

    // Second ingest with the EXACT same payload
    const r2 = await postIngestHttp(baseBody);
    expect([202, 200]).toContain(r2.status);

    // Small wait to allow any processing (should be idempotent anyway)
    await new Promise(r => setTimeout(r, 1500));

    // Counts after second ingest
    const countReqAfter = await countRequestsInGraphById(TEST_GRAPH, REQ_ID);
    const countHdrAfter = await countHeadersInGraphById(TEST_GRAPH, REQ_ID);

    // Assertions: same number of Request resources and same number of headers
    expect(countReqAfter).toBe(1);                // still a single Request with that id
    expect(countReqAfter).toBe(countReqBefore);   // unchanged
    expect(countHdrAfter).toBe(countHdrBefore);   // unchanged header count
  });

  it('re-ingesting with a different response status reflects the new value (conflict case)', async () => {
    // Change only the response.status to 202 (Accepted)
    const conflictingBody = {
      items: [
        {
          id: REQ_ID,
          method: 'POST',
          httpVersion: 'HTTP/1.1',
          graph: TEST_GRAPH,
          uri: {
            full: 'https://api.example.com/v1/idempotence',
            scheme: 'https',
            authority: 'api.example.com',
            path: '/v1/idempotence',
            queryRaw: 'page=1&size=20'
          },
          requestHeaders: [{ name: 'Content-Type', value: 'application/json' }],
          response: { status: 202, reason: 'Accepted' }
        }
      ]
    };

    const r3 = await postIngestHttp(conflictingBody);
    expect([202, 200]).toContain(r3.status);

    // Wait briefly for processing
    await new Promise(r => setTimeout(r, 1500));

    // Status codes currently associated with this request
    const codes = await getStatusCodesInGraphById(TEST_GRAPH, REQ_ID);

    // Must include the new status code 202
    expect(Array.isArray(codes)).toBe(true);
    expect(codes.length).toBeGreaterThanOrEqual(1);
    expect(codes).toContain(202);

    // Optionally, many stores will retain the previous 200 as well (set semantics)
    // Accept either 1 (only updated value) or 2 (both values) distinct codes.
    expect(codes.length).toBeLessThanOrEqual(2);
  });
});
