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

/** @typedef {import('../_types/iri/types').IriString} IriString */
/** @typedef {import('../_types/iri/types').FindingId} FindingId */
/** @typedef {import('../_types/iri/types').EvidenceIndex} EvidenceIndex */
/** @typedef {import('../_types/iri/types').ResolverKey} ResolverKey */

const { iriFragmentSafe } = require('./http');

/**
 * Build a URN for a Finding individual.
 *
 * Shape:
 *   `urn:finding:{id}`
 *
 * @param {FindingId} id - Stable finding identifier (e.g. "tech:react:18:CVE-2024-xxxx").
 * @returns {IriString} URN (without angle brackets).
 */
function iriFinding(id) {
  return `urn:finding:${iriFragmentSafe(id)}`;
}

/**
 * Build a URN for an Evidence individual associated with a Finding.
 *
 * Shape:
 *   `urn:finding:{id}:evidence:{index}`
 *
 * @param {FindingId} findingId - Same id used in {@link iriFinding}.
 * @param {EvidenceIndex} index - Index or key for the evidence block.
 * @returns {IriString} URN (without angle brackets).
 */
function iriEvidence(findingId, index) {
  return `urn:finding:${iriFragmentSafe(findingId)}:evidence:${index}`;
}

/**
 * Build a URN for a Resolver instance (e.g., techstack/http/analyzer).
 *
 * Shape:
 *   `urn:resolver:{key}`
 *
 * @param {ResolverKey} key - Logical key, e.g., "techstack", "http", "analyzer".
 * @returns {IriString} URN (without angle brackets).
 */
function iriResolverInstance(key) {
  return `urn:resolver:${iriFragmentSafe(key)}`;
}

module.exports = {
  iriFinding,
  iriEvidence,
  iriResolverInstance,
};
