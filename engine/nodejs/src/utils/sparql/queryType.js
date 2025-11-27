// @ts-check

/** @typedef {import('../_types/sparql/types').SparqlString} SparqlString */

/**
 * Detect whether a SPARQL string starts with a `SELECT` or `ASK` query.
 *
 * Behavior:
 * - Coerces `query` to string, trims leading/trailing whitespace, uppercases it.
 * - Returns `true` if the string starts with `SELECT` or `ASK`, otherwise `false`.
 * - Does **not** skip comments or PREFIX/BASE declarations; it’s a simple prefix check.
 *
 * @param {any} query - Candidate SPARQL text.
 * @returns {boolean} `true` if the trimmed string begins with `SELECT` or `ASK`.
 *
 * @example
 * isSelectOrAsk('  SELECT * WHERE { ?s ?p ?o }'); // true
 * isSelectOrAsk('\n  ask { ?s ?p ?o }');          // true
 * isSelectOrAsk('INSERT DATA { <s> <p> "o" }');   // false
 * isSelectOrAsk('# comment\nSELECT * WHERE {}');  // false (comment blocks the prefix)
 */
function isSelectOrAsk(query) {
  const q = String(query || '').trim().toUpperCase();
  return q.startsWith('SELECT') || q.startsWith('ASK');
}

/**
 * Detect whether a SPARQL string is an **UPDATE** operation.
 *
 * Robustness:
 * - Strips full-line and inline end-of-line comments that start with `#`.
 * - Removes any leading `PREFIX` and `BASE` declarations (case-insensitive, repeated allowed).
 * - Trims and uppercases the remaining string before testing.
 *
 * Matches the following update keywords at the beginning of the remaining string:
 * `INSERT`, `DELETE`, `LOAD`, `CLEAR`, `CREATE`, `DROP`, `MOVE`, `COPY`, `ADD`, `WITH`, `MODIFY`.
 *
 * @param {any} query - Candidate SPARQL text.
 * @returns {boolean} `true` if the query is recognized as an UPDATE, otherwise `false`.
 *
 * @example
 * isUpdate('INSERT DATA { <s> <p> "o" }');        // true
 * isUpdate('  # comment\n PREFIX ex: <x>\n DELETE WHERE { ?s ?p ?o }'); // true
 * isUpdate('SELECT * WHERE { ?s ?p ?o }');        // false
 * isUpdate('BASE <http://x/>\nPREFIX a:<a#>\nMOVE <g1> TO <g2>'); // true
 */
function isUpdate(query) {
  const q = String(query || '');
  const noComments = q.replace(/(^|\n)\s*#.*(?=\n|$)/g, '$1');
  const stripped = noComments
    .replace(/^\s*(?:PREFIX\s+\w+:\s*<[^>]+>\s*|BASE\s*<[^>]+>\s*)+/ig, '')
    .trim()
    .toUpperCase();
  return /^(INSERT|DELETE|LOAD|CLEAR|CREATE|DROP|MOVE|COPY|ADD|WITH|MODIFY)\b/.test(stripped);
}

module.exports = { isSelectOrAsk, isUpdate };
