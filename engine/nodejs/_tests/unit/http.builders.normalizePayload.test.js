const { describe, it, expect } = require('@jest/globals');

const normalizePayload = require('../../src/utils/http/builders/normalizePayload');

const clone = (obj) => JSON.parse(JSON.stringify(obj));

describe('normalizePayload (unit)', () => {
  it('wraps a single object into a 1-length array (preserves fields)', () => {
    // Single item input
    const input = {
      id: 'req-001',
      method: 'GET',
      httpVersion: 'HTTP/1.1',
      uri: { full: 'https://api.example.com/v1/items', scheme: 'https', authority: 'api.example.com', path: '/v1/items' },
      requestHeaders: [{ name: 'Accept', value: 'application/json' }]
    };

    const before = clone(input);
    const out = normalizePayload(input);

    // Basic shape checks
    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(1);

    // Content preserved
    expect(out[0]).toEqual(input);

    // Input not mutated
    expect(input).toEqual(before);
  });

  it('returns the same array (order-preserving) when input is already an array', () => {
    // Already an array
    const input = [
      { id: 'a', method: 'POST', uri: { full: 'https://x/a' } },
      { id: 'b', method: 'PUT',  uri: { full: 'https://x/b' } },
      { id: 'c', method: 'DELETE', uri: { full: 'https://x/c' } }
    ];

    const before = clone(input);
    const out = normalizePayload(input);

    // Ensures array back with same length
    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(3);

    // Preserves order and content
    expect(out[0]).toEqual(input[0]);
    expect(out[1]).toEqual(input[1]);
    expect(out[2]).toEqual(input[2]);

    // No mutation of original array or its elements
    expect(input).toEqual(before);
  });

  it('extracts items from a { items: [...] } wrapper (order-preserving)', () => {
    // Wrapped payload
    const input = {
      items: [
        { id: 'x1', method: 'GET', uri: { full: 'https://x/1' } },
        { id: 'x2', method: 'PATCH', uri: { full: 'https://x/2' } }
      ]
    };

    const before = clone(input);
    const out = normalizePayload(input);

    // Shape
    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(2);

    // Content & order preserved
    expect(out[0]).toEqual(input.items[0]);
    expect(out[1]).toEqual(input.items[1]);

    // Original wrapper not mutated
    expect(input).toEqual(before);
  });

  it('returns an empty array when { items: [] } is provided', () => {
    // Explicitly empty batch
    const input = { items: [] };

    const before = clone(input);
    const out = normalizePayload(input);

    // Shape
    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(0);

    // Original wrapper not mutated
    expect(input).toEqual(before);
  });

  it('does not coerce or decorate items (passes through unknown fields unchanged)', () => {
    // Unknown / extra fields should be preserved by the normalizer
    const input = {
      items: [
        {
          id: 'k1',
          method: 'POST',
          uri: { full: 'https://k/1' },
          // Extra, domain-specific fields:
          graph: 'http://example.com/graphs/http-requests',
          connection: { authority: 'api.example.com' },
          response: { status: 201, reason: 'Created' },
          customExtra: { any: 'thing', nested: { ok: true } }
        }
      ]
    };

    const out = normalizePayload(input);

    expect(out).toHaveLength(1);
    expect(out[0].graph).toBe('http://example.com/graphs/http-requests');
    expect(out[0].connection).toEqual({ authority: 'api.example.com' });
    expect(out[0].response).toEqual({ status: 201, reason: 'Created' });
    expect(out[0].customExtra).toEqual({ any: 'thing', nested: { ok: true } });
  });

  it('is idempotent (calling it twice yields an equivalent result)', () => {
    // Idempotency is useful when the function may be called by different layers
    const input = {
      items: [
        { id: 'r1', method: 'GET', uri: { full: 'https://r/1' } },
        { id: 'r2', method: 'PUT', uri: { full: 'https://r/2' } }
      ]
    };

    const out1 = normalizePayload(input);
    const out2 = normalizePayload(out1);

    // Both results should be equivalent arrays of plain objects
    expect(out2).toEqual(out1);
    expect(out2).toHaveLength(2);
    expect(out2[0]).toEqual({ id: 'r1', method: 'GET', uri: { full: 'https://r/1' } });
    expect(out2[1]).toEqual({ id: 'r2', method: 'PUT', uri: { full: 'https://r/2' } });
  });
});
