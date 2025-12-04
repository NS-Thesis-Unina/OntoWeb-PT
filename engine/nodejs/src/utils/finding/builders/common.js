// @ts-check

const { EX } = require('../../constants');
const { escapeStringLiteral } = require('../../strings/escape');

/**
 * @typedef {import('../../_types/finding/builders/types').AnyFinding} AnyFinding
 * @typedef {import('../../_types/finding/builders/types').FindingSeverity} FindingSeverity
 */

/**
 * Build a safe local name from an arbitrary string (lowercased, non-word → `_`).
 * @param {string} [raw]
 * @returns {string}
 */
function makeLocalName(raw) {
  return (
    String(raw || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'unknown'
  );
}

function iriCve(id) {
  return `${EX}CVE_${makeLocalName(id)}`;
}

function iriCpe(cpe) {
  return `${EX}CPE_${makeLocalName(cpe)}`;
}

function iriHeader(name) {
  return `${EX}Header_${makeLocalName(name)}`;
}

function iriCookie(domain, path, name) {
  const raw = [domain || '', path || '', name || ''].join('|');
  return `${EX}Cookie_${makeLocalName(raw)}`;
}

/**
 * Try to extract a CVE id from a finding, from f.cveId or via regex on id/message.
 * @param {AnyFinding} f
 * @returns {string|null}
 */
function extractCveIdFromFinding(f) {
  if (!f) return null;
  if (typeof f.cveId === 'string') return f.cveId;

  const candidates = [];
  if (typeof f.id === 'string') candidates.push(f.id);
  if (typeof f.message === 'string') candidates.push(f.message);

  for (const s of candidates) {
    const m = s.match(/CVE-\d{4}-\d+/i);
    if (m) return m[0].toUpperCase();
  }
  return null;
}

/**
 * Normalize severity into one of CRITICAL/HIGH/MEDIUM/LOW/INFO/UNKNOWN.
 *
 * @param {string | FindingSeverity} [severity]
 * @returns {FindingSeverity | null}
 */
function normalizeSeverity(severity) {
  if (!severity) return null;
  const up = String(severity).toUpperCase();
  const known = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', 'UNKNOWN'];
  return /** @type {FindingSeverity} */ (known.includes(up) ? up : 'UNKNOWN');
}

/**
 * Map a finding source to a ResolverInstance individual IRI.
 * @param {string} [source]
 * @returns {string|null} IRI between `< >`
 */
function mapResolverInstanceIri(source) {
  if (!source) return null;
  const s = String(source).toLowerCase();
  if (s === 'techstack') return `<${EX}TechstackResolverInstance>`;
  if (s === 'http' || s === 'http-resolver') return `<${EX}HttpResolverInstance>`;
  if (s === 'analyzer' || s === 'sast') return `<${EX}AnalyzerResolverInstance>`;
  return null;
}

/**
 * Compute a stable key for a finding when missing `findingId` / `id`.
 * @param {AnyFinding} f
 * @param {number} idx
 * @returns {string}
 */
function computeFindingKey(f, idx) {
  if (f && typeof f.findingId === 'string') return f.findingId;
  if (f && typeof f.id === 'string') return f.id;

  const source = f?.source || 'unknown';
  const rule = f?.ruleId || f?.rule || 'rule';
  const anchor = f?.requestId || f?.pageUrl || f?.url || `idx-${idx}`;

  return `${source}:${rule}:${anchor}`;
}

/**
 * Heuristic mapping of a finding to a Vulnerabilities subclass.
 * @param {AnyFinding} f
 * @returns {string|null} IRI between `< >`
 */
function mapVulnerabilityTypeIri(f) {
  const parts = [];

  if (f?.vulnType) parts.push(String(f.vulnType));
  if (f?.vulnerability) parts.push(String(f.vulnerability));
  if (f?.category) parts.push(String(f.category));
  if (f?.ruleId) parts.push(String(f.ruleId));
  if (f?.rule) parts.push(String(f.rule));
  if (f?.kind) parts.push(String(f.kind));
  if (f?.message) parts.push(String(f.message));
  if (f?.description) parts.push(String(f.description));

  const haystack = parts.join(' ').toLowerCase();
  if (!haystack) return null;

  // XSS variants
  if (haystack.includes('dom') && haystack.includes('xss')) {
    return `<${EX}DOM-based_XSS>`;
  }
  if (haystack.includes('stored') && haystack.includes('xss')) {
    return `<${EX}Stored_XSS>`;
  }
  if (haystack.includes('reflected') && haystack.includes('xss')) {
    return `<${EX}Reflected_XSS>`;
  }
  if (haystack.includes('xss')) {
    return `<${EX}XSS>`;
  }

  // SQL Injection
  if (
    haystack.includes('sqli') ||
    haystack.includes('sql injection') ||
    haystack.includes('sql-injection')
  ) {
    return `<${EX}SQLi>`;
  }

  // Open Redirect
  if (haystack.includes('open redirect')) {
    return `<${EX}OpenRedirect>`;
  }

  // Path Traversal
  if (haystack.includes('path traversal') || haystack.includes('../')) {
    return `<${EX}PathTraversal>`;
  }

  return null;
}

/**
 * Append generic (source-agnostic) triples for a finding (Scan metadata).
 * @param {string[]} triples
 * @param {string} findingIri
 * @param {AnyFinding} f
 */
function addGenericFindingTriples(triples, findingIri, f) {
  // Generic type: every finding is at least a Scan.
  triples.push(`${findingIri} a <${EX}Scan> .`);

  const message = f?.message || f?.description;
  if (message) {
    const msg = escapeStringLiteral(String(message));
    triples.push(
      `${findingIri} <http://www.w3.org/2000/01/rdf-schema#label> "${msg}" .`,
      `${findingIri} <${EX}findingDescription> "${msg}" .`
    );
  }

  if (f?.category) {
    triples.push(
      `${findingIri} <${EX}findingCategory> "${escapeStringLiteral(String(f.category))}" .`
    );
  }

  if (f?.owasp) {
    triples.push(`${findingIri} <${EX}owaspCategory> "${escapeStringLiteral(String(f.owasp))}" .`);
  }

  if (f?.ruleId || f?.rule) {
    triples.push(
      `${findingIri} <${EX}findingRuleId> "${escapeStringLiteral(String(f.ruleId || f.rule))}" .`
    );
  }

  const sevNorm = normalizeSeverity(f?.severity);
  if (sevNorm) {
    triples.push(`${findingIri} <${EX}severity> "${escapeStringLiteral(sevNorm)}" .`);
  }

  if (f?.remediation) {
    triples.push(
      `${findingIri} <${EX}remediation> "${escapeStringLiteral(String(f.remediation))}" .`
    );
  }

  const resolverIri = mapResolverInstanceIri(f?.source || f?.resolver);
  if (resolverIri) {
    triples.push(`${findingIri} <${EX}detectedByResolver> ${resolverIri} .`);
  }

  const vulnTypeIri = mapVulnerabilityTypeIri(f);
  if (vulnTypeIri) {
    triples.push(`${findingIri} <${EX}aboutVulnerabilityType> ${vulnTypeIri} .`);
  }
}

module.exports = {
  makeLocalName,
  iriCve,
  iriCpe,
  iriHeader,
  iriCookie,
  extractCveIdFromFinding,
  normalizeSeverity,
  mapResolverInstanceIri,
  computeFindingKey,
  mapVulnerabilityTypeIri,
  addGenericFindingTriples,
};
