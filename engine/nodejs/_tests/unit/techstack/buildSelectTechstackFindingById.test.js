const buildSelectTechstackFindingById = require('../../../src/utils/finding/builders/techstack/selectTechstackFindingById');

describe('buildSelectTechstackFindingById', () => {
  test('builds a SELECT query binding the normalized finding IRI', () => {
    const rawId = 'urn:finding:http:cors-misconfig:req-1';
    const sparql = buildSelectTechstackFindingById({ id: rawId });

    const normalizedSuffix = encodeURIComponent('http:cors-misconfig:req-1');
    const expectedIri = `urn:finding:${normalizedSuffix}`;

    expect(sparql).toContain(`BIND(IRI("${expectedIri}") AS ?finding)`);

    expect(sparql).toMatch(/PREFIX\s+ex:\s+</);
    expect(sparql).toContain('GRAPH <');
    expect(sparql).toContain('a ex:TechstackFinding');
  });
});
