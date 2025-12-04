// @ts-check

/** @typedef {import('../../_types/http/builders/types').BuilderRequestInput} BuilderRequestInput */
/** @typedef {import('../../_types/http/builders/types').InsertItem} InsertItem */
/** @typedef {import('../../_types/http/bindings/types').HttpRequestList} HttpRequestList */

/**
 * Normalize an HTTP-requests payload into a **flat array** of items consumable by builders.
 *
 * Accepted shapes:
 * - Single object → `[object]`
 * - Array of objects → returned as-is
 * - `{ items: [...] }` → returns the inner array
 *
 * Validation:
 * - Throws if the payload is none of the above.
 *
 * Notes:
 * - This function is intentionally minimal; it does **not** mutate items.
 * - Items are treated as `Partial<InsertItem>` to accommodate progressive enrichment
 *   (e.g., missing optional fields like `graph`, `headers`, `response`, etc.).
 *
 * @param {unknown} payload - Object, array, or `{ items: [...] }`.
 * @returns {Array<Partial<InsertItem>>} Flat array of items.
 *
 * @example
 * normalizeHttpRequestsPayload({ id:'req-1', method:'GET', uri:{ full:'https://x' } });
 * // → [{ id:'req-1', method:'GET', uri:{ full:'https://x' } }]
 *
 * @example
 * normalizeHttpRequestsPayload([{ id:'a', method:'GET', uri:{ full:'https://a' } }]);
 * // → same array
 *
 * @example
 * normalizeHttpRequestsPayload({ items:[{ id:'b', method:'POST', uri:{ full:'https://b' } }] });
 * // → inner array
 */
function normalizeHttpRequestsPayload(payload) {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === 'object') {
    // @ts-ignore - narrow structural check at runtime
    if (Array.isArray(payload.items)) {
      // @ts-ignore
      return payload.items;
    }
    return [payload];
  }

  throw new Error('Invalid payload: expected object, array, or { items: [...] }');
}

module.exports = normalizeHttpRequestsPayload;
