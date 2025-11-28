jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
  },
}));

jest.mock('../../../src/utils/logs/logger', () => ({
  makeLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

const axios = require('axios').default;
const {
  resolveTechstack,
} = require('../../../src/utils/resolvers/techstack/resolveTechstack');

describe('resolveTechstack', () => {
  const sampleNvdResponse = {
    vulnerabilities: [
      {
        cve: {
          id: 'CVE-2024-0001',
          metrics: {
            cvssMetricV31: [
              {
                cvssData: {
                  baseScore: 9.8,
                  baseSeverity: 'CRITICAL',
                },
              },
            ],
          },
          configurations: [
            {
              nodes: [
                {
                  cpeMatch: [{ criteria: 'cpe:/a:nginx:nginx:1.22.0' }],
                },
              ],
            },
          ],
        },
      },
    ],
  };

  beforeEach(() => {
    axios.get.mockReset();
  });

  test('resolves technologies, waf, headers and cookies into findings and summary', async () => {
    axios.get.mockResolvedValue({ data: sampleNvdResponse });

    const result = await resolveTechstack({
      technologies: [{ name: 'nginx', version: '1.22.0' }],
      waf: [{ name: 'mod_security' }],
      secureHeaders: [
        {
          header: 'Strict-Transport-Security',
          description: 'HSTS header',
          urls: ['https://example.com'],
        },
      ],
      cookies: [
        {
          name: 'session',
          domain: 'example.com',
          secure: false,
          httpOnly: false,
          sameSite: null,
          expirationDate: null,
        },
      ],
      mainDomain: 'example.com',
    });

    expect(result.ok).toBe(true);

    expect(result.summary.totalTechnologies).toBe(1);
    expect(result.summary.technologiesWithKnownCVE).toBe(1);
    expect(result.summary.totalWaf).toBe(1);
    expect(result.summary.wafWithKnownCVE).toBe(1);
    expect(result.summary.totalHeaderFindings).toBeGreaterThan(0);
    expect(result.summary.totalCookieFindings).toBeGreaterThan(0);

    expect(result.summary.totalFindings).toBe(result.findings.length);

    const kinds = new Set(result.findings.map((f) => f.kind));
    expect(kinds).toEqual(
      new Set(['TechnologyCVE', 'WafCVE', 'HeaderIssue', 'CookieIssue'])
    );
  });

  test('handles empty NVD responses and still emits header/cookie findings', async () => {
    axios.get.mockResolvedValue({ data: { vulnerabilities: [] } });

    const result = await resolveTechstack({
      technologies: [{ name: 'nginx', version: '1.22.0' }],
      waf: [{ name: 'mod_security' }],
      secureHeaders: [
        {
          header: 'Content-Security-Policy',
          description: 'CSP header',
          urls: [],
        },
      ],
      cookies: [
        {
          name: 'sid',
          domain: 'example.com',
          secure: false,
          httpOnly: false,
          sameSite: undefined,
          expirationDate: null,
        },
      ],
      mainDomain: 'example.com',
    });

    expect(result.ok).toBe(true);
    expect(result.summary.technologiesWithKnownCVE).toBe(0);
    expect(result.summary.wafWithKnownCVE).toBe(0);

    const kinds = new Set(result.findings.map((f) => f.kind));
    expect(kinds.has('HeaderIssue')).toBe(true);
    expect(kinds.has('CookieIssue')).toBe(true);
  });
});
