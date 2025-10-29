const { describe, it, expect } = require('@jest/globals');

// Import under test
const iriMod = require('../../src/utils/iri/http');

const {
  iriFragmentSafe,
  iriRequest,
  iriURI,
  iriHeader,
  iriParam,
  iriResponse,
  iriResHeader,
  iriStatus,
  iriConnection,
} = iriMod;

/** Basic invariant checks for a URN string built by this module */
function assertUrnShape(urn, { prefix = 'urn:req:' } = {}) {
  expect(typeof urn).toBe('string');
  expect(urn.length).toBeGreaterThan(0);
  expect(urn.startsWith(prefix)).toBe(true);

  // No raw whitespace or double quotes inside URN
  expect(/\s/.test(urn)).toBe(false);
  expect(urn.includes('"')).toBe(false);
}

/** Ensure the encoded id appears, or at least the URN does not include the unsafe raw chars */
function assertEncodesId(urn, rawId) {
  const enc = encodeURIComponent(String(rawId));
  expect(urn.includes(enc)).toBe(true);
}

describe('IRI HTTP helpers (unit)', () => {
  describe('iriFragmentSafe', () => {
    it('percent-encodes unsafe characters (space, slash, unicode)', () => {
      const raw = 'req 1/α';
      const safe = iriFragmentSafe(raw);
      expect(safe).toBe('req%201%2F%CE%B1');

      // No raw space or slash remain
      expect(safe.includes(' ')).toBe(false);
      expect(safe.includes('/')).toBe(false);
    });

    it('is deterministic/idempotent for the same input', () => {
      const raw = 'x#y?z';
      const a = iriFragmentSafe(raw);
      const b = iriFragmentSafe(raw);
      expect(a).toBe(b);
    });
  });

  describe('iriRequest', () => {
    it('builds a stable URN for request ids (deterministic & encoded)', () => {
      const id = 'req-α 42?/path#frag';
      const a = iriRequest(id);
      const b = iriRequest(id);
      assertUrnShape(a);
      expect(a).toBe(b); // deterministic
      assertEncodesId(a, id);
    });

    it('produces different URNs for different ids (including encoded-vs-raw cases)', () => {
      const a = iriRequest('abc def');   // encodes to abc%20def
      const b = iriRequest('abc%20def'); // encodes to abc%2520def
      expect(a).not.toBe(b);
    });
  });

  describe('iriURI', () => {
    it('produces an URN distinct from the request URN and with :uri suffix', () => {
      const id = 'req with space';
      const req = iriRequest(id);
      const uri = iriURI(id);
      assertUrnShape(req);
      assertUrnShape(uri);
      expect(uri).not.toBe(req);
      assertEncodesId(uri, id);
      expect(uri.endsWith(':uri')).toBe(true);
    });
  });

  describe('iriHeader', () => {
    it('creates stable request-header URNs keyed by index; different index -> different URN', () => {
      const id = 'req-headers';
      const h0 = iriHeader(id, 0);
      const h0b = iriHeader(id, 0);
      const h1 = iriHeader(id, 1);

      assertUrnShape(h0);
      expect(h0).toBe(h0b);    // same index stable
      expect(h1).not.toBe(h0); // different index

      assertEncodesId(h0, id);
      expect(h0.includes(':hdr:0')).toBe(true);
      expect(h1.includes(':hdr:1')).toBe(true);
    });

    it('supports string indexes as stable keys', () => {
      const id = 'req-headers';
      const hx = iriHeader(id, 'etag');
      assertUrnShape(hx);
      assertEncodesId(hx, id);
      expect(hx.endsWith(':hdr:etag')).toBe(true);
    });
  });

  describe('iriParam', () => {
    it('creates stable param URNs by index and no collisions across indexes', () => {
      const id = 'req-π-params?';
      const p0 = iriParam(id, 0);
      const p1 = iriParam(id, 1);
      const p0b = iriParam(id, 0);

      assertUrnShape(p0);
      assertUrnShape(p1);
      expect(p0).toBe(p0b);
      expect(p0).not.toBe(p1);

      assertEncodesId(p0, id);
      expect(p0.includes(':param:0')).toBe(true);
      expect(p1.includes(':param:1')).toBe(true);
    });
  });

  describe('iriResponse & iriResHeader & iriStatus', () => {
    it('builds distinct URNs for response, response headers and status', () => {
      const id = 'req-003';
      const req = iriRequest(id);
      const res = iriResponse(id);
      const sc  = iriStatus(id);
      const rh0 = iriResHeader(id, 0);
      const rh1 = iriResHeader(id, 1);

      [req, res, sc, rh0, rh1].forEach(urn => {
        assertUrnShape(urn);
        assertEncodesId(urn, id);
      });

      // Distinct kinds
      expect(res).not.toBe(req);
      expect(sc).not.toBe(req);
      expect(rh0).not.toBe(req);

      // Suffix checks
      expect(res.endsWith(':res')).toBe(true);
      expect(sc.endsWith(':sc')).toBe(true);
      expect(rh0.includes(':resh:0')).toBe(true);
      expect(rh1.includes(':resh:1')).toBe(true);

      // Index stability for response headers
      expect(iriResHeader(id, 0)).toBe(rh0);
      expect(iriResHeader(id, 1)).toBe(rh1);
    });
  });

  describe('iriConnection', () => {
    it('creates a connection URN distinct from request and with :conn suffix', () => {
      const id = 'req 777';
      const r = iriRequest(id);
      const c = iriConnection(id);

      assertUrnShape(c);
      assertEncodesId(c, id);
      expect(c).not.toBe(r);
      expect(c.endsWith(':conn')).toBe(true);
    });
  });

  describe('cross-kind collision safety', () => {
    it('does not collide across kinds for the same id', () => {
      const id = 'same-id';
      const set = new Set([
        iriRequest(id),
        iriURI(id),
        iriHeader(id, 0),
        iriParam(id, 0),
        iriResponse(id),
        iriResHeader(id, 0),
        iriStatus(id),
        iriConnection(id),
      ]);
      // All 8 entries must be unique
      expect(set.size).toBe(8);
    });
  });
});
