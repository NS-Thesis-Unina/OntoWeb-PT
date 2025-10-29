const { describe, it, expect } = require('@jest/globals');

const { escapeStr } = require('../../src/utils/strings/escape');

// Helper: checks if any unescaped double quote (") is present.
// An unescaped quote is a `"` at start of string or preceded by a non-backslash.
function hasUnescapedQuotes(s) {
  return /(^|[^\\])"/.test(s);
}

describe('escapeStr (unit)', () => {
  it('escapes double quotes and backslashes correctly', () => {
    const input = 'He said: "hello" \\ world';
    const out = escapeStr(input);

    // Quotes are escaped as \"
    const quoteCountIn = (input.match(/"/g) || []).length;
    const escapedQuotes = (out.match(/\\"/g) || []).length;
    expect(escapedQuotes).toBe(quoteCountIn);
    expect(hasUnescapedQuotes(out)).toBe(false); // no raw (unescaped) quotes remain

    // Backslashes are doubled
    const slashIn = (input.match(/\\/g) || []).length;
    const slashOut = (out.match(/\\/g) || []).length;
    expect(slashOut).toBeGreaterThanOrEqual(slashIn * 2);
  });

  it('on second pass further escapes backslashes (not idempotent by design)', () => {
    const input = 'a "b" \\ c';
    const once = escapeStr(input);    // => a \"b\" \\ c
    const twice = escapeStr(once);    // => more backslashes than `once`

    // Not idempotent: second pass changes the string (adds more backslashes)
    expect(twice).not.toBe(once);

    // Still, no unescaped quotes must appear
    expect(hasUnescapedQuotes(once)).toBe(false);
    expect(hasUnescapedQuotes(twice)).toBe(false);

    // Sanity: `once` contains \" and \\ ; `twice` contains even more backslashes
    expect(once.includes('\\"')).toBe(true);
    expect(once.includes('\\\\')).toBe(true);
    expect((twice.match(/\\/g) || []).length).toBeGreaterThan((once.match(/\\/g) || []).length);
  });

  it('neutralizes injection-like payloads by escaping all closing quotes', () => {
    const input = '"; DROP ALL; " -- \\ end';
    const out = escapeStr(input);

    // All quotes are escaped
    const inQuotes = (input.match(/"/g) || []).length;
    const outEscQuotes = (out.match(/\\"/g) || []).length;
    expect(outEscQuotes).toBe(inQuotes);

    // No unescaped quotes remain
    expect(hasUnescapedQuotes(out)).toBe(false);

    // All original backslashes are escaped (at least doubled)
    const inSlashes = (input.match(/\\/g) || []).length;
    const outSlashes = (out.match(/\\/g) || []).length;
    expect(outSlashes).toBeGreaterThanOrEqual(inSlashes * 2);
  });

  it('preserves unicode characters (accented letters, emoji) unchanged', () => {
    const input = 'città naïve 👍 "ok"';
    const out = escapeStr(input);

    // Unicode preserved
    expect(out.includes('città')).toBe(true);
    expect(out.includes('naïve')).toBe(true);
    expect(out.includes('👍')).toBe(true);

    // Quotes escaped
    expect(out.includes('\\"ok\\"')).toBe(true);
    expect(hasUnescapedQuotes(out)).toBe(false);
  });

  it('coerces non-string inputs to strings safely', () => {
    expect(escapeStr(12345)).toBe('12345');
    expect(escapeStr(true)).toBe('true');
    expect(escapeStr(false)).toBe('false');

    // null/undefined: should not throw, must return a string
    expect(() => escapeStr(null)).not.toThrow();
    expect(typeof escapeStr(null)).toBe('string');
    expect(() => escapeStr(undefined)).not.toThrow();
    expect(typeof escapeStr(undefined)).toBe('string');
  });

  it('does not change strings without quotes/backslashes', () => {
    const input = 'https://api.example.com/v1/items?q=a+b&x=1%202,@-_~';
    const out = escapeStr(input);
    expect(out).toBe(input);
  });
});
