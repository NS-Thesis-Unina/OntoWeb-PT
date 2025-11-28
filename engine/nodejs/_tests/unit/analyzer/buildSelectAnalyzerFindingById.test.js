const buildSelectAnalyzerFindingById = require('../../../src/utils/finding/builders/analyzer/selectAnalyzerFindingById');
const { normalizeFindingIri } = require('../../../src/utils/finding/builders/helpers/normalizeFindingIri');

describe('buildSelectAnalyzerFindingById', () => {
  test('builds a SELECT query binding the normalized finding IRI', () => {
    const rawId = 'urn:finding:analyzer:test-id';
    const normalized = normalizeFindingIri(rawId);

    const sparql = buildSelectAnalyzerFindingById({ id: rawId });

    expect(sparql).toContain(`BIND(IRI("${normalized}") AS ?scan)`);
    expect(sparql).toContain('SELECT');
    expect(sparql).toContain('ex:AnalyzerScan');
    expect(sparql).toContain('?id');
    expect(sparql).toContain('?severity');
    expect(sparql).toContain('?codeSnippet');
  });
});
