// @ts-check

/**
 * Normalize a finding IRI so that it matches the stored pattern:
 *   "urn:finding:" + encodeURIComponent(suffix)
 *
 * It accepts both:
 *  - "urn:finding:http%3Acors-misconfig%3Areq-..." (already encoded)
 *  - "urn:finding:http:cors-misconfig:req-..."     (decoded by Express)
 *
 * and always returns the encoded form suitable for GraphDB.
 *
 * @param {string} raw - Raw IRI/URN from the client (path param, etc.).
 * @returns {string} Normalized IRI/URN.
 */
function normalizeFindingIri(raw) {
  const PREFIX = 'urn:finding:';
  if (typeof raw !== 'string') return raw;
  if (!raw.startsWith(PREFIX)) return raw;

  let suffix = raw.slice(PREFIX.length);

  // Try a single decode, then re-encode. This makes the function idempotent:
  // - encoded → decoded → encoded
  // - plain   → (decode fails or is no-op) → encoded
  try {
    suffix = decodeURIComponent(suffix);
  } catch {
    // If decode fails, keep the suffix as-is.
  }

  const encoded = encodeURIComponent(suffix);
  return PREFIX + encoded;
}

module.exports = { normalizeFindingIri };
