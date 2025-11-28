const bindingsToAnalyzerFindingDetail = require('../../../src/utils/finding/bindings/analyzer/analyzerFindingDetail');

describe('bindingsToAnalyzerFindingDetail', () => {
  test('aggregates scalar, context and HTML structure into a single detail object', () => {
    const bindings = [
      {
        id: { type: 'uri', value: 'urn:finding:1' },
        resolver: { type: 'uri', value: 'ex:AnalyzerResolverInstance' },
        vulnType: { type: 'uri', value: 'ex:Xss' },
        severity: { type: 'literal', value: 'HIGH' },
        findingCategory: { type: 'literal', value: 'DOM XSS' },
        owaspCategory: { type: 'literal', value: 'A03' },
        ruleId: { type: 'literal', value: 'no-innerhtml' },
        description: { type: 'literal', value: 'desc' },
        remediation: { type: 'literal', value: 'fix it' },
        contextType: { type: 'literal', value: 'script' },
        contextIndex: { type: 'literal', value: '0' },
        contextOrigin: { type: 'literal', value: 'inline' },
        contextSrc: { type: 'literal', value: 'https://example.test/' },
        formAction: { type: 'literal', value: '/submit' },
        formMethod: { type: 'literal', value: 'POST' },
        codeSnippet: { type: 'literal', value: 'eval("alert(1)")' },

        htmlTag: { type: 'uri', value: 'urn:html:tag:root' },
        htmlTagSource: { type: 'literal', value: '<script src="...">' },
        htmlField: { type: 'uri', value: 'urn:html:field:root-src' },
        htmlFieldSource: { type: 'literal', value: 'src="...js"' },

        childTag: { type: 'uri', value: 'urn:html:tag:child1' },
        childTagSource: { type: 'literal', value: '<input name="q">' },
        childField: { type: 'uri', value: 'urn:html:field:child1-name' },
        childFieldSource: { type: 'literal', value: 'name="q"' },
      },
      {
        id: { type: 'uri', value: 'urn:finding:1' },
        htmlTag: { type: 'uri', value: 'urn:html:tag:root' },
        childTag: { type: 'uri', value: 'urn:html:tag:child1' },
        childField: { type: 'uri', value: 'urn:html:field:child1-type' },
        childFieldSource: { type: 'literal', value: 'type="text"' },
      },
    ];

    const detail = bindingsToAnalyzerFindingDetail(bindings);
    expect(detail).not.toBeNull();

    if (!detail) return;

    expect(detail.id).toBe('urn:finding:1');
    expect(detail.resolver).toBe('ex:AnalyzerResolverInstance');
    expect(detail.vulnerabilityType).toBe('ex:Xss');
    expect(detail.severity).toBe('HIGH');
    expect(detail.findingCategory).toBe('DOM XSS');
    expect(detail.owaspCategory).toBe('A03');
    expect(detail.ruleId).toBe('no-innerhtml');
    expect(detail.description).toBe('desc');
    expect(detail.remediation).toBe('fix it');
    expect(detail.codeSnippet).toBe('eval("alert(1)")');

    expect(detail.context).toEqual({
      type: 'script',
      index: 0,
      origin: 'inline',
      src: 'https://example.test/',
      formAction: '/submit',
      formMethod: 'POST',
    });

    expect(Array.isArray(detail.html)).toBe(true);
    expect(detail.html.length).toBe(1);

    const root = detail.html[0];
    expect(root.iri).toBe('urn:html:tag:root');
    expect(root.source).toBe('<script src="...">');
    expect(root.fields).toHaveLength(1);
    expect(root.fields[0]).toEqual({
      iri: 'urn:html:field:root-src',
      source: 'src="...js"',
    });

    expect(root.children).toHaveLength(1);
    const child = root.children[0];
    expect(child.iri).toBe('urn:html:tag:child1');
    expect(child.source).toBe('<input name="q">');
    expect(child.fields).toHaveLength(2);

    const fieldIris = child.fields.map((f) => f.iri).sort();
    expect(fieldIris).toEqual([
      'urn:html:field:child1-name',
      'urn:html:field:child1-type',
    ]);
  });

  test('returns null when bindings array is empty', () => {
    const detail = bindingsToAnalyzerFindingDetail([]);
    expect(detail).toBeNull();
  });
});
