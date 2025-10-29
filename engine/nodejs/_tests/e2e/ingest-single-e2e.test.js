/* eslint-disable no-console */
const { getHealth, postIngestHttp, postGraphDBUpdate } = require('../helpers/http');
const { pollUntil } = require('../helpers/wait');
const { askRequestExists, selectRequestInfo, ONT_EX } = require('../helpers/graphdb');

// Default graph used for this e2e test
const TEST_GRAPH = process.env.TEST_GRAPH_DEFAULT
  || 'http://example.com/graphs/http-requests';

// Unique id to avoid collisions across runs
const REQ_ID = `req-E2E-A1-${Date.now()}`;

jest.setTimeout(60000);

describe('E2E - Ingest single request and verify persistence in GraphDB', () => {
  beforeAll(async () => {
    // Verifies Nginx → Node health endpoint
    const health = await getHealth();
    if (health.status !== 200) {
      throw new Error(`/health not OK. Status=${health.status} Body=${JSON.stringify(health.data)}`);
    }
  });

  afterAll(async () => {
    // Optional cleanup: remove all triples related to the created request in the test graph
    const update = `
      PREFIX ex: <${ONT_EX}>
      DELETE { GRAPH <${TEST_GRAPH}> { ?s ?p ?o } }
      WHERE  { GRAPH <${TEST_GRAPH}> {
        ?req a ex:Request ; ex:id "${REQ_ID}" .
        # remove every triple in the test graph linked to this request
        ?s ?p ?o .
      }}
    `;
    try {
      await postGraphDBUpdate(update);
    } catch (e) {
      // Cleanup errors should not fail the suite
      console.warn('Cleanup failed:', e?.response?.status, e?.response?.data || e.message);
    }
  });

  it('accepts ingest, worker writes to GraphDB, and details can be selected', async () => {
    // 1) Prepare a single-item payload with explicit graph
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
          requestHeaders: [{ name: 'Content-Type', value: 'application/json' }],
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

    // 2) Call the ingest API (asynchronous). A proxy may return 200; the key is that a job is accepted.
    const res = await postIngestHttp(body);
    expect([202, 200]).toContain(res.status);
    expect(res.data).toBeDefined();
    expect(res.data.jobId || res.data.jobIds || res.data.id).toBeDefined();

    // 3) Poll GraphDB until a Request with ex:id = REQ_ID exists
    const ok = await pollUntil(async () => {
      try {
        return await askRequestExists(REQ_ID);
      } catch (_e) {
        return false;
      }
    }, { intervalMs: 800, timeoutMs: 30000 });

    expect(ok).toBe(true);

    // 4) Fetch details via SELECT to assert a few mapped fields
    const details = await selectRequestInfo(REQ_ID);
    expect(details).toBeTruthy();
    const bindings = details?.results?.bindings || [];
    expect(bindings.length).toBeGreaterThan(0);

    // Basic checks on mapped fields when the OPTIONAL variables are present
    const row = bindings[0];
    if (row.methodName) expect(row.methodName.value).toBe('POST');
    if (row.authority) expect(row.authority.value).toBe('api.example.com');
    if (row.path) expect(row.path.value).toBe('/v1/items');
    if (row.statusCode) {
      // Accept both raw and typed integers
      expect(['201', '201^^http://www.w3.org/2001/XMLSchema#int']).toContain(
        row.statusCode.value || row.statusCode
      );
    }
  });
});
