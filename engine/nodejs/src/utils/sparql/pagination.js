// @ts-check

/**
 * Validate and coerce a LIMIT value for SPARQL queries (integer, floored).
 *
 * Behavior:
 * - Converts the input with `Number(limit)`.
 * - Applies `Math.floor(...)` to force an integer.
 * - Returns the integer if it is finite and **>= 0**; otherwise returns `fallback` (default **50**, also floored).
 *
 * @param {any} limit User-provided LIMIT (string/number/etc.).
 * @param {number} [fallback=50] Fallback to use when `limit` is invalid.
 * @returns {number} A non-negative integer suitable for LIMIT.
 *
 * @example
 * sanitizeLimit('25');        // 25
 * sanitizeLimit(-1, 50);      // 50 (fallback, negative)
 * sanitizeLimit('abc', 100);  // 100 (fallback, NaN)
 * sanitizeLimit(0);           // 0
 * sanitizeLimit(12.5);        // 12  (floored)
 */
function sanitizeLimit(limit, fallback = 50) {
  const n = Math.floor(Number(limit));
  return Number.isFinite(n) && n >= 0 ? n : Math.floor(fallback);
}

/**
 * Validate and coerce an OFFSET value for SPARQL queries (integer, floored).
 *
 * Behavior:
 * - Converts the input with `Number(offset)`.
 * - Applies `Math.floor(...)` to force an integer.
 * - Returns the integer if it is finite and **>= 0**; otherwise returns `fallback` (default **0**, anche questo floored).
 *
 * @param {any} offset User-provided OFFSET (string/number/etc.).
 * @param {number} [fallback=0] Fallback to use when `offset` is invalid.
 * @returns {number} A non-negative integer suitable for OFFSET.
 *
 * @example
 * sanitizeOffset('10');       // 10
 * sanitizeOffset(-5, 0);      // 0 (fallback, negative)
 * sanitizeOffset('abc', 20);  // 20 (fallback, NaN)
 * sanitizeOffset(0);          // 0
 * sanitizeOffset(7.9);        // 7   (floored)
 */
function sanitizeOffset(offset, fallback = 0) {
  const n = Math.floor(Number(offset));
  return Number.isFinite(n) && n >= 0 ? n : Math.floor(fallback);
}

module.exports = { sanitizeLimit, sanitizeOffset };
