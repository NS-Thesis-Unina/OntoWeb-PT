const bindingsToAnalyzerFindingsList = require('../../../src/utils/finding/bindings/analyzer/analyzerFindingsList');

describe('bindingsToAnalyzerFindingsList', () => {
  test('extracts items and total from bindings', () => {
    const bindings = [
      {
        id: { type: 'uri', value: 'urn:finding:1' },
        total: { type: 'literal', value: '3' },
      },
      {
        id: { type: 'uri', value: 'urn:finding:2' },
        total: { type: 'literal', value: '3' },
      },
    ];

    const { items, total } = bindingsToAnalyzerFindingsList(bindings);

    expect(total).toBe(3);
    expect(items).toEqual(['urn:finding:1', 'urn:finding:2']);
  });

  test('handles “total only” row when page is empty', () => {
    const bindings = [
      {
        total: { type: 'literal', value: '5' },
      },
    ];

    const { items, total } = bindingsToAnalyzerFindingsList(bindings);

    expect(total).toBe(5);
    expect(items).toEqual([]);
  });
});
