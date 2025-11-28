const buildSelectAnalyzerFindingsPaged = require('../../../src/utils/finding/builders/analyzer/selectAnalyzerFindingsPaged');

describe('buildSelectAnalyzerFindingsPaged', () => {
  test('builds a paginated query with given limit/offset', () => {
    const sparql = buildSelectAnalyzerFindingsPaged({ limit: 25, offset: 50 });

    expect(sparql).toContain('PREFIX ex: <');
    expect(sparql).toContain('SELECT ?id ?total');
    expect(sparql).toContain('ORDER BY ?scan');
    expect(sparql).toContain('LIMIT 25');
    expect(sparql).toContain('OFFSET 50');
  });

  test('falls back to sanitized defaults when limit/offset are invalid', () => {
    const sparql = buildSelectAnalyzerFindingsPaged({ limit: -10, offset: -5 });

    expect(sparql).toContain('LIMIT 10');
    expect(sparql).toContain('OFFSET 0');
  });

  test('uses defaults when called without parameters', () => {
    const sparql = buildSelectAnalyzerFindingsPaged();

    expect(sparql).toContain('LIMIT 10');
    expect(sparql).toContain('OFFSET 0');
  });
});
