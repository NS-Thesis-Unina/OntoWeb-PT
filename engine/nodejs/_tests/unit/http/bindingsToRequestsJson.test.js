const bindingsToRequestsJson = require('../../../src/utils/http/bindings/toJson');
const { G_HTTP } = require('../../../src/utils/constants');

/**
 * Helper to create a cell SPARQL JSON.
 * @param {string} value
 */
function lit(value) {
  return { type: 'literal', value };
}

describe('bindingsToRequestsJson', () => {
  test('merges multiple rows for the same id into a single HttpRequest', () => {
    const bindings = [
      {
        id: lit('req-1'),
        httpVersion: lit('HTTP/1.1'),
        methodName: lit('GET'),
        uriFull: lit('https://example.com/test'),
        scheme: lit('https'),
        authority: lit('example.com'),
        path: lit('/test'),
        hdrName: lit('X-Test'),
        hdrValue: lit('1'),
        paramName: lit('b'),
        paramValue: lit('2'),
        connAuthority: lit('proxy.local'),
        resHttpVersion: lit('HTTP/1.1'),
        statusCodeNumber: lit('200'),
        reasonPhrase: lit('OK'),
        rhdrName: lit('Content-Type'),
        rhdrValue: lit('application/json'),
      },
      {
        id: lit('req-1'),
        methodName: lit('GET'),
        uriFull: lit('https://example.com/test'),
        scheme: lit('https'),
        authority: lit('example.com'),
        path: lit('/test'),
        hdrName: lit('X-Test'),
        hdrValue: lit('1'),
        paramName: lit('a'),
        paramValue: lit('1'),
        rhdrName: lit('X-Other'),
        rhdrValue: lit('v'),
      },
    ];

    const { items } = bindingsToRequestsJson(bindings);

    expect(items).toHaveLength(1);
    const req = items[0];

    expect(req.id).toBe('req-1');
    expect(req.method).toBe('GET');
    expect(req.httpVersion).toBe('HTTP/1.1');
    expect(req.graph).toBe(G_HTTP);

    expect(req.uri).toEqual({
      full: 'https://example.com/test',
      scheme: 'https',
      authority: 'example.com',
      path: '/test',
      params: [
        { name: 'a', value: '1' },
        { name: 'b', value: '2' },
      ],
      queryRaw: 'a=1&b=2',
    });

    expect(req.requestHeaders).toEqual([
      { name: 'X-Test', value: '1' },
    ]);

    expect(req.connection).toEqual({ authority: 'proxy.local' });

    expect(req.response).toBeDefined();
    expect(req.response.httpVersion).toBe('HTTP/1.1');
    expect(req.response.status).toBe(200);
    expect(req.response.reason).toBe('OK');

    expect(req.response.headers).toEqual([
      { name: 'Content-Type', value: 'application/json' },
      { name: 'X-Other', value: 'v' },
    ]);
  });

  test('creates separate items for different request ids', () => {
    const bindings = [
      {
        id: lit('req-1'),
        methodName: lit('GET'),
        uriFull: lit('https://a.com'),
      },
      {
        id: lit('req-2'),
        methodName: lit('POST'),
        uriFull: lit('https://b.com'),
      },
    ];

    const { items } = bindingsToRequestsJson(bindings);

    expect(items).toHaveLength(2);

    const byId = Object.fromEntries(items.map((r) => [r.id, r]));

    expect(byId['req-1'].method).toBe('GET');
    expect(byId['req-1'].uri.full).toBe('https://a.com');

    expect(byId['req-2'].method).toBe('POST');
    expect(byId['req-2'].uri.full).toBe('https://b.com');
  });

  test('cleans up optional fields when they are empty or missing', () => {
    const bindings = [
      {
        id: lit('req-1'),
        methodName: lit('GET'),
        uriFull: lit('https://example.com'),
      },
    ];

    const { items } = bindingsToRequestsJson(bindings);
    expect(items).toHaveLength(1);
    const req = items[0];

    expect(req.method).toBe('GET');

    expect(req.uri.full).toBe('https://example.com');
    expect(req.uri.scheme).toBeUndefined();
    expect(req.uri.authority).toBeUndefined();
    expect(req.uri.path).toBeUndefined();
    expect(req.uri.fragment).toBeUndefined();
    expect(req.uri.queryRaw).toBeUndefined();
    expect(req.uri.params).toBeUndefined();

    expect(req.requestHeaders).toBeUndefined();
    expect(req.bodyBase64).toBeUndefined();
    expect(req.response).toBeUndefined();
    expect(req.connection).toBeUndefined();
  });
});
