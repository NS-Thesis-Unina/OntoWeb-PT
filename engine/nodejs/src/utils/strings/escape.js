// @ts-check

/**
 * Escape a JavaScript string so it is safe inside a **double-quoted SPARQL literal**.
 *
 * Replaces characters that would break the SPARQL string or span multiple lines:
 * - Backslash `\`  → `\\`
 * - Double quote `"` → `\"`
 * - Carriage return `\r` → `\\r`
 * - Newline `\n` → `\\n`
 * - Tab `\t` → `\\t`
 *
 * This produces a single-line, double-quote-safe SPARQL literal content.
 * It does **not** add language tags or datatypes; it only escapes characters.
 *
 * @param {string} [s=''] Raw string to be embedded in a SPARQL literal.
 * @returns {string} Escaped string, safe for a double-quoted SPARQL literal.
 *
 * @example
 * const raw = 'Line 1\nLine "2"\t\\path';
 * const safe = escapeStringLiteral(raw);
 * // -> 'Line 1\\nLine \\"2\\"\\t\\\\path'
 * const sparql = `BIND("${safe}" AS ?text)`;
 */
function escapeStringLiteral(s = '') {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

/**
 * Minimal XML escaping for use inside **text nodes or attribute values**.
 *
 * Converts the five predefined XML entities:
 * - `&` → `&amp;`
 * - `<` → `&lt;`
 * - `>` → `&gt;`
 * - `"` → `&quot;`
 * - `'` → `&apos;`
 *
 * Intended for building small XML fragments (e.g., `<query>…</query>`) that will
 * later be wrapped as `rdf:XMLLiteral`. This is **not** a full XML serializer and
 * does not validate markup or character ranges.
 *
 * @param {string} [s=''] Raw text to be XML-escaped.
 * @returns {string} XML-escaped string safe for element text or attribute values.
 *
 * @example
 * const text = '5 > 3 & name="A&B"';
 * const xml = `<value>${escapeXml(text)}</value>`;
 * // -> '<value>5 &gt; 3 &amp; name=&quot;A&amp;B&quot;</value>'
 */
function escapeXml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escape a JavaScript string so it is safe inside a double-quoted SPARQL literal.
 *
 * Replaces backslashes and double quotes to avoid breaking the surrounding
 * SPARQL query string (e.g., `"... \"value\" ..."`).
 *
 * Note: This is a minimal escaping for SPARQL string literals embedded in JS.
 * It does not cover every possible RDF literal nuance (language tags, datatypes, etc.).
 *
 * @param {string} [s=''] - Raw string value to be embedded into a SPARQL query.
 * @returns {string} The escaped string, safe to place between double quotes.
 *
 * @example
 * const raw = 'He said: "Hello"';
 * const safe = escapeStr(raw);
 * // -> He said: \\\"Hello\\\"
 * const sparql = `FILTER(str(?x) = "${safe}")`;
 */
function escapeStr(s = '') { 
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); 
}

module.exports = { escapeStringLiteral, escapeXml, escapeStr };