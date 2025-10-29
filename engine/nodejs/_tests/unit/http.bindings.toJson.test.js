const { describe, it, expect } = require('@jest/globals');

// Adjust this path if your repo layout differs
const bindingsToRequestsJson = require('../../src/utils/http/bindings/toJson');
const { G_HTTP } = require('../../src/utils/constants');

// ---------- helpers ----------
const lit = (v) => (v === undefined || v === null ? undefined : ({ type: 'literal', value: String(v) }));
const uri = (v) => (v === undefined || v === null ? undefined : ({ type: 'uri', value: String(v) }));

const deepClone = (x) => JSON.parse(JSON.stringify(x));

// ---------- test ----------
describe('bindingsToRequestsJson (unit)', () => {
  it('groups rows by id and emits clean, deduped, and well-structured HTTP request objects', () => {
    // Build a small bindings table that simulates the SELECT output (W3C SPARQL JSON format)
    // id=alpha → ricco di dati: headers, params, connection, response, body base64
    // id=beta  → minimale: quasi tutti i campi assenti per testare la pulizia
    const bindings = [
      // alpha, row 1: base fields + one request header + one param
      {
        id: lit('alpha'),
        httpVersion: lit('HTTP/1.1'),
        methodName: lit('GET'),
        uriFull: lit('https://api.example.com/v1/items?z=1&a%20name=a+b%26c'),
        scheme: lit('https'),
        authority: lit('api.example.com'),
        path: lit('/v1/items'),
        fragment: undefined,
        hdrName: lit('X-Trace'),
        hdrValue: lit('t-1'),
        paramName: lit('z'),
        paramValue: lit('1'),
        connAuthority: lit('api.example.com'),
        resHttpVersion: lit('HTTP/2'),
        resBodyBase64: lit('UkVTUE9OU0U='),
        statusCodeNumber: lit('201'),
        reasonPhrase: lit('Created'),
        rhdrName: lit('Set-Cookie'),
        rhdrValue: lit('id=abc'),
        bodyBase64: lit('Qk9EWQ==') // "BODY"
      },
      // alpha, row 2: another request header + duplicate header to test dedup + another param (with spaces in name, special chars in value)
      {
        id: lit('alpha'),
        httpVersion: lit('HTTP/1.1'),
        methodName: lit('GET'),
        uriFull: lit('https://api.example.com/v1/items?z=1&a%20name=a+b%26c'),
        scheme: lit('https'),
        authority: lit('api.example.com'),
        path: lit('/v1/items'),
        hdrName: lit('Accept'),
        hdrValue: lit('application/json'),
        // Duplicate of row1 (must be deduped)
        // We'll add it as a separate row:
      },
      {
        id: lit('alpha'),
        httpVersion: lit('HTTP/1.1'),
        methodName: lit('GET'),
        uriFull: lit('https://api.example.com/v1/items?z=1&a%20name=a+b%26c'),
        scheme: lit('https'),
        authority: lit('api.example.com'),
        path: lit('/v1/items'),
        hdrName: lit('X-Trace'),
        hdrValue: lit('t-1'), // exact duplicate → must be deduped
        paramName: lit('a name'),
        paramValue: lit('a+b&c'),
        // response header duplicate test
        rhdrName: lit('Set-Cookie'),
        rhdrValue: lit('id=abc') // exact duplicate → must be deduped
      },
      // beta, minimal rows: only id present
      {
        id: lit('beta')
      },
      {
        id: lit('beta'),
        // explicit empties shouldn't crash or create dirty output
        hdrName: undefined,
        paramName: undefined
      }
    ];

    const inputBefore = deepClone(bindings);
    const { items } = bindingsToRequestsJson(bindings);

    // Input immutability
    expect(bindings).toEqual(inputBefore);

    // We expect two distinct items: alpha and beta
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(2);

    // Helper to find by id
    const byId = Object.fromEntries(items.map(o => [o.id, o]));
    const alpha = byId['alpha'];
    const beta = byId['beta'];

    // ------------ alpha assertions ------------
    expect(alpha).toBeDefined();

    // Graph default must be set
    expect(alpha.graph).toBe(G_HTTP);

    // Core
    expect(alpha.id).toBe('alpha');
    expect(alpha.method).toBe('GET');
    expect(alpha.httpVersion).toBe('HTTP/1.1');

    // Body base64 (from bodyBase64 binding)
    expect(alpha.bodyBase64).toBe('Qk9EWQ==');

    // URI block
    expect(alpha.uri).toBeDefined();
    expect(alpha.uri.scheme).toBe('https');
    expect(alpha.uri.authority).toBe('api.example.com');
    expect(alpha.uri.path).toBe('/v1/items');
    // full and fragment are optional; full is present here
    expect(alpha.uri.full).toBe('https://api.example.com/v1/items?z=1&a%20name=a+b%26c');

    // Params collected + sorted by name
    expect(alpha.uri.params).toBeDefined();
    // They must include both: name=z, value=1 AND name="a name", value="a+b&c"
    // And be sorted alphabetically by 'name' → "a name" first, then "z"
    expect(alpha.uri.params).toEqual([
      { name: 'a name', value: 'a+b&c' },
      { name: 'z', value: '1' }
    ]);

    // queryRaw synthesized with encodeURIComponent and in sorted order
    // "a name" -> "a%20name", "a+b&c" -> "a%2Bb%26c"
    expect(alpha.uri.queryRaw).toBe('a%20name=a%2Bb%26c&z=1');

    // Request headers collected, deduped, sorted by name
    expect(alpha.requestHeaders).toEqual([
      { name: 'Accept',  value: 'application/json' },
      { name: 'X-Trace', value: 't-1' }
    ]);

    // Connection authority (present in any row → included)
    expect(alpha.connection).toEqual({ authority: 'api.example.com' });

    // Response block: httpVersion, bodyBase64, numeric status, reason, headers (deduped)
    expect(alpha.response).toBeDefined();
    expect(alpha.response.httpVersion).toBe('HTTP/2');
    expect(alpha.response.bodyBase64).toBe('UkVTUE9OU0U=');
    expect(alpha.response.status).toBe(201);              // numeric
    expect(alpha.response.reason).toBe('Created');
    expect(alpha.response.headers).toEqual([
      { name: 'Set-Cookie', value: 'id=abc' }
    ]); // deduped

    // ------------ beta assertions ------------
    expect(beta).toBeDefined();
    expect(beta.graph).toBe(G_HTTP);
    expect(beta.id).toBe('beta');

    // Minimal: many fields should be absent after cleanup
    // method/httpVersion/bodyBase64/requestHeaders/response/connection should be undefined
    expect(beta.method).toBeUndefined();
    expect(beta.httpVersion).toBeUndefined();
    expect(beta.bodyBase64).toBeUndefined();
    expect(beta.requestHeaders).toBeUndefined();
    expect(beta.response).toBeUndefined();
    expect(beta.connection).toBeUndefined();

    // URI object is always present but should be cleaned of empty properties
    expect(beta.uri).toBeDefined();
    expect(Object.keys(beta.uri).length).toBe(0); // no scheme/authority/path/full/params/queryRaw/fragment

    // ------------ general shape checks ------------
    // No unexpected extra items
    const ids = items.map(x => x.id).sort();
    expect(ids).toEqual(['alpha', 'beta']);
  });
});
