const buildSelectTechstackFindingsPaged = require('../../../src/utils/finding/builders/techstack/selectTechstackFindingsPaged');

describe('buildSelectTechstackFindingsPaged', () => {
  test('builds a paginated query with given limit/offset', () => {
    const sparql = buildSelectTechstackFindingsPaged({ limit: 25, offset: 10 });

    expect(sparql).toMatch(/PREFIX\s+ex:\s+</);

    expect(sparql).toMatch(/a\s+ex:TechstackScan\s*;/);
    expect(sparql).toMatch(/ex:detectedByResolver\s+ex:TechstackResolverInstance\s*\./);

    expect(sparql).toMatch(/LIMIT\s+25\b/);
    expect(sparql).toMatch(/OFFSET\s+10\b/);
  });

  test('falls back to sanitized defaults when limit/offset are invalid', () => {
    const sparql = buildSelectTechstackFindingsPaged({ limit: -5, offset: -3 });

    expect(sparql).toMatch(/LIMIT\s+10\b/);
    expect(sparql).toMatch(/OFFSET\s+0\b/);
  });

  test('uses defaults when called without parameters', () => {
    const sparql = buildSelectTechstackFindingsPaged();

    expect(sparql).toMatch(/LIMIT\s+10\b/);
    expect(sparql).toMatch(/OFFSET\s+0\b/);
  });
});
