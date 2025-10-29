const { describe, it, expect } = require('@jest/globals');

const buildSelectRequestsPaged = require('../../src/utils/http/builders/selectPaged');

// ---------- helpers ----------

/** Normalize whitespace to make assertions resilient. */
function normalizeWhitespace(str) {
  return String(str).replace(/\s+/g, ' ').trim();
}

/** Deep clone helper (to detect mutation). */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ---------- tests ----------

describe('HTTP → SPARQL SELECT (paged) builder (unit)', () => {
  it('emits a single SELECT with ?total subquery, ORDER BY, LIMIT and OFFSET (basic shape)', () => {
    const q = buildSelectRequestsPaged({ limit: 10, offset: 0, filters: {} });
    const s = normalizeWhitespace(q);

    // Must be a SELECT query
    expect(/^SELECT/i.test(s) || /\bSELECT\b/i.test(s)).toBe(true);

    // Must include a total count subquery
    expect(/COUNT\s*\(\s*DISTINCT\s+[?$]\w+\s*\)\s+AS\s+\?total/i.test(s)).toBe(true);
    expect(/\?total\b/.test(s)).toBe(true);

    // Should include ORDER BY on an id column
    expect(/ORDER\s+BY/i.test(s)).toBe(true);

    // Pagination present
    expect(/\bLIMIT\s+10\b/i.test(s)).toBe(true);
    expect(/\bOFFSET\s+0\b/i.test(s)).toBe(true);
  });

  it('accepts limit/offset as strings and sanitizes them into numeric LIMIT/OFFSET', () => {
    const q = buildSelectRequestsPaged({ limit: '25', offset: '50', filters: {} });
    const s = normalizeWhitespace(q);

    expect(/\bLIMIT\s+25\b/i.test(s)).toBe(true);
    expect(/\bOFFSET\s+50\b/i.test(s)).toBe(true);
  });

  it('applies method filter case-insensitively (via UCASE) and includes the value', () => {
    const q = buildSelectRequestsPaged({ limit: 5, offset: 0, filters: { method: 'get' } });
    const s = normalizeWhitespace(q);

    // Method: builder uses UCASE(STR(...)) = "GET"
    expect(/FILTER\s*\(\s*UCASE\s*\(\s*STR\(\?methodName0\)\s*\)\s*=\s*"GET"\s*\)/i.test(s)).toBe(true);
  });

  it('applies scheme/authority/path filters and includes their literals', () => {
    const q = buildSelectRequestsPaged({
      limit: 5,
      offset: 0,
      filters: {
        scheme: 'https',
        authority: 'api.example.com',
        path: '/v1/items'
      }
    });
    const s = normalizeWhitespace(q);

    // Exact match filters on scheme/authority/path
    expect(/FILTER\s*\(\s*STR\(\?scheme0\)\s*=\s*"https"\s*\)/i.test(s)).toBe(true);
    expect(/FILTER\s*\(\s*STR\(\?authority0\)\s*=\s*"api\.example\.com"\s*\)/i.test(s)).toBe(true);
    expect(/FILTER\s*\(\s*STR\(\?path0\)\s*=\s*"\/v1\/items"\s*\)/i.test(s)).toBe(true);
  });

  it('applies text filter on the full URI using CONTAINS', () => {
    const q = buildSelectRequestsPaged({
      limit: 5,
      offset: 0,
      filters: { text: 'items/123?soft=true' }
    });
    const s = normalizeWhitespace(q);

    // CONTAINS on ?uriFull0
    expect(/FILTER\s*\(\s*CONTAINS\s*\(\s*STR\(\?uriFull0\)\s*,\s*"items\/123\?soft=true"\s*\)\s*\)/i.test(s)).toBe(true);
  });

  it('applies headerName (case-insensitive via LCASE) and headerValue (exact) filters', () => {
    const q = buildSelectRequestsPaged({
      limit: 5,
      offset: 0,
      filters: { headerName: 'accept', headerValue: 'application/json' }
    });
    const s = normalizeWhitespace(q);

    // headerName: builder uses LCASE(STR(?hdrName0)) = "accept"
    expect(/FILTER\s*\(\s*LCASE\s*\(\s*STR\(\?hdrName0\)\s*\)\s*=\s*"accept"\s*\)/i.test(s)).toBe(true);
    // headerValue exact
    expect(/FILTER\s*\(\s*STR\(\?hdrValue0\)\s*=\s*"application\/json"\s*\)/i.test(s)).toBe(true);
  });

  it('escapes dangerous characters in literals to prevent malformed SPARQL', () => {
    const trickyAuthority = 'api"evil".example.com';
    const trickyPath = '/v1/items/"bad"';

    const q = buildSelectRequestsPaged({
      limit: 5,
      offset: 0,
      filters: { authority: trickyAuthority, path: trickyPath }
    });
    const s = normalizeWhitespace(q);

    // Quotes should be escaped within SPARQL string literals
    expect(s.includes('STR(?authority0) = "api\\"evil\\".example.com"')).toBe(true);
    expect(s.includes('STR(?path0) = "/v1/items/\\"bad\\""')).toBe(true);
  });

  it('does not mutate the provided filter object', () => {
    const filters = {
      method: 'POST',
      scheme: 'https',
      authority: 'api.example.com',
      path: '/v1/items',
      headerName: 'Content-Type',
      headerValue: 'application/json',
      text: 'items'
    };
    const params = { limit: 10, offset: 20, filters: deepClone(filters) };
    const before = deepClone(params);

    const q = buildSelectRequestsPaged(params);
    const s = normalizeWhitespace(q);

    expect(/\bLIMIT\s+10\b/i.test(s)).toBe(true);
    expect(/\bOFFSET\s+20\b/i.test(s)).toBe(true);

    // Original object is unchanged
    expect(params).toEqual(before);
  });
});
