// @ts-check

/**
 * IRI helpers for Finding / Evidence / Resolver instances.
 *
 * All IRIs are URNs so we don't depend on deployment hostname:
 *
 *   - Finding:  urn:finding:{id}
 *   - Evidence: urn:finding:{id}:evidence:{index}
 *   - Resolver: urn:resolver:{key}
 */

const { iriFragmentSafe } = require('./http');

/**
 * Build a URN for a Finding individual.
 *
 * @param {string} id Stable finding identifier (e.g. "tech:react:18:CVE-2024-xxxx").
 * @returns {string} URN (without angle brackets).
 */
function iriFinding(id) {
  return `urn:finding:${iriFragmentSafe(id)}`;
}

/**
 * Build a URN for an Evidence individual associated with a Finding.
 *
 * @param {string} findingId Same id used in iriFinding().
 * @param {number|string} index Index or key for the evidence block.
 * @returns {string} URN (without angle brackets).
 */
function iriEvidence(findingId, index) {
  return `urn:finding:${iriFragmentSafe(findingId)}:evidence:${index}`;
}

/**
 * Build a URN for a Resolver instance (e.g., techstack/http/analyzer).
 *
 * @param {string} key Logical key, e.g., "techstack", "http", "analyzer".
 * @returns {string} URN (without angle brackets).
 */
function iriResolverInstance(key) {
  return `urn:resolver:${iriFragmentSafe(key)}`;
}

module.exports = {
  iriFinding,
  iriEvidence,
  iriResolverInstance,
};
