// @ts-check

const { EX, G_FINDINGS } = require('../../constants');
const extractTriplesForSingleFinding = require('./extractTriples');

/**
 * @typedef {import('../../_types/finding/builders/types').AnyFinding} AnyFinding
 */

/**
 * Build a single INSERT DATA SPARQL for multiple findings.
 *
 * @param {AnyFinding[]} [list=[]] Array of finding JSON.
 * @param {string} [defaultGraph=G_FINDINGS] Target named graph.
 * @returns {string} SPARQL UPDATE ready for runUpdate().
 */
function buildInsertFromFindingsArray(list = [], defaultGraph = G_FINDINGS) {
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('Expected a non-empty findings array');
  }

  const graphs = new Map();

  list.forEach((f, idx) => {
    const g = defaultGraph;
    const triples = extractTriplesForSingleFinding(f, idx);
    if (!graphs.has(g)) graphs.set(g, []);
    graphs.get(g).push(...triples);
  });

  const parts = [
    `PREFIX ex: <${EX}>`,
    `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>`,
    `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>`,
    `INSERT DATA {`,
  ];

  for (const [g, triples] of graphs.entries()) {
    parts.push(`  GRAPH <${g}> {`);
    parts.push(`    ${triples.join('\n    ')}`);
    parts.push(`  }`);
  }

  parts.push(`}`);

  return parts.join('\n');
}

module.exports = buildInsertFromFindingsArray;
