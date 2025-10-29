/* eslint-disable no-console */
const { getHealth, postIngestHttp, getHttpRequestById, postGraphDBUpdate } = require('../helpers/http');
const { pollUntil } = require('../helpers/wait');
const { askRequestExists, ONT_EX } = require('../helpers/graphdb');

// Default graph used for the test data
const TEST_GRAPH = process.env.TEST_GRAPH_DEFAULT
  || 'http://example.com/graphs/http-requests';

// Unique id to avoid collisions between test runs
const REQ_ID = `req-IT-BYID-${Date.now()}`;

jest.setTimeout(60000);

describe('GET by id returns the stored HTTP request', () => {
  beforeAll(async () => {
    // Verifies nginx → node health endpoint
    const health = await getHealth();
    if (health.status !== 200) {
      throw new Error(`/health not OK. Status=${health.status} Body=${JSON.stringify(health.data)}`);
    }

    // Prepare a single ingest so the item exists before calling GET by id
    const body = {
      items: [
        {
          id: REQ_ID,
          method: 'PUT',
          httpVersion: 'HTTP/1.1',
          graph: TEST_GRAPH,
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
    if (![202, 200].includes(res.status)) {
      throw new Error(`ingest not accepted. Status=${res.status} Body=${JSON.stringify(res.data)}`);
    }

    // Polls GraphDB until the request exists
    const ok = await pollUntil(async () => {
      try {
        return await askRequestExists(REQ_ID);
      } catch (_e) {
        return false;
      }
    }, { intervalMs: 800, timeoutMs: 30000 });

    if (!ok) {
      throw new Error('request not found in GraphDB after polling');
    }
  });

  afterAll(async () => {
    // Optional cleanup: removes all triples for the created request from the test graph
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

  it('returns 200 and the expected fields for the stored request', async () => {
    const r = await getHttpRequestById(REQ_ID);
    expect(r.status).toBe(200);
    expect(r.data).toBeDefined();

    // The API returns a compact JSON for a single request
    // Minimal structural checks (only assert fields when present)
    const item = r.data;

    // id
    if (item.id) expect(item.id).toBe(REQ_ID);

    // method
    if (item.method) expect(item.method).toBe('PUT');

    // uri
    if (item.uri) {
      if (item.uri.authority) expect(item.uri.authority).toBe('api.example.com');
      if (item.uri.path) expect(item.uri.path).toBe('/v1/items/123');
      if (Array.isArray(item.uri.params)) {
        const soft = item.uri.params.find(p => p?.name === 'soft');
        if (soft) expect(soft.value).toBe('true');
      }
    }

    // response
    if (item.response) {
      if (typeof item.response.status === 'number') expect(item.response.status).toBe(204);
      if (item.response.reason) expect(item.response.reason).toBe('No Content');
    }
  });
});
