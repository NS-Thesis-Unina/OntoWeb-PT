/**
 * Formatting Utilities
 *
 * A collection of small helper functions used across the UI and controllers
 * for formatting timestamps, byte sizes, domain names, and HTTP headers.
 *
 * These utilities are intentionally lightweight and do not depend
 * on React or any UI component. They are safe to use in:
 * - background scripts
 * - content scripts
 * - engines
 * - UI components
 */

import { getDomain as tldGetDomain } from 'tldts';

/**
 * Formats a timestamp using Intl.DateTimeFormat with optional overrides.
 *
 * @param {number|string|Date} ts - Timestamp or date value to format.
 * @param {Object} [opts={}] - Additional Intl.DateTimeFormat options.
 * @param {string} [locale] - Optional locale override; defaults to browser locale.
 * @returns {string}
 */
export function formatWhen(ts, opts = {}, locale) {
  const d = new Date(ts);
  return new Intl.DateTimeFormat(locale ?? undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...opts,
  }).format(d);
}

/**
 * Extracts the registered domain (eTLD+1) from a URL.
 *
 * Example:
 *   https://sub.domain.co.uk/path → domain.co.uk
 *
 * Uses tldts for robust cross-TLD parsing.
 *
 * @param {string} url
 * @returns {string} Domain or empty string if invalid/unresolvable.
 */
export function getDomainAccurate(url) {
  const d = tldGetDomain(url);
  return d ?? '';
}

/**
 * Converts a number of bytes into a human-readable size string.
 *
 * @param {number} [n=0] - Byte count.
 * @returns {string} Example: "1.2 MB", "512 KB", "0 B"
 */
export function prettyBytes(n = 0) {
  if (!Number.isFinite(n)) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  let u = 0;

  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u++;
  }

  return `${n.toFixed(u === 0 ? 0 : 1)} ${units[u]}`;
}

/**
 * Retrieves a case-insensitive HTTP header value.
 *
 * @param {Object<string,string>} headers - A map of HTTP headers.
 * @param {string} name - The header name to look for.
 * @returns {string|undefined}
 */
export function getHeader(headers = {}, name = '') {
  if (!headers) return undefined;

  const target = String(name).toLowerCase();

  for (const [k, v] of Object.entries(headers)) {
    if (String(k).toLowerCase() === target) return v;
  }

  return undefined;
}
