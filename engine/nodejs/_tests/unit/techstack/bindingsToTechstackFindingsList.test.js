const bindingsToTechstackFindingsList = require('../../../src/utils/finding/bindings/techstack/techstackFindingsList');

describe('bindingsToTechstackFindingsList', () => {
  test('extracts items and total from bindings', () => {
    const bindings = [
      {
        id: { type: 'uri', value: 'urn:finding:techstack:1' },
        total: { type: 'literal', value: '3' },
      },
      {
        id: { type: 'uri', value: 'urn:finding:techstack:2' },
        total: { type: 'literal', value: '3' },
      },
    ];

    const { items, total } = bindingsToTechstackFindingsList(bindings);

    expect(items).toEqual([
      'urn:finding:techstack:1',
      'urn:finding:techstack:2',
    ]);
    expect(total).toBe(3);
  });

  test('handles “total only” row when page is empty', () => {
    const bindings = [
      {
        total: { type: 'literal', value: '0' },
      },
    ];

    const { items, total } = bindingsToTechstackFindingsList(bindings);

    expect(items).toEqual([]);
    expect(total).toBe(0);
  });
});
