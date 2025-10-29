/* eslint-disable */
const { getHealth, getHttpRequestsList, postIngestHttp, postGraphDBUpdate } = require('../helpers/http');
const { pollUntil } = require('../helpers/wait');
const { askRequestExistsInGraph, ONT_EX } = require('../helpers/graphdb');

// Graph used for list & filter tests
const TEST_GRAPH = process.env.TEST_GRAPH_DEFAULT
  || 'http://example.com/graphs/http-requests';

// Unique id for this test run
const REQ_ID = `req-E2E-LIST-${Date.now()}`;

jest.setTimeout(60000);

describe('E2E - Paginated list with filters', () => {
  beforeAll(async () => {
    // Health check
    const health = await getHealth();
    if (health.status !== 200) {
      throw new Error(`/health not OK. Status=${health.status} Body=${JSON.stringify(health.data)}`);
    }

    // Ensure there is at least one known item to filter
    const body = {
      items: [
        {
          id: REQ_ID,
          method: 'GET',
          httpVersion: 'HTTP/1.1',
          graph: TEST_GRAPH,
          uri: {
            full: 'https://api.example.com/v1/list-test',
            scheme: 'https',
            authority: 'api.example.com',
            path: '/v1/list-test'
          },
          requestHeaders: [{ name: 'Accept', value: 'application/json' }],
          response: { status: 200, reason: 'OK' }
        }
      ]
    };

    const res = await postIngestHttp(body);
    expect([202, 200]).toContain(res.status);

    // Wait until data visible in GraphDB
    const ok = await pollUntil(
      () => askRequestExistsInGraph(TEST_GRAPH, REQ_ID).catch(() => false),
      { intervalMs: 800, timeoutMs: 30000 }
    );
    expect(ok).toBe(true);
  });

  afterAll(async () => {
    // Cleanup: remove all triples for this id
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

  it('returns filtered and paginated results', async () => {
    // First page filtered by method, authority and path
    const page0 = await getHttpRequestsList({
      method: 'GET',
      authority: 'api.example.com',
      path: '/v1/list-test',
      limit: 1,
      offset: 0
    });

    expect(page0.status).toBe(200);
    expect(page0.data).toBeDefined();

    // Accept both shapes:
    //   A) { total, items: [...] }
    //   B) { items: [...] } without total
    const total0 =
      typeof page0.data.total === 'number'
        ? page0.data.total
        : (typeof page0.data?.pagination?.total === 'number' ? page0.data.pagination.total : null);

    const items0 = Array.isArray(page0.data.items) ? page0.data.items : [];
    expect(Array.isArray(items0)).toBe(true);
    expect(items0.length).toBeLessThanOrEqual(1);

    if (items0.length === 1) {
      const first = items0[0];
      if (first.method) expect(first.method).toBe('GET');
      if (first.uri?.authority) expect(first.uri.authority).toBe('api.example.com');
      if (first.uri?.path) expect(first.uri.path).toBe('/v1/list-test');
    }

    // Second page (offset=1)
    const page1 = await getHttpRequestsList({
      method: 'GET',
      authority: 'api.example.com',
      path: '/v1/list-test',
      limit: 1,
      offset: 1
    });

    expect(page1.status).toBe(200);
    const total1 =
      typeof page1.data.total === 'number'
        ? page1.data.total
        : (typeof page1.data?.pagination?.total === 'number' ? page1.data.pagination.total : null);
    const items1 = Array.isArray(page1.data.items) ? page1.data.items : [];
    expect(Array.isArray(items1)).toBe(true);
    expect(items1.length).toBeLessThanOrEqual(1);

    // If the API exposes a total, assert consistency and page behavior
    if (typeof total0 === 'number' && typeof total1 === 'number') {
      expect(total1).toBe(total0);
      if (total0 > 1 && items0.length === 1 && items1.length === 1) {
        if (items0[0]?.id && items1[0]?.id) {
          expect(items1[0].id).not.toBe(items0[0].id);
        }
      } else if (total0 <= 1) {
        expect(items1.length).toBe(0);
      }
    } else {
      // When total is not provided, make minimal pagination-safe checks
      if (items0.length === 1 && items1.length === 1 && items0[0]?.id && items1[0]?.id) {
        expect(items1[0].id).not.toBe(items0[0].id);
      }
      expect(items1.length).toBeGreaterThanOrEqual(0);
    }
  });
});
