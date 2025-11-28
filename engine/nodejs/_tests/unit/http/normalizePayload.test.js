const normalizeHttpRequestsPayload = require('../../../src/utils/http/builders/normalizePayload');

describe('normalizeHttpRequestsPayload', () => {
  test('wraps a single object into an array', () => {
    const payload = {
      id: 'req-1',
      method: 'GET',
      uri: { full: 'https://example.com' },
    };

    const result = normalizeHttpRequestsPayload(payload);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(payload);
  });

  test('returns the array as-is when payload is an array', () => {
    const payload = [
      { id: 'req-1', method: 'GET', uri: { full: 'https://a.com' } },
      { id: 'req-2', method: 'POST', uri: { full: 'https://b.com' } },
    ];

    const result = normalizeHttpRequestsPayload(payload);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toBe(payload);
    expect(result).toHaveLength(2);
  });

  test('extracts items array when payload is { items: [...] }', () => {
    const items = [
      { id: 'req-1', method: 'GET', uri: { full: 'https://a.com' } },
      { id: 'req-2', method: 'POST', uri: { full: 'https://b.com' } },
    ];

    const payload = {
      items,
      activateResolver: true,
    };

    const result = normalizeHttpRequestsPayload(payload);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toBe(items);
    expect(result).toHaveLength(2);
  });

  test('throws on invalid primitive payload types', () => {
    const badValues = [null, undefined, 42, 'foo', true];

    for (const value of badValues) {
      expect(() => normalizeHttpRequestsPayload(value)).toThrow(
        'Invalid payload: expected object, array, or { items: [...] }'
      );
    }
  });
});
