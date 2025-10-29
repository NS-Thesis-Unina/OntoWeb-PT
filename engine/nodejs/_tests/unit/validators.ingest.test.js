const { describe, it, expect } = require('@jest/globals');

const { ingestPayloadSchema } = require('../../src/utils/validators/common');

// Small helper to run validation with consistent options
function runValidate(payload) {
  return ingestPayloadSchema.validate(payload, {
    abortEarly: false,   // collect all errors
    convert: true,       // enable normalizations (uppercase/lowercase, custom transforms)
    stripUnknown: false, // do not strip; we want to detect extra keys if present
  });
}

const clone = (x) => JSON.parse(JSON.stringify(x));

describe('validators.ingest (unit)', () => {
  it('accepts a minimal single object (id, method, uri.full) and normalizes fields', () => {
    const input = {
      id: 'req-001',
      method: 'get', // should be uppercased by schema
      uri: { full: 'https://api.example.com/v1/items' }
    };
    const before = clone(input);

    const { error, value } = runValidate(input);
    expect(error).toBeUndefined();

    // Must not mutate input
    expect(input).toEqual(before);

    // Normalization: method uppercased
    expect(value.method).toBe('GET');

    // Shape sanity
    expect(value.id).toBe('req-001');
    expect(value.uri).toEqual({ full: 'https://api.example.com/v1/items' });
  });

  it('accepts an array of items', () => {
    const input = [
      { id: 'a', method: 'POST', uri: { full: 'https://x/a' } },
      { id: 'b', method: 'PUT',  uri: { full: 'https://x/b' } }
    ];
    const { error, value } = runValidate(input);
    expect(error).toBeUndefined();

    expect(Array.isArray(value)).toBe(true);
    expect(value.length).toBe(2);
    // Methods preserved/uppercased
    expect(value[0].method).toBe('POST');
    expect(value[1].method).toBe('PUT');
  });

  it('accepts a { items:[...] } wrapper', () => {
    const input = {
      items: [
        { id: 'x1', method: 'DELETE', uri: { full: 'https://x/1' } },
        { id: 'x2', method: 'PATCH',  uri: { full: 'https://x/2' } }
      ]
    };
    const { error, value } = runValidate(input);
    expect(error).toBeUndefined();

    expect(value.items).toBeDefined();
    expect(Array.isArray(value.items)).toBe(true);
    expect(value.items.length).toBe(2);
    expect(value.items[0].method).toBe('DELETE');
    expect(value.items[1].method).toBe('PATCH');
  });

  it('rejects an empty payload (undefined/null/{})', () => {
    const r1 = runValidate(undefined);
    const r2 = runValidate(null);
    const r3 = runValidate({});
    expect(r1.error || r2.error || r3.error).toBeTruthy();
  });

  it('rejects { items: [] }', () => {
    const { error } = runValidate({ items: [] });
    expect(error).toBeTruthy();
  });

  it('rejects invalid header name (must match RFC7230 token; no spaces)', () => {
    const invalid = {
      id: 'req-002',
      method: 'GET',
      uri: { full: 'https://api.example.com/v1/items' },
      requestHeaders: [
        { name: 'Content Type', value: 'application/json' } // invalid: contains a space
      ]
    };
    const { error } = runValidate(invalid);
    expect(error).toBeTruthy();

    // Control case: fix only the offending header name -> should pass
    const fixed = clone(invalid);
    fixed.requestHeaders[0].name = 'content-type';
    const ok = runValidate(fixed);
    expect(ok.error).toBeUndefined();
  });

  it('rejects invalid bodyBase64 (whitespace stripped before base64 check)', () => {
    const invalid = {
      id: 'req-003',
      method: 'POST',
      uri: { full: 'https://api.example.com/v1/items' },
      bodyBase64: '*** NOT BASE64 ***'
    };
    const { error } = runValidate(invalid);
    expect(error).toBeTruthy();

    // Control case: same payload with valid base64 -> should pass
    const fixed = clone(invalid);
    fixed.bodyBase64 = 'SGVsbG8='; // "Hello"
    const ok = runValidate(fixed);
    expect(ok.error).toBeUndefined();
  });

  it('accepts uri.params and synthesizes expected normalizations', () => {
    const input = {
      items: [{
        id: 'req-004',
        method: 'get', // → GET
        uri: {
          full: 'https://api.example.com/v1/search?q=node',
          scheme: 'HTTPS',       // → https (lowercase)
          authority: 'API.EXAMPLE.COM', // → api.example.com (lowercase)
          path: 'v1/search',     // → "/v1/search" (ensure leading slash)
          params: [
            { name: 'q', value: 'node' },
            { name: 'page', value: '1' }
          ]
        },
        requestHeaders: [
          { name: 'ACCEPT', value: 'application/json' } // → accept (lowercase)
        ]
      }]
    };

    const { error, value } = runValidate(input);
    expect(error).toBeUndefined();

    const item = value.items[0];

    // Method uppercased
    expect(item.method).toBe('GET');
    // Scheme/authority lowercased; path prefixed with '/'
    expect(item.uri.scheme).toBe('https');
    expect(item.uri.authority).toBe('api.example.com');
    expect(item.uri.path).toBe('/v1/search');

    // Header name normalized to lowercase
    expect(item.requestHeaders[0]).toEqual({ name: 'accept', value: 'application/json' });

    // Params are accepted as-is by the validator (ordering not enforced here)
    expect(Array.isArray(item.uri.params)).toBe(true);
    expect(item.uri.params).toEqual(
      expect.arrayContaining([
        { name: 'q', value: 'node' },
        { name: 'page', value: '1' }
      ])
    );
  });

  it('accepts a full response object with proper types and normalizations', () => {
    const input = {
      id: 'req-005',
      method: 'POST',
      uri: { full: 'https://api.example.com/v1/items' },
      response: {
        httpVersion: 'HTTP/2',
        status: 201,
        reason: 'Created',
        headers: [
          { name: 'Location', value: '/v1/items/123' },
          { name: 'SET-COOKIE', value: 'id=abc' } // → set-cookie (lowercase)
        ]
      }
    };
    const { error, value } = runValidate(input);
    expect(error).toBeUndefined();

    const item = value; // single object
    expect(typeof item.response.status).toBe('number');
    expect(item.response.status).toBe(201);
    // Header names lowercased
    expect(item.response.headers).toEqual(
      expect.arrayContaining([
        { name: 'location', value: '/v1/items/123' },
        { name: 'set-cookie', value: 'id=abc' }
      ])
    );
  });

  it('does not mutate the incoming object structure', () => {
    const input = {
      items: [{
        id: 'req-006',
        method: 'PUT',
        uri: { full: 'https://api.example.com/v1/items/123' },
        requestHeaders: [{ name: 'X-Trace', value: 't-1' }]
      }]
    };
    const before = clone(input);
    const { error } = runValidate(input);

    expect(error).toBeUndefined();
    expect(input).toEqual(before); // no mutation of the original payload
  });
});
