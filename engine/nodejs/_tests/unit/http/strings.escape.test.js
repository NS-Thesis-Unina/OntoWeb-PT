const {
  escapeStringLiteral,
  escapeXml,
  escapeStr,
} = require('../../../src/utils/strings/escape');

describe('escapeStringLiteral', () => {
  test('escapes backslashes and double quotes', () => {
    const raw = 'He said: "hello" \\ test';
    const escaped = escapeStringLiteral(raw);

    expect(escaped).toBe('He said: \\\"hello\\\" \\\\ test');
  });

  test('escapes newlines, carriage returns and tabs', () => {
    const raw = 'a\nb\rc\td';
    const escaped = escapeStringLiteral(raw);

    expect(escaped).toBe('a\\nb\\rc\\td');
  });

  test('coerces non-string input to string, defaulting undefined to empty string', () => {
    expect(escapeStringLiteral(123)).toBe('123');
    expect(escapeStringLiteral(null)).toBe('null');
    expect(escapeStringLiteral(undefined)).toBe('');
  });
});

describe('escapeXml', () => {
  test('escapes XML special chars', () => {
    const raw = `5 > 3 & name="A&B"'`;
    const escaped = escapeXml(raw);

    expect(escaped).toBe(
      '5 &gt; 3 &amp; name=&quot;A&amp;B&quot;&apos;'
    );
  });

  test('coerces non-string input to string', () => {
    expect(escapeXml(42)).toBe('42');
    expect(escapeXml(null)).toBe('null');
  });
});

describe('escapeStr', () => {
  test('escapes backslashes and double quotes (minimal SPARQL escaper)', () => {
    const raw = 'He said: "Hi" \\ o/';
    const escaped = escapeStr(raw);
    
    expect(escaped).toBe('He said: \\\"Hi\\\" \\\\ o/');
  });

  test('coerces non-string input to string, defaulting undefined to empty string', () => {
    expect(escapeStr(undefined)).toBe('');
    expect(escapeStr(0)).toBe('0');
  });
});
