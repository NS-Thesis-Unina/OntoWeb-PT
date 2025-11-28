const buildSelectRequests = require('../../../src/utils/http/builders/selectRequests');
const { EX, G_HTTP } = require('../../../src/utils/constants');

describe('buildSelectRequests', () => {
  test('builds a basic SELECT with defaults and no filters/ids', () => {
    const sparql = buildSelectRequests();

    expect(sparql).toContain(`PREFIX ex: <${EX}>`);
    expect(sparql).toContain('PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>');
    expect(sparql).toContain(`GRAPH <${G_HTTP}> {`);

    expect(sparql).not.toContain('VALUES ?idVal');

    expect(sparql).toContain('LIMIT 50');
    expect(sparql).toContain('OFFSET 0');
  });

  test('includes a VALUES block when ids are provided', () => {
    const sparql = buildSelectRequests({
      ids: ['req-1', 'req-2'],
    });

    expect(sparql).toMatch(
      /VALUES\s+\?idVal\s*{\s*"req-1"\s+"req-2"\s*}/
    );
  });

  test('applies filters correctly in WHERE clause', () => {
    const sparql = buildSelectRequests({
      filters: {
        method: 'get',
        scheme: 'https',
        authority: 'example.com',
        path: '/test',
        text: 'foo=bar',
        headerName: 'Content-Type',
        headerValue: 'application/json',
      },
      limit: 10,
      offset: 20,
    });

    expect(sparql).toMatch(/FILTER\s*\(\s*ucase\(\s*str\(\?methodName\)\s*\)\s*=\s*"GET"\s*\)/i);

    expect(sparql).toContain('FILTER(str(?scheme) = "https")');
    expect(sparql).toContain('FILTER(str(?authority) = "example.com")');
    expect(sparql).toContain('FILTER(str(?path) = "/test")');

    expect(sparql).toContain('FILTER(CONTAINS(str(?uriFull), "foo=bar"))');

    expect(sparql).toContain(
      'FILTER(lcase(str(?hdrName)) = "content-type")'
    );

    expect(sparql).toContain(
      'FILTER(str(?hdrValue) = "application/json")'
    );

    expect(sparql).toContain('LIMIT 10');
    expect(sparql).toContain('OFFSET 20');
  });

  test('sanitizes negative limit/offset using sanitizeLimit/sanitizeOffset fallbacks', () => {
    const sparql = buildSelectRequests({
      filters: {},
      limit: -5,
      offset: -10,
    });

    expect(sparql).toContain('LIMIT 50');
    expect(sparql).toContain('OFFSET 0');
  });
});
