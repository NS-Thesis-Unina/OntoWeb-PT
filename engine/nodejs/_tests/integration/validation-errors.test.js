/* eslint-disable no-console */
const {
  getHealth,
  postIngestHttp,
  getHttpRequestsList,
  getHttpRequestById,
  postSparqlQuery,
  postSparqlUpdate
} = require('../helpers/http');

jest.setTimeout(60000);

describe('API validation errors', () => {
  beforeAll(async () => {
    // Verifies nginx → node health endpoint
    const health = await getHealth();
    if (health.status !== 200) {
      throw new Error(`/health not OK. Status=${health.status} Body=${JSON.stringify(health.data)}`);
    }
  });

  it('rejects ingest with empty body', async () => {
    // Body missing required shape (object/array/{items:[...]})
    const res = await postIngestHttp({});
    expect([400, 422]).toContain(res.status);
    // Should not return a job identifier on validation errors
    expect(res.data?.jobId || res.data?.jobIds || res.data?.id).toBeFalsy();
  });

  it('rejects ingest with invalid method', async () => {
    const res = await postIngestHttp({
      items: [
        {
          id: `req-invalid-${Date.now()}`,
          method: 'INVALID', // not in allowed HTTP methods
          uri: { full: 'https://example.com', scheme: 'https', authority: 'example.com', path: '/' }
        }
      ]
    });
    expect([400, 422]).toContain(res.status);
  });

  it('rejects list with invalid pagination (non-numeric limit)', async () => {
    const res = await getHttpRequestsList({ limit: 'not-a-number', offset: 0 });
    expect([400, 422]).toContain(res.status);
  });

  it('rejects list with invalid pagination (negative limit)', async () => {
    const res = await getHttpRequestsList({ limit: -5, offset: 0 });
    expect([400, 422]).toContain(res.status);
  });

  it('rejects GET by id with invalid id param', async () => {
    // Space-encoded id should be rejected by param validator
    const res = await getHttpRequestById('%20');
    // Depending on routing vs validation, either 400 (validation) or 404 (route not matched).
    expect([400, 404, 422]).toContain(res.status);
  });

  it('rejects SPARQL query when body field is wrong (expects { sparql })', async () => {
    // Call helper directly with wrong shape by bypassing it: replicate request here
    const axios = require('axios');
    const api = axios.create({
      baseURL: process.env.TEST_API_BASE || 'http://localhost',
      timeout: 15000,
      validateStatus: s => s >= 200 && s < 500
    });

    // Wrong key: { query } instead of { sparql }
    const res = await api.post('/sparql/query', { query: 'SELECT (1 AS ?x) WHERE {}' }, {
      headers: { 'content-type': 'application/json' }
    });

    expect([400, 415, 422]).toContain(res.status);
  });

  it('rejects SPARQL query if an UPDATE is provided', async () => {
    // The /sparql/query endpoint only allows SELECT/ASK
    const r = await postSparqlQuery('DELETE WHERE { ?s ?p ?o }');
    expect([400, 415, 422]).toContain(r.status);
  });

  it('rejects SPARQL update if a non-UPDATE is provided', async () => {
    // The /sparql/update endpoint only allows UPDATE forms
    const r = await postSparqlUpdate('SELECT (1 AS ?x) WHERE {} LIMIT 1');
    expect([400, 415, 422]).toContain(r.status);
  });
});
