jest.mock('../../../src/utils/logs/logger', () => ({
  makeLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

const { resolveAnalyzer } = require('../../../src/utils/resolvers/analyzer/resolveAnalyzer');

describe('resolveAnalyzer', () => {
  test('returns ok=true and empty stats when there is no HTML/JS/forms/iframes', async () => {
    const result = await resolveAnalyzer({
      url: 'https://example.test/',
      html: '',
      scripts: [],
      forms: [],
      iframes: [],
      includeSnippets: false,
    });

    expect(result.ok).toBe(true);
    expect(result.pageUrl).toBe('https://example.test/');
    expect(result.totalFindings).toBe(0);

    expect(result.stats).toEqual({
      high: 0,
      medium: 0,
      low: 0,
    });

    expect(result.summary).toEqual({
      scripts: 0,
      forms: 0,
      iframes: 0,
      html: 0,
    });

    expect(Array.isArray(result.findings)).toBe(true);
    expect(result.findings.length).toBe(0);
  });
});
