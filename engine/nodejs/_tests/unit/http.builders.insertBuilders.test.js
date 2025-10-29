const { describe, it, expect } = require('@jest/globals');

const insertSingle = require('../../src/utils/http/builders/insertSingle');
const insertBatch  = require('../../src/utils/http/builders/insertBatch');
const { G_HTTP }   = require('../../src/utils/constants');

// ---------- helpers ----------

/**
 * Collapse excessive whitespace to make string comparisons less brittle.
 */
function normalizeWhitespace(str) {
  return String(str).replace(/\s+/g, ' ').trim();
}

/**
 * Extract all GRAPH IRIs from an INSERT string.
 */
function extractGraphIris(insertStr) {
  const out = [];
  const re = /GRAPH\s*<([^>]+)>/gim;
  let m;
  while ((m = re.exec(insertStr)) !== null) {
    out.push(m[1]);
  }
  return out;
}

/**
 * Deep clone utility to detect unintended mutation.
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ---------- fixtures ----------

const itemA = {
  id: 'req-002',
  method: 'POST',
  httpVersion: 'HTTP/2',
  bodyBase64: 'SGVsbG8gYm9keQ==',
  graph: 'http://example.com/graphs/http-requests',
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
};

const itemB = {
  id: 'req-003',
  method: 'PUT',
  // no 'graph' -> should fallback to default G_HTTP
  uri: {
    full: 'https://api.example.com/v1/items/123?soft=true',
    scheme: 'https',
    authority: 'api.example.com',
    path: '/v1/items/123',
    params: [{ name: 'soft', value: 'true' }]
  },
  requestHeaders: [{ name: 'Accept', value: 'application/json' }],
  response: { status: 204, reason: 'No Content' }
};

const itemC = {
  id: 'req-004',
  method: 'DELETE',
  graph: 'http://example.com/graphs/ops',
  uri: { full: 'https://api.example.com/v1/items/999', scheme: 'https', authority: 'api.example.com', path: '/v1/items/999' },
  requestHeaders: [{ name: 'X-Trace', value: 'trace-1' }]
};

// ---------- tests ----------

describe('HTTP → SPARQL INSERT builders (unit)', () => {
  describe('insertSingle', () => {
    it('produces a valid INSERT DATA with the correct GRAPH and key triples; does not mutate input', () => {
      const input = deepClone(itemA);
      const before = deepClone(input);

      const sparql = insertSingle(input);
      const s = normalizeWhitespace(sparql);

      // Shape: must contain INSERT DATA (prefixes may precede it)
      expect(s).toMatch(/\bINSERT\s+DATA\b/i);

      // Must contain a GRAPH block with the exact graph IRI
      expect(s).toContain(`GRAPH <${itemA.graph}>`);

      // Should reference a stable URN for the Request (implementation typically uses urn:req:{id})
      expect(s).toMatch(new RegExp(`urn:[^\\s>]*${itemA.id}`));

      // Must contain the id literal somewhere as a triple object (exact value)
      expect(s).toContain(`"${itemA.id}"`);

      // Method presence: either as an IRI like #POST or as a literal "POST" (or both)
      expect(
        /[#/](POST)[>\s]/.test(s) || /"POST"/.test(s)
      ).toBe(true);

      // Response status must appear (as integer literal, or embedded node)
      expect(s).toMatch(/\b201\b/);

      // Header name/value must appear
      expect(s).toContain('Content-Type');
      expect(s).toContain('application/json');

      // Body base64 should appear
      expect(s).toContain(itemA.bodyBase64);

      // Input must not be mutated
      expect(input).toEqual(before);
    });
  });

  describe('insertBatch', () => {
    it('groups items by graph into multiple GRAPH blocks and includes default graph for items without explicit graph; no mutation', () => {
      const batch = [deepClone(itemA), deepClone(itemB), deepClone(itemC)];
      const before = deepClone(batch);

      const sparql = insertBatch(batch);
      const s = normalizeWhitespace(sparql);

      // Must contain INSERT DATA somewhere (prefixes may precede it)
      expect(s).toMatch(/\bINSERT\s+DATA\b/i);

      // Extract GRAPH IRIs and validate set equality (order not strictly required)
      const graphs = extractGraphIris(s);
      const expected = new Set([itemA.graph, itemC.graph, G_HTTP]);
      const actual = new Set(graphs);
      expected.forEach((g) => expect(actual.has(g)).toBe(true));

      // Sanity: number of GRAPH blocks should be >= number of distinct graphs in input
      expect(graphs.length).toBeGreaterThanOrEqual(expected.size);

      // Must contain all item ids as literals somewhere
      expect(s).toContain(`"${itemA.id}"`);
      expect(s).toContain(`"${itemB.id}"`);
      expect(s).toContain(`"${itemC.id}"`);

      // Must contain method tokens present in the batch (robust check)
      expect(/"POST"|[#/](POST)[>\s]/.test(s)).toBe(true);
      expect(/"PUT"|[#/](PUT)[>\s]/.test(s)).toBe(true);
      expect(/"DELETE"|[#/](DELETE)[>\s]/.test(s)).toBe(true);

      // Headers presence from different items
      expect(s).toContain('Content-Type');
      expect(s).toContain('Accept');
      expect(s).toContain('X-Trace');

      // The default graph must be present for itemB (no graph provided)
      expect(graphs).toContain(G_HTTP);

      // Input must not be mutated
      expect(batch).toEqual(before);
    });

    it('supports a single-item batch and behaves like insertSingle (sanity check)', () => {
      const single = [deepClone(itemB)];
      const sparql = insertBatch(single);
      const s = normalizeWhitespace(sparql);

      // Prefixes may exist; we only require that INSERT DATA is present
      expect(s).toMatch(/\bINSERT\s+DATA\b/i);

      // Should reference the default graph since itemB has no .graph
      expect(s).toContain(`GRAPH <${G_HTTP}>`);

      // Contains id literal and method occurrence
      expect(s).toContain(`"${itemB.id}"`);
      expect(/"PUT"|[#/](PUT)[>\s]/.test(s)).toBe(true);
    });

    // ------------ NEW TEST #1: error path ------------
    it('throws when called with an empty array (error path)', () => {
      expect(() => insertBatch([])).toThrow(/Expected a non-empty array of requests/);
    });

    // ------------ NEW TEST #2: RDF datatypes ------------
    it('emits correct RDF datatypes for body base64, XMLLiteral query, and xsd:int status codes', () => {
      // Use a batch so we can assert both 201 and 204, plus body/query typings
      const sparql = insertBatch([deepClone(itemA), deepClone(itemB)]);
      const s = normalizeWhitespace(sparql);

      // Body base64 is typed as content:ContentAsBase64 or full IRI form
      expect(
        /"\s*SGVsbG8gYm9keQ==\s*"\^\^\s*(content:ContentAsBase64|<http:\/\/www\.w3\.org\/2008\/content#ContentAsBase64>)/.test(s)
      ).toBe(true);

      // Query is typed as rdf:XMLLiteral or full IRI form
      expect(
        /\^\^\s*(rdf:XMLLiteral|<http:\/\/www\.w3\.org\/1999\/02\/22-rdf-syntax-ns#XMLLiteral>)/.test(s)
      ).toBe(true);

      // Status codes typed as xsd:int (full IRI since xsd prefix is not declared)
      expect(/"201"\^\^<http:\/\/www\.w3\.org\/2001\/XMLSchema#int>/.test(s)).toBe(true);
      expect(/"204"\^\^<http:\/\/www\.w3\.org\/2001\/XMLSchema#int>/.test(s)).toBe(true);
    });

    // ------------ NEW TEST #3: header classification + linking properties ------------
    it('classifies headers correctly and uses the right linking properties (payHeader / repHeader / reqHeader)', () => {
      const sparql = insertBatch([deepClone(itemA), deepClone(itemB), deepClone(itemC)]);
      const s = normalizeWhitespace(sparql);

      // Content-Type → PayloadHeaders + payHeader
      expect(/#PayloadHeaders>/.test(s)).toBe(true);
      expect(/#payHeader>/.test(s)).toBe(true);

      // Accept → RepresentationHeaders + repHeader
      expect(/#RepresentationHeaders>/.test(s)).toBe(true);
      expect(/#repHeader>/.test(s)).toBe(true);

      // X-Trace → RequestHeader + reqHeader
      expect(/#RequestHeader>/.test(s)).toBe(true);
      expect(/#reqHeader>/.test(s)).toBe(true);
    });
  });
});
