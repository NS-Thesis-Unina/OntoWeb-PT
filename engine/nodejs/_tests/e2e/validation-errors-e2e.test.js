/* eslint-disable no-console */
const axios = require('axios');
const {
  getHealth,
  postIngestHttp,
  getHttpRequestsList,
  getHttpRequestById,
  postSparqlQuery,
  postSparqlUpdate
} = require('../helpers/http');

jest.setTimeout(30000);

describe('E2E - API validation errors', () => {
  let api; // raw axios client for sending purposely invalid shapes

  beforeAll(async () => {
    // Nginx → Node health check
    const health = await getHealth();
    if (health.status !== 200) {
      throw new Error(`/health not OK. Status=${health.status} Body=${JSON.stringify(health.data)}`);
    }

    api = axios.create({
      baseURL: process.env.TEST_API_BASE || 'http://localhost',
      timeout: 15000,
      validateStatus: s => s >= 200 && s < 500
    });
  });

  it('rejects ingest with empty body', async () => {
    // Missing required shape: an object/array/{ items:[...] } is expected
    const res = await postIngestHttp({});
    expect([400, 422]).toContain(res.status);
    expect(res.data?.jobId || res.data?.jobIds || res.data?.id).toBeFalsy();
  });

  it('rejects ingest with invalid HTTP method', async () => {
    const res = await postIngestHttp({
      items: [
        {
          id: `req-invalid-${Date.now()}`,
          method: 'NOT_A_METHOD',
          uri: { full: 'https://example.com', scheme: 'https', authority: 'example.com', path: '/' }
        }
      ]
    });
    expect([400, 422]).toContain(res.status);
  });

  it('rejects list with non-numeric limit', async () => {
    const res = await getHttpRequestsList({ limit: 'abc', offset: 0 });
    expect([400, 422]).toContain(res.status);
  });

  it('rejects list with negative limit', async () => {
    const res = await getHttpRequestsList({ limit: -1, offset: 0 });
    expect([400, 422]).toContain(res.status);
  });

  it('rejects GET by id with an invalid id param', async () => {
    // Depending on router/validator, either 400 (bad param) or 404 (no match) is acceptable.
    const res = await getHttpRequestById('%20');
    expect([400, 404, 422]).toContain(res.status);
  });

  it('rejects SPARQL query when body field is wrong (expects { sparql })', async () => {
    // Send wrong key { query } on purpose using the raw axios client
    const res = await api.post('/sparql/query', { query: 'SELECT (1 AS ?x) WHERE {}' }, {
      headers: { 'content-type': 'application/json' }
    });
    expect([400, 415, 422]).toContain(res.status);
  });

  it('rejects SPARQL query if an UPDATE is provided', async () => {
    const r = await postSparqlQuery('DELETE WHERE { ?s ?p ?o }');
    expect([400, 415, 422]).toContain(r.status);
  });

  it('rejects SPARQL update if a non-UPDATE statement is provided', async () => {
    const r = await postSparqlUpdate('SELECT (1 AS ?x) WHERE {} LIMIT 1');
    expect([400, 415, 422]).toContain(r.status);
  });
});
