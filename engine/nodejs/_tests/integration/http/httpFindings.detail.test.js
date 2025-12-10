const bindingsToHttpFindingDetail = require('../../../src/utils/finding/bindings/http/httpFindingDetail');

/**
 * Helper for SPARQL JSON cell.
 * @param {string|number} value
 */
function lit(value) {
  return { type: 'literal', value: String(value) };
}

describe('bindingsToHttpFindingDetail', () => {
  test('aggregates scalar fields, http info and relatedHttp from multiple rows', () => {
    const bindings = [
      {
        id: lit('urn:finding:1'),
        resolver: lit('ex:HttpResolverInstance'),
        vulnType: lit('ex:InsecureCookie'),
        severity: lit('high'),
        findingCategory: lit('Authentication & Session'),
        owaspCategory: lit('A07'),
        ruleId: lit('insecure-cookie'),
        description: lit('Cookie not marked as Secure or HttpOnly'),
        remediation: lit('Set Secure and HttpOnly flags'),
        httpMethod: lit('GET'),
        requestUrl: lit('https://example.com'),
        responseStatus: lit('200'),
        relatedHttp: lit('urn:req:1'),
      },
      {
        id: lit('urn:finding:1'),
        resolver: lit('ex:OtherResolver'),
        vulnType: lit('ex:SomethingElse'),
        severity: lit('low'),
        findingCategory: lit('Other'),
        owaspCategory: lit('A01'),
        ruleId: lit('something-else'),
        description: lit('Different description'),
        remediation: lit('Different remediation'),
        httpMethod: lit('POST'),
        requestUrl: lit('https://evil.com'),
        responseStatus: lit('500'),
        relatedHttp: lit('urn:req:2'),
      },
    ];

    const detail = bindingsToHttpFindingDetail(bindings);

    expect(detail).not.toBeNull();
    expect(detail.id).toBe('urn:finding:1');

    expect(detail.resolver).toBe('ex:HttpResolverInstance');
    expect(detail.vulnerabilityType).toBe('ex:InsecureCookie');
    expect(detail.severity).toBe('high');
    expect(detail.findingCategory).toBe('Authentication & Session');
    expect(detail.owaspCategory).toBe('A07');
    expect(detail.ruleId).toBe('insecure-cookie');
    expect(detail.description).toBe('Cookie not marked as Secure or HttpOnly');
    expect(detail.remediation).toBe('Set Secure and HttpOnly flags');

    expect(detail.http).toEqual({
      method: 'GET',
      url: 'https://example.com',
      status: 200,
    });

    expect(detail.relatedHttp).toEqual(['urn:req:1', 'urn:req:2']);
  });

  test('drops empty http and relatedHttp when no data available', () => {
    const bindings = [
      {
        id: lit('urn:finding:empty'),
        severity: lit('medium'),
      },
    ];

    const detail = bindingsToHttpFindingDetail(bindings);

    expect(detail).not.toBeNull();
    expect(detail.id).toBe('urn:finding:empty');

    expect(detail.severity).toBe('medium');

    expect(detail.http).toBeUndefined();
    expect(detail.relatedHttp).toBeUndefined();
  });

  test('ignores non-numeric responseStatus values', () => {
    const bindings = [
      {
        id: lit('urn:finding:status'),
        httpMethod: lit('GET'),
        requestUrl: lit('https://example.com'),
        responseStatus: lit('not-a-number'),
      },
    ];

    const detail = bindingsToHttpFindingDetail(bindings);

    expect(detail).not.toBeNull();
    expect(detail.id).toBe('urn:finding:status');

    expect(detail.http).toEqual({
      method: 'GET',
      url: 'https://example.com',
    });
    expect(detail.http.status).toBeUndefined();
  });

  test('returns null when bindings is empty', () => {
    const detail = bindingsToHttpFindingDetail([]);

    expect(detail).toBeNull();
  });

  test('returns null when no row has an id', () => {
    const bindings = [
      {
        severity: lit('high'),
        httpMethod: lit('GET'),
      },
    ];

    const detail = bindingsToHttpFindingDetail(bindings);

    expect(detail).toBeNull();
  });
});
