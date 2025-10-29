/* eslint-disable no-console */
const { getHealth, postIngestHttp, postGraphDBUpdate } = require('../helpers/http');
const { pollUntil } = require('../helpers/wait');
const { askRequestExists, selectRequestInfo, ONT_EX } = require('../helpers/graphdb');

// Default graph used for the test data
const TEST_GRAPH = process.env.TEST_GRAPH_DEFAULT
  || 'http://example.com/graphs/http-requests';

// Unique id to avoid collisions between test runs
const REQ_ID = `req-IT-A1-${Date.now()}`;

jest.setTimeout(60000);

describe('Ingest single → verifies on GraphDB (polling)', () => {
  beforeAll(async () => {
    // Verifies nginx → node health endpoint
    const health = await getHealth();
    if (health.status !== 200) {
      throw new Error(`/health not OK. Status=${health.status} Body=${JSON.stringify(health.data)}`);
    }
  });

  afterAll(async () => {
    // Optional cleanup: removes all triples related to the created request from the test graph.
    // Uses direct GraphDB SPARQL UPDATE (synchronous).
    const update = `
      PREFIX ex: <${ONT_EX}>
      DELETE { GRAPH <${TEST_GRAPH}> { ?s ?p ?o } }
      WHERE  { GRAPH <${TEST_GRAPH}> {
        ?req a ex:Request ; ex:id "${REQ_ID}" .
        # remove all triples in the test graph
        ?s ?p ?o .
      }}
    `;
    try {
      await postGraphDBUpdate(update);
    } catch (e) {
      // Cleanup errors do not fail the test
      console.warn('Cleanup failed:', e?.response?.status, e?.response?.data || e.message);
    }
  });

  it('enqueues the job and writes to GraphDB within the timeout', async () => {
    // 1) Prepares a "single" payload with explicit graph
    const body = {
      items: [
        {
          id: REQ_ID,
          method: 'POST',
          httpVersion: 'HTTP/2',
          bodyBase64: 'SGVsbG8gYm9keQ==',
          graph: TEST_GRAPH,
          uri: {
            full: 'https://api.example.com/v1/items',
            scheme: 'https',
            authority: 'api.example.com',
            path: '/v1/items',
            queryRaw: 'page=1&size=20'
          },
          requestHeaders: [
            { name: 'Content-Type', value: 'application/json' }
          ],
          connection: { authority: 'api.example.com' },
          response: {
            httpVersion: 'HTTP/2',
            status: 201,
            reason: 'Created',
            headers: [{ name: 'Location', value: '/v1/items/123' }]
          }
        }
      ]
    };

    // 2) Calls the ingest API (asynchronous) → expects 202 with jobId
    const res = await postIngestHttp(body);
    // Some proxy setups may return 200; the important bit is receiving a job identifier
    expect([202, 200]).toContain(res.status);
    expect(res.data).toBeDefined();
    expect(res.data.jobId || res.data.jobIds || res.data.id).toBeDefined();

    // 3) Polls GraphDB until a Request with ex:id = REQ_ID exists
    const ok = await pollUntil(async () => {
      try {
        return await askRequestExists(REQ_ID);
      } catch (_e) {
        return false;
      }
    }, { intervalMs: 800, timeoutMs: 30000 });

    expect(ok).toBe(true);

    // 4) Runs a detail SELECT for additional assertions
    const details = await selectRequestInfo(REQ_ID);
    expect(details).toBeTruthy();
    const bindings = details?.results?.bindings || [];
    expect(bindings.length).toBeGreaterThan(0);

    // Basic checks on mapped fields (methodName, authority, path, statusCode) when present
    const row = bindings[0];
    if (row.methodName) expect(row.methodName.value).toBe('POST');
    if (row.authority) expect(row.authority.value).toBe('api.example.com');
    if (row.path) expect(row.path.value).toBe('/v1/items');
    if (row.statusCode) {
      expect(['201', '201^^http://www.w3.org/2001/XMLSchema#int']).toContain(
        row.statusCode.value || row.statusCode
      );
    }
  });
});
