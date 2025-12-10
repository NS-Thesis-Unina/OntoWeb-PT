// @ts-check

const { iriFinding } = require('../../iri/finding');
const { computeFindingKey, addGenericFindingTriples } = require('./common');
const { addTechstackTriples } = require('./techstack/extractTriples');
const { addHttpTriples } = require('./http/extractTriples');
const { addAnalyzerTriples } = require('./analyzer/extractTriples');

/**
 * @typedef {import('../../_types/finding/builders/types').AnyFinding} AnyFinding
 */

/**
 * Extract RDF triple fragments for a single Finding.
 *
 * Public API unchanged:
 *   - input: finding JSON + index
 *   - output: list of triples (strings), no GRAPH/INSERT wrapper
 *
 * @param {AnyFinding} [f={}] Finding JSON (techstack / http / analyzer).
 * @param {number} [index=0] index in the batch (fallback for id).
 * @returns {string[]} RDF triples (without GRAPH / INSERT).
 */
function extractTriplesForSingleFinding(f = {}, index = 0) {
  const findingKey = computeFindingKey(f, index);
  const findingIri = `<${iriFinding(findingKey)}>`;
  /** @type {string[]} */
  const triples = [];

  // Generic metadata (Finding + shared properties)
  addGenericFindingTriples(triples, findingIri, f);

  const source = (f?.source || '').toLowerCase();
  if (source === 'techstack') {
    addTechstackTriples(triples, findingIri, f);
  } else if (source === 'http' || source === 'http-resolver') {
    addHttpTriples(triples, findingIri, f);
  } else if (source === 'analyzer' || source === 'sast') {
    addAnalyzerTriples(triples, findingIri, f);
  }

  return triples;
}

module.exports = extractTriplesForSingleFinding;
