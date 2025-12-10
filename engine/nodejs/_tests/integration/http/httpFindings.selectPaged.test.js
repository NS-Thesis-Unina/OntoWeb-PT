const buildSelectHttpFindingsPaged = require('../../../src/utils/finding/builders/http/selectHttpFindingsPaged');
const { EX, G_FINDINGS } = require('../../../src/utils/constants');

describe('buildSelectHttpFindingsPaged', () => {
  test('builds a SELECT with total and paged findings', () => {
    const sparql = buildSelectHttpFindingsPaged();

    expect(sparql).toContain(`PREFIX ex: <${EX}>`);

    expect(sparql).toMatch(/SELECT\s+\?id\s+\?total/);

    const occurrences = (sparql.match(new RegExp(`GRAPH <${G_FINDINGS}>`, 'g')) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);

    expect(sparql).toMatch(
      /SELECT\s*\(COUNT\(DISTINCT\s+\?finding\)\s+AS\s+\?total\)\s+WHERE\s*{\s*GRAPH\s*<[^>]+>/
    );

    expect(sparql).toContain('?finding a ex:HttpFinding ;');
    expect(sparql).toContain('ex:detectedByResolver ex:HttpResolverInstance');

    expect(sparql).toMatch(/SELECT\s+DISTINCT\s+\?finding\s+WHERE\s*{\s*GRAPH\s*<[^>]+>/);
    expect(sparql).toMatch(/ORDER BY\s+\?finding/);

    expect(sparql).toContain('LIMIT 10');
    expect(sparql).toContain('OFFSET 0');

    expect(sparql).toContain('BIND(STR(?finding) AS ?id)');
  });

  test('applies custom limit/offset and sanitizes negative values', () => {
    const sparql = buildSelectHttpFindingsPaged({ limit: 5, offset: 20 });

    expect(sparql).toContain('LIMIT 5');
    expect(sparql).toContain('OFFSET 20');

    const sparqlNeg = buildSelectHttpFindingsPaged({ limit: -3, offset: -10 });

    expect(sparqlNeg).toContain('LIMIT 10');
    expect(sparqlNeg).toContain('OFFSET 0');
  });
});
