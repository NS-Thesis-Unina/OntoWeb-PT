// @ts-check

const { EX, G_FINDINGS } = require('../../constants');
const extractTriplesForSingleFinding = require('./extractTriples');

/**
 * Build a single INSERT DATA SPARQL for **multiple findings**.
 *
 * Tutti i finding vanno nel grafo `defaultGraph` (di default G_FINDINGS).
 * Ignoriamo volutamente `f.graph` per non mischiare con i grafi sorgente
 * (es. http-requests).
 *
 * @param {Array<any>} [list=[]] Array di finding JSON.
 * @param {string} [defaultGraph=G_FINDINGS] Named graph di destinazione.
 * @returns {string} SPARQL UPDATE pronto per runUpdate().
 */
function buildInsertFromFindingsArray(list = [], defaultGraph = G_FINDINGS) {
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('Expected a non-empty findings array');
  }

  const graphs = new Map();

  list.forEach((f, idx) => {
    // 👇 PRIMA prendevi f.graph se presente: ora forziamo SEMPRE il grafo dei findings
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
