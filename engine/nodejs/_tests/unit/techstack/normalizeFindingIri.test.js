const { normalizeFindingIri } = require('../../../src/utils/finding/builders/helpers/normalizeFindingIri');

describe('normalizeFindingIri', () => {
  test('encodes plain URN suffix into the expected storage format', () => {
    const raw = 'urn:finding:http:cors-misconfig:req-1';

    const normalized = normalizeFindingIri(raw);
    const expected = 'urn:finding:' + encodeURIComponent('http:cors-misconfig:req-1');

    expect(normalized).toBe(expected);
  });

  test('is idempotent for already-encoded URNs', () => {
    const encodedSuffix = encodeURIComponent('http:cors-misconfig:req-1');
    const raw = 'urn:finding:' + encodedSuffix;

    const normalized = normalizeFindingIri(raw);

    expect(normalized).toBe(raw);
  });

  test('returns raw value when it does not start with urn:finding:', () => {
    const raw = 'http://example.com/finding/123';
    expect(normalizeFindingIri(raw)).toBe(raw);
  });

  test('returns input as-is when not a string', () => {
    /** @type {any} */
    const value = 123;
    expect(normalizeFindingIri(value)).toBe(value);
  });
});
