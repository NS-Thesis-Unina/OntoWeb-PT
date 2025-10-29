/* eslint-disable no-console */
const { getHealth, postSparqlQuery } = require('../helpers/http');

jest.setTimeout(30000);

describe('E2E - SPARQL query passthrough', () => {
  beforeAll(async () => {
    // Nginx → Node health
    const health = await getHealth();
    if (health.status !== 200) {
      throw new Error(`/health not OK. Status=${health.status} Body=${JSON.stringify(health.data)}`);
    }
  });

  it('accepts a simple SELECT and returns SPARQL JSON results', async () => {
    // Keep it data-independent and start with SELECT (no PREFIX)
    const query = 'SELECT (1 AS ?x) WHERE {} LIMIT 1';
    const r = await postSparqlQuery(query);

    // API contract: { data: <sparql-json> }
    expect(r.status).toBe(200);
    expect(r.data).toBeDefined();
    const payload = r.data.data;
    expect(payload).toBeDefined();

    // SPARQL JSON shape
    expect(payload.head).toBeDefined();
    expect(Array.isArray(payload.head.vars)).toBe(true);
    expect(payload.results).toBeDefined();
    const bindings = Array.isArray(payload?.results?.bindings) ? payload.results.bindings : [];
    expect(bindings.length).toBeGreaterThan(0);

    // Value check (typed or untyped int)
    const cell = bindings[0]?.x;
    const val = cell?.value ?? cell;
    expect(['1', '1^^http://www.w3.org/2001/XMLSchema#integer']).toContain(val);
  });

  it('accepts an ASK and returns boolean true', async () => {
    const query = 'ASK { FILTER(1 = 1) }';
    const r = await postSparqlQuery(query);

    expect(r.status).toBe(200);
    const payload = r.data?.data;
    expect(payload).toBeDefined();
    expect(typeof payload.boolean).toBe('boolean');
    expect(payload.boolean).toBe(true);
  });

  it('rejects non-SELECT/ASK queries', async () => {
    const invalid = 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 1';
    const r = await postSparqlQuery(invalid);
    expect([400, 415, 422]).toContain(r.status);
  });
});
