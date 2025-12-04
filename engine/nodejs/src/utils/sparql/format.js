// @ts-check

/** @typedef {import('../_types/sparql/types').ParamEntry} ParamEntry */
/** @typedef {import('../_types/sparql/types').XmlLiteralString} XmlLiteralString */

const { escapeStringLiteral, escapeXml } = require('../strings/escape');

/**
 * Wrap a string as a typed `rdf:XMLLiteral` suitable for SPARQL.
 *
 * The input string is escaped for **SPARQL string literal** safety (via `escapeStringLiteral`)
 * and then annotated with the `^^rdf:XMLLiteral` datatype. This function **does not validate**
 * whether the string is well-formed XML — it assumes you pass valid XML markup.
 *
 * @param {string} [xmlString=''] - XML markup to embed into the SPARQL literal.
 * @returns {XmlLiteralString} A SPARQL literal with `rdf:XMLLiteral` datatype.
 *
 * @example
 * asXmlLiteral('<query><param name="q">node</param></query>');
 * // => "\"<query>...\"^^<http://www.w3.org/1999/02/22-rdf-syntax-ns#XMLLiteral>"
 *
 * @example
 * // Combine with escape helpers if constructing the XML yourself
 * const xml = `<root>${escapeXml('5 > 3 & 2 < 4')}</root>`;
 * const lit = asXmlLiteral(xml);
 */
function asXmlLiteral(xmlString = '') {
  return `"${escapeStringLiteral(
    xmlString
  )}"^^<http://www.w3.org/1999/02/22-rdf-syntax-ns#XMLLiteral>`;
}

/**
 * Convert a raw querystring into an XML `<query>…</query>` and wrap it as `rdf:XMLLiteral`.
 *
 * The raw string is XML-escaped (via `escapeXml`) and inserted as text content of `<query>`.
 * The resulting XML is then wrapped with {@link asXmlLiteral} so it is safe as a SPARQL typed literal.
 *
 * @param {string} [raw=''] - Raw querystring (e.g., `"q=node&sort=asc"`).
 * @returns {XmlLiteralString} A SPARQL `rdf:XMLLiteral` representing `<query>{escaped(raw)}</query>`.
 *
 * @example
 * xmlLiteralFromQueryRaw('q=node&sort=asc');
 * // => "\"<query>q=node&amp;sort=asc</query>\"^^<...#XMLLiteral>"
 */
function xmlLiteralFromQueryRaw(raw = '') {
  const xml = `<query>${escapeXml(String(raw))}</query>`;
  return asXmlLiteral(xml);
}

/**
 * Serialize an array of `{ name, value }` pairs into:
 *   `<query><param name="...">value</param>...</query>`
 * and wrap it as a typed `rdf:XMLLiteral`.
 *
 * - Both the `name` attribute and element text are XML-escaped.
 * - `value` is stringified with `String(value ?? '')`.
 * - If `params` is not an array, it is treated as empty.
 *
 * @param {ParamEntry[]} [params=[]] - List of parameters to serialize.
 * @returns {XmlLiteralString} A SPARQL `rdf:XMLLiteral` containing a `<query>` element with zero or more `<param>` children.
 *
 * @example
 * const lit = xmlLiteralFromParams([
 *   { name: 'q', value: 'node' },
 *   { name: 'page', value: 2 },
 *   { name: 'safe', value: true }
 * ]);
 * // => "\"<query>\n  <param name=\"q\">node</param>\n  <param name=\"page\">2</param>\n  <param name=\"safe\">true</param>\n</query>\"^^<...#XMLLiteral>"
 *
 * @example
 * // Empty input -> empty <query> element
 * xmlLiteralFromParams(); // or xmlLiteralFromParams([])
 */
function xmlLiteralFromParams(params = []) {
  const items = (Array.isArray(params) ? params : [])
    .map((p) => {
      const n = escapeXml(p?.name ?? '');
      const v = escapeXml(String(p?.value ?? ''));
      return `  <param name="${n}">${v}</param>`;
    })
    .join('\n');

  return asXmlLiteral(`<query>\n${items}\n</query>`);
}

module.exports = {
  asXmlLiteral,
  xmlLiteralFromQueryRaw,
  xmlLiteralFromParams,
  escapeXml,
};
