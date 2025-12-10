const bindingsToHttpFindingsList = require('../../../src/utils/finding/bindings/http/httpFindingsList');

/**
 * Helper for SPARQL JSON cell.
 * @param {string|number} value
 */
function lit(value) {
  return { type: 'literal', value: String(value) };
}

describe('bindingsToHttpFindingsList', () => {
  test('extracts items and total from bindings', () => {
    const bindings = [
      {
        id: lit('urn:finding:1'),
        total: lit('3'),
      },
      {
        id: lit('urn:finding:2'),
        total: lit('3'),
      },
      {
        id: lit('urn:finding:3'),
        total: lit('3'),
      },
    ];

    const result = bindingsToHttpFindingsList(bindings);

    expect(result.total).toBe(3);
    expect(result.items).toEqual(['urn:finding:1', 'urn:finding:2', 'urn:finding:3']);
  });

  test('uses the last valid numeric total from the bindings', () => {
    const bindings = [
      { id: lit('urn:finding:1'), total: lit('1') },
      { id: lit('urn:finding:2'), total: lit('5') },
    ];

    const result = bindingsToHttpFindingsList(bindings);

    expect(result.total).toBe(5);
    expect(result.items).toEqual(['urn:finding:1', 'urn:finding:2']);
  });

  test('handles empty page with only total row and no ids', () => {
    const bindings = [
      {
        total: lit('10'),
      },
    ];

    const result = bindingsToHttpFindingsList(bindings);

    expect(result.total).toBe(10);
    expect(result.items).toEqual([]);
  });

  test('returns total = 0 and empty items when bindings is empty', () => {
    const result = bindingsToHttpFindingsList([]);

    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });

  test('ignores non-numeric total values gracefully', () => {
    const bindings = [
      { id: lit('urn:finding:1'), total: lit('NaN') },
      { id: lit('urn:finding:2') },
    ];

    const result = bindingsToHttpFindingsList(bindings);

    expect(result.total).toBe(0);
    expect(result.items).toEqual(['urn:finding:1', 'urn:finding:2']);
  });
});
