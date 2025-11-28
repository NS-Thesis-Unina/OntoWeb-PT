const buildSelectRequestsPaged = require('../../../src/utils/http/builders/selectPaged');
const { EX, G_HTTP } = require('../../../src/utils/constants');

describe('buildSelectRequestsPaged', () => {
  test('builds a SELECT with total subquery and paged IDs', () => {
    const sparql = buildSelectRequestsPaged();

    expect(sparql).toContain(`PREFIX ex: <${EX}>`);
    expect(sparql).toContain('PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>');

    expect(sparql).toMatch(/\(\?idVal\s+AS\s+\?id\)/);
    expect(sparql).toContain('?total');

    expect(sparql).toMatch(/SELECT\s*\(COUNT\(DISTINCT\s+\?req0\)\s+AS\s+\?total\)\s+WHERE\s*{\s*GRAPH\s*<[^>]+>/);
    expect(sparql).toContain(`GRAPH <${G_HTTP}> {`);

    expect(sparql).toMatch(/SELECT\s+DISTINCT\s+\?idVal\s+WHERE\s*{\s*GRAPH\s*<[^>]+>/);
    expect(sparql).toMatch(/ORDER BY\s+\?idVal/);

    expect(sparql).toContain('LIMIT 10');
    expect(sparql).toContain('OFFSET 0');
  });

  test('applies filters correctly in total and paging subqueries', () => {
    const sparql = buildSelectRequestsPaged({
      filters: {
        method: 'get',
        scheme: 'https',
        authority: 'example.com',
        path: '/test',
        text: 'foo=bar',
        headerName: 'Content-Type',
        headerValue: 'application/json',
      },
      limit: 5,
      offset: 15,
    });

    expect(sparql).toMatch(/FILTER\s*\(\s*UCASE\(STR\(\?methodName0\)\)\s*=\s*"GET"\s*\)/);
    expect(sparql).toContain('FILTER(STR(?scheme0) = "https")');
    expect(sparql).toContain('FILTER(STR(?authority0) = "example.com")');
    expect(sparql).toContain('FILTER(STR(?path0) = "/test")');
    expect(sparql).toContain('FILTER(CONTAINS(STR(?uriFull0), "foo=bar"))');
    expect(sparql).toContain(
      'FILTER(LCASE(STR(?hdrName0)) = "content-type")'
    );
    expect(sparql).toContain(
      'FILTER(STR(?hdrValue0) = "application/json")'
    );

    expect(sparql).toContain('LIMIT 5');
    expect(sparql).toContain('OFFSET 15');
  });

  test('sanitizes negative limit/offset using sanitizeLimit/sanitizeOffset fallbacks', () => {
    const sparql = buildSelectRequestsPaged({
      filters: {},
      limit: -3,
      offset: -20,
    });

    expect(sparql).toContain('LIMIT 10');
    expect(sparql).toContain('OFFSET 0');
  });

  test('ensures page join relates ?idVal2 to ?idVal in final GRAPH block', () => {
    const sparql = buildSelectRequestsPaged();

    expect(sparql).toContain('BIND(COALESCE(?idExplicit, STRAFTER(STR(?req), "urn:req:")) AS ?idVal2)');
    expect(sparql).toContain('FILTER(?idVal2 = ?idVal)');
  });
});
