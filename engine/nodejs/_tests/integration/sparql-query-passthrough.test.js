/* eslint-disable no-console */
const { getHealth, postSparqlQuery } = require('../helpers/http');

jest.setTimeout(60000);

describe('SPARQL query passthrough returns SPARQL JSON results', () => {
  beforeAll(async () => {
    // Verifies nginx → node health endpoint
    const health = await getHealth();
    if (health.status !== 200) {
      throw new Error(`/health not OK. Status=${health.status} Body=${JSON.stringify(health.data)}`);
    }
  });

  it('accepts a simple SELECT and returns SPARQL JSON results', async () => {
    // Simple SELECT that does not depend on repository data
    const query = 'SELECT (1 AS ?x) WHERE {} LIMIT 1';
    const r = await postSparqlQuery(query);

    // API returns { data: <sparql-json> }
    expect(r.status).toBe(200);
    expect(r.data).toBeDefined();
    const payload = r.data.data;
    expect(payload).toBeDefined();

    // SPARQL JSON structure: { head: { vars: [...] }, results: { bindings: [...] } }
    expect(payload.head).toBeDefined();
    expect(Array.isArray(payload.head.vars)).toBe(true);
    expect(payload.results).toBeDefined();
    const bindings = Array.isArray(payload?.results?.bindings) ? payload.results.bindings : [];
    expect(bindings.length).toBeGreaterThan(0);

    const row = bindings[0];
    // Accept both typed and untyped representations for "1"
    const val = row?.x?.value ?? row?.x;
    expect(['1', '1^^http://www.w3.org/2001/XMLSchema#integer']).toContain(val);
  });

  it('accepts an ASK and returns boolean true', async () => {
    const query = 'ASK { FILTER(1 = 1) }';
    const r = await postSparqlQuery(query);

    expect(r.status).toBe(200);
    expect(r.data).toBeDefined();
    const payload = r.data.data;
    expect(payload).toBeDefined();

    // For ASK, SPARQL JSON is { boolean: true|false }
    expect(typeof payload.boolean).toBe('boolean');
    expect(payload.boolean).toBe(true);
  });

  it('rejects non-SELECT/ASK queries', async () => {
    const invalid = 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 1';
    const r = await postSparqlQuery(invalid);
    // The API validates that only SELECT/ASK are allowed
    expect([400, 415, 422]).toContain(r.status);
  });
});
