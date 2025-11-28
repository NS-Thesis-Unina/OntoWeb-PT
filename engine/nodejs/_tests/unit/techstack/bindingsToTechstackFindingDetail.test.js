const bindingsToTechstackFindingDetail = require('../../../src/utils/finding/bindings/techstack/techstackFindingDetail');

describe('bindingsToTechstackFindingDetail', () => {
  test('aggregates scalar, software, header and cookie evidence', () => {
    const bindings = [
      {
        id: { type: 'uri', value: 'urn:finding:techstack:1' },
        resolver: { type: 'uri', value: 'resolver:techstack' },
        vulnType: { type: 'uri', value: 'http://example.com/cve/CVE-2024-0001' },
        severity: { type: 'literal', value: 'HIGH' },
        findingCategory: { type: 'literal', value: 'TechnologyVulnerability' },
        owaspCategory: { type: 'literal', value: 'A01' },
        ruleId: { type: 'literal', value: 'nvd_cve_match' },
        description: { type: 'literal', value: 'Test description' },
        remediation: { type: 'literal', value: 'Fix it' },
        evidenceType: { type: 'literal', value: 'Technology' },
        technologyName: { type: 'literal', value: 'nginx' },
        technologyVersion: { type: 'literal', value: '1.22.0' },
        cpeLiteral: { type: 'literal', value: 'cpe:/a:nginx:nginx:1.22.0' },
        cveIri: { type: 'uri', value: 'http://example.com/cve/CVE-2024-0001' },
        cveId: { type: 'literal', value: 'CVE-2024-0001' },
        cvssScore: { type: 'literal', value: '9.8' },
        cvssSeverity: { type: 'literal', value: 'CRITICAL' },
        cpeLabel: { type: 'literal', value: 'nginx 1.22.0' },
      },
      {
        id: { type: 'uri', value: 'urn:finding:techstack:1' },
        evidenceType: { type: 'literal', value: 'Header' },
        headerName: { type: 'literal', value: 'Strict-Transport-Security' },
        headerUrl: { type: 'literal', value: 'https://example.com' },
      },
      {
        id: { type: 'uri', value: 'urn:finding:techstack:1' },
        evidenceType: { type: 'literal', value: 'Cookie' },
        cookieIri: { type: 'uri', value: 'urn:cookie:1' },
        cookieName: { type: 'literal', value: 'SID' },
        cookieDomain: { type: 'literal', value: 'example.com' },
        cookiePath: { type: 'literal', value: '/' },
        cookieSecure: { type: 'literal', value: 'true' },
        cookieHttpOnly: { type: 'literal', value: 'false' },
        cookieSameSite: { type: 'literal', value: 'Lax' },
        cookieExpiration: { type: 'literal', value: '12345678' },
      },
    ];

    const detail = bindingsToTechstackFindingDetail(bindings);
    expect(detail).not.toBeNull();

    expect(detail).toMatchObject({
      id: 'urn:finding:techstack:1',
      resolver: 'resolver:techstack',
      vulnerabilityType: 'http://example.com/cve/CVE-2024-0001',
      severity: 'HIGH',
      findingCategory: 'TechnologyVulnerability',
      owaspCategory: 'A01',
      ruleId: 'nvd_cve_match',
      description: 'Test description',
      remediation: 'Fix it',
    });

    expect(detail.software).toBeDefined();
    expect(detail.software).toMatchObject({
      type: 'Technology',
      name: 'nginx',
      version: '1.22.0',
    });

    expect(detail.software.cpe).toEqual(
      expect.arrayContaining(['cpe:/a:nginx:nginx:1.22.0', 'nginx 1.22.0'])
    );

    expect(detail.software.cve).toEqual([
      expect.objectContaining({
        iri: 'http://example.com/cve/CVE-2024-0001',
        id: 'CVE-2024-0001',
        severity: 'CRITICAL',
        score: 9.8,
      }),
    ]);

    expect(detail.header).toEqual({
      name: 'Strict-Transport-Security',
      urls: ['https://example.com'],
    });

    expect(detail.cookies).toHaveLength(1);
    expect(detail.cookies[0]).toMatchObject({
      iri: 'urn:cookie:1',
      name: 'SID',
      domain: 'example.com',
      path: '/',
      secure: true,
      httpOnly: false,
      sameSite: 'Lax',
      expiration: 12345678,
    });
  });

  test('returns null when bindings array is empty', () => {
    const detail = bindingsToTechstackFindingDetail([]);
    expect(detail).toBeNull();
  });
});
