const {
  sanitizeLimit,
  sanitizeOffset,
} = require('../../../src/utils/sparql/pagination');

describe('sanitizeLimit', () => {
  test('returns numeric value for valid string inputs', () => {
    expect(sanitizeLimit('25')).toBe(25);
    expect(sanitizeLimit('0')).toBe(0);
  });

  test('floors decimal values', () => {
    expect(sanitizeLimit(12.9)).toBe(12);
    expect(sanitizeLimit('7.8')).toBe(7);
  });

  test('uses fallback for negative or NaN values', () => {
    expect(sanitizeLimit(-1, 50)).toBe(50);
    expect(sanitizeLimit('abc', 100)).toBe(100);
  });

  test('default fallback is 50', () => {
    expect(sanitizeLimit(-10)).toBe(50);
    expect(sanitizeLimit(NaN)).toBe(50);
  });
});

describe('sanitizeOffset', () => {
  test('returns numeric value for valid string inputs', () => {
    expect(sanitizeOffset('10')).toBe(10);
    expect(sanitizeOffset('0')).toBe(0);
  });

  test('floors decimal values', () => {
    expect(sanitizeOffset(7.9)).toBe(7);
    expect(sanitizeOffset('3.4')).toBe(3);
  });

  test('uses fallback for negative or NaN values', () => {
    expect(sanitizeOffset(-5, 0)).toBe(0);
    expect(sanitizeOffset('abc', 20)).toBe(20);
  });

  test('default fallback is 0', () => {
    expect(sanitizeOffset(-10)).toBe(0);
    expect(sanitizeOffset(NaN)).toBe(0);
  });
});
