/*
 * Utilities: makeBatchPayloads
 *
 * Purpose:
 * - Convert heterogeneous HTTP request/response items (as produced by the PCAP step)
 *   into the API payload shape expected by the backend.
 * - Enforce size limits, normalize/validate fields, and split large submissions into
 *   multiple JSON payloads (batches) that respect a max-bytes threshold.
 * - Provide a simple sequential POST helper for sending batches to an endpoint.
 *
 * Key ideas:
 * - URL parsing is strict (absolute, http/https only) and long fields are trimmed to safe lengths.
 * - Request/response bodies are kept (or converted) in base64 with strict decoded-byte caps.
 * - Headers accept either array-of-objects or object map; names are normalized to lowercase.
 * - Batching estimates JSON byte size using TextEncoder and minimal array wrapper overhead.
 */

const REASON_BY_STATUS = new Map([
  // Minimal HTTP status → reason mapping used when statusText is absent
  [100, 'Continue'],
  [101, 'Switching Protocols'],
  [102, 'Processing'],
  [103, 'Early Hints'],
  [200, 'OK'],
  [201, 'Created'],
  [202, 'Accepted'],
  [203, 'Non-Authoritative Information'],
  [204, 'No Content'],
  [205, 'Reset Content'],
  [206, 'Partial Content'],
  [207, 'Multi-Status'],
  [300, 'Multiple Choices'],
  [301, 'Moved Permanently'],
  [302, 'Found'],
  [303, 'See Other'],
  [304, 'Not Modified'],
  [307, 'Temporary Redirect'],
  [308, 'Permanent Redirect'],
  [400, 'Bad Request'],
  [401, 'Unauthorized'],
  [402, 'Payment Required'],
  [403, 'Forbidden'],
  [404, 'Not Found'],
  [405, 'Method Not Allowed'],
  [406, 'Not Acceptable'],
  [407, 'Proxy Authentication Required'],
  [408, 'Request Timeout'],
  [409, 'Conflict'],
  [410, 'Gone'],
  [411, 'Length Required'],
  [412, 'Precondition Failed'],
  [413, 'Payload Too Large'],
  [414, 'URI Too Long'],
  [415, 'Unsupported Media Type'],
  [416, 'Range Not Satisfiable'],
  [417, 'Expectation Failed'],
  [418, "I'm a teapot"],
  [422, 'Unprocessable Entity'],
  [425, 'Too Early'],
  [426, 'Upgrade Required'],
  [428, 'Precondition Required'],
  [429, 'Too Many Requests'],
  [431, 'Request Header Fields Too Large'],
  [451, 'Unavailable For Legal Reasons'],
  [500, 'Internal Server Error'],
  [501, 'Not Implemented'],
  [502, 'Bad Gateway'],
  [503, 'Service Unavailable'],
  [504, 'Gateway Timeout'],
  [505, 'HTTP Version Not Supported'],
  [507, 'Insufficient Storage'],
  [511, 'Network Authentication Required'],
]);

/** RFC7230 token for header names (lowercased later). */
const HEADER_TOKEN_RE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

/** Whitelisted HTTP methods; others are discarded. */
const ALLOWED_METHODS = new Set([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'DELETE',
  'CONNECT',
  'OPTIONS',
  'TRACE',
  'PATCH',
]);

/** Hard caps for IDs, URLs, paths, query, fragments and content payloads. */
const MAX_ID_LEN = 256;
const MAX_URL_LEN = 4000;
const MAX_PATH_LEN = 2000;
const MAX_QUERYRAW_LEN = 4000;
const MAX_FRAGMENT_LEN = 200;
const MAX_HDR_VALUE_LEN = 8000;
const MAX_PARAM_VALUE_LEN = 2000;
const MAX_PARAMS = 200;
/** Max decoded bytes for request/response base64 bodies. */
const MAX_REQ_B64 = 10 * 1024 * 1024;
const MAX_RES_B64 = 20 * 1024 * 1024;

/**
 * Encode a UTF-8 string to base64 in a browser-safe way (no Buffer dependency).
 * @param {string} str
 * @returns {string|undefined}
 */
function toBase64Utf8(str) {
  if (typeof str !== 'string') return undefined;
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/**
 * Compute the decoded byte length of a base64 string (ignoring invalids).
 * Used to enforce MAX_REQ_B64 / MAX_RES_B64.
 * @param {string} b64
 * @returns {number}
 */
function base64DecodedBytesLen(b64) {
  if (typeof b64 !== 'string') return 0;
  const len = b64.length;
  if (!len) return 0;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

/**
 * Normalize headers into [{ name, value }] with:
 * - lowercased names
 * - RFC token validation for names
 * - value truncation to MAX_HDR_VALUE_LEN
 * Accepts either an array of {name,value} or a name:value object.
 * @param {Array|Object} headers
 * @returns {{name:string,value:string}[]}
 */
function toHeaderArray(headers) {
  const out = [];
  if (!headers) return out;

  const push = (name, value) => {
    const n = String(name ?? '')
      .trim()
      .toLowerCase();
    if (!n || !HEADER_TOKEN_RE.test(n)) return;
    const v = value == null ? '' : String(value);
    out.push({
      name: n,
      value: v.length > MAX_HDR_VALUE_LEN ? v.slice(0, MAX_HDR_VALUE_LEN) : v,
    });
  };

  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (h && typeof h === 'object') push(h.name, h.value);
    }
  } else if (typeof headers === 'object') {
    for (const [k, v] of Object.entries(headers)) push(k, v);
  }

  return out;
}

/**
 * Resolve a possibly-relative URL against an optional base.
 * Returns a fully qualified absolute URL string or null on failure.
 */
function resolveUrl(urlStr, base) {
  try {
    return new URL(urlStr, base || undefined).toString();
  } catch {
    return null;
  }
}

/**
 * Parse and sanitize an absolute http(s) URL into a compact URI object:
 * - scheme (lowercased), authority, normalized path (starts with /)
 * - queryRaw (trimmed), params[] (bounded list), and optional fragment
 * - full: the shortest safe absolute representation (truncated if needed)
 * Returns null if invalid or non-http(s).
 */
function parseUriAbsolute(urlStr) {
  try {
    const u = new URL(urlStr);
    const scheme = u.protocol.replace(':', '');
    if (!/^https?$/i.test(scheme)) return null;

    // Prefer a short “full” if the canonical URL would exceed the global cap.
    let full = u.toString();
    if (full.length > MAX_URL_LEN) {
      const shortFull = `${u.protocol}//${u.host}${u.pathname || '/'}`;
      if (shortFull.length <= MAX_URL_LEN) {
        full = shortFull;
      } else {
        return null;
      }
    }

    let path = u.pathname || '/';
    if (!path.startsWith('/')) path = `/${path}`;
    if (path.length > MAX_PATH_LEN) path = path.slice(0, MAX_PATH_LEN);

    const raw = u.search.startsWith('?') ? u.search.slice(1) : u.search;
    const queryRaw = raw ? raw.slice(0, MAX_QUERYRAW_LEN) : undefined;

    const params = [];
    if (queryRaw) {
      const sp = new URLSearchParams(queryRaw);
      for (const [name, value] of sp) {
        if (params.length >= MAX_PARAMS) break;
        const n = String(name).slice(0, 256);
        const v = String(value).slice(0, MAX_PARAM_VALUE_LEN);
        params.push({ name: n, value: v });
      }
    }

    const fragment = u.hash ? u.hash.replace(/^#/, '').slice(0, MAX_FRAGMENT_LEN) : undefined;

    return {
      full,
      scheme: scheme.toLowerCase(),
      authority: u.host.toLowerCase(),
      path,
      ...(fragment ? { fragment } : {}),
      ...(queryRaw ? { queryRaw } : {}),
      ...(params.length ? { params } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Allowed characters for IDs. Note: the bracket in the beginning is literal
 * based on current implementation; we keep the regex untouched to preserve behavior.
 */
const ID_RE = /^[[\w.\-:@/]+$/;

/** Fallback ID generator using a timestamp and the item index. */
function defaultId(item, idx) {
  const ts = item?.meta?.ts ?? Date.now();
  return `req-${ts}-${idx}`;
}

/**
 * Validate and sanitize an item ID against ID_RE and MAX_ID_LEN.
 * Falls back to a generated ID if invalid/empty.
 */
function normalizeId(maybeId, fallback) {
  let id = (maybeId == null ? '' : String(maybeId)).trim();
  if (!ID_RE.test(id) || id.length > MAX_ID_LEN || id.length === 0) {
    return fallback;
  }
  return id;
}

/**
 * Normalize HTTP method to uppercase and check against the allowlist.
 * @returns {string|null} uppercase method or null if invalid
 */
function normalizeMethod(m) {
  const v = String(m || 'GET').toUpperCase();
  return ALLOWED_METHODS.has(v) ? v : null;
}

/**
 * Choose/convert request body to base64, enforcing decoded-size limit.
 * Supports:
 * - { bodyEncoding: 'base64', body: string }
 * - { bodyEncoding: 'text',   body: string } (auto-encoded)
 * Otherwise returns undefined (no body or unsupported type).
 */
function pickRequestBodyBase64(req) {
  if (!req) return undefined;
  if (req.body == null) return undefined;

  if (req.bodyEncoding === 'base64' && typeof req.body === 'string') {
    if (base64DecodedBytesLen(req.body) > MAX_REQ_B64) return undefined;
    return req.body;
  }

  if (req.bodyEncoding === 'text' && typeof req.body === 'string') {
    const b64 = toBase64Utf8(req.body);
    if (base64DecodedBytesLen(b64) > MAX_REQ_B64) return undefined;
    return b64;
  }

  return undefined;
}

/**
 * Choose/convert response body to base64, enforcing decoded-size limit.
 * Symmetric to pickRequestBodyBase64 but with a larger cap.
 */
function pickResponseBodyBase64(res) {
  if (!res) return undefined;
  if (res.body == null) return undefined;

  if (res.bodyEncoding === 'base64' && typeof res.body === 'string') {
    if (base64DecodedBytesLen(res.body) > MAX_RES_B64) return undefined;
    return res.body;
  }

  if (res.bodyEncoding === 'text' && typeof res.body === 'string') {
    const b64 = toBase64Utf8(res.body);
    if (base64DecodedBytesLen(b64) > MAX_RES_B64) return undefined;
    return b64;
  }

  return undefined;
}

/**
 * Convert an array of arbitrary raw items into the backend API payload shape.
 *
 * Input item shape (expected fields):
 * {
 *   id?: string,
 *   request: { method: string, url: string, headers?: Array|Object, body?: any, bodyEncoding?: 'base64'|'text' },
 *   response?: { status?: number, statusText?: string, headers?: Array|Object, body?: any, bodyEncoding?: 'base64'|'text' },
 *   meta?: { pageUrl?: string, ts?: number }
 * }
 *
 * Options:
 * - graph: target named graph (default from env or localhost).
 * - idFn: custom id generator (fallback if provided id is invalid).
 * - forceHttpVersion: enforce a specific HTTP version in both request and response objects.
 *
 * Returns:
 *   { items: Array<NormalizedItem> }
 */
export function convertItemsToApiPayload(items, opts = {}) {
  const {
    graph = import.meta.env.EXTENSION_PUBLIC_CONNECT_HTTP_REQUESTS_NAME_GRAPH ||
      `http://localhost/graphs/http-requests`,
    idFn,
    forceHttpVersion,
  } = opts;

  const mapped = [];
  const makeId = typeof idFn === 'function' ? idFn : defaultId;
  const arr = Array.isArray(items) ? items : [];

  for (let idx = 0; idx < arr.length; idx++) {
    const item = arr[idx] || {};
    const req = item.request || {};
    const res = item.response || {};

    // Resolve and validate absolute http(s) URL
    const base = item?.meta?.pageUrl || undefined;
    const absoluteUrl = resolveUrl(req.url || '', base);
    if (!absoluteUrl) continue;

    const uri = parseUriAbsolute(absoluteUrl);
    if (!uri) continue;

    const method = normalizeMethod(req.method);
    if (!method) continue;

    const _id = normalizeId(item?.id, makeId(item, idx));

    // Build response block only if any data is present
    const response = {};
    if (forceHttpVersion) response.httpVersion = forceHttpVersion;

    if (typeof res.status === 'number') response.status = res.status;

    if (res.statusText) {
      response.reason = String(res.statusText).slice(0, 256);
    } else if (typeof res.status === 'number' && REASON_BY_STATUS.get(res.status)) {
      response.reason = REASON_BY_STATUS.get(res.status);
    }

    const respBodyB64 = pickResponseBodyBase64(res);
    if (respBodyB64) response.bodyBase64 = respBodyB64;

    const respHeaders = toHeaderArray(res.headers);
    if (respHeaders.length) response.headers = respHeaders;

    // Root object
    const obj = {
      id: _id,
      method,
      ...(forceHttpVersion ? { httpVersion: forceHttpVersion } : {}),
      graph,
      uri,
      requestHeaders: toHeaderArray(req.headers),
      ...(uri.authority ? { connection: { authority: uri.authority } } : {}),
    };

    // Optional request body
    const reqBodyB64 = pickRequestBodyBase64(req);
    if (reqBodyB64) obj.bodyBase64 = reqBodyB64;

    // Attach response only if at least one meaningful field is present
    if (
      response.httpVersion != null ||
      typeof response.status === 'number' ||
      response.reason ||
      response.bodyBase64 ||
      response.headers
    ) {
      obj.response = response;
    }

    mapped.push(obj);
  }

  return { items: mapped };
}

/**
 * Build batches from normalized items with a maximum payload byte size.
 *
 * Strategy:
 * - Convert items to API shape, JSON-stringify each, and measure bytes via TextEncoder.
 * - Accumulate items into an array envelope `{ "items": [ ... ] }`.
 * - Limit accounts for a small constant wrapper overhead (WRAP_PREFIX/SUFFIX) plus commas.
 * - If a single item exceeds the limit on its own, throw with the offending id.
 *
 * @param {Array} rawItems
 * @param {Object} convertOpts - forwarded to convertItemsToApiPayload
 * @param {Object} packOpts - { maxBytes:number, safetyMargin:number }
 * @returns {Array<{items:Array}>}
 */
export function makeBatchPayloads(rawItems, convertOpts = {}, packOpts = {}) {
  const { maxBytes = 2 * 1024 * 1024, safetyMargin = 8 * 1024 } = packOpts;
  const limit = Math.max(1024, maxBytes - safetyMargin);

  const apiItems = convertItemsToApiPayload(rawItems, convertOpts).items;
  if (!apiItems.length) return []; // Do not return empty envelope

  // Precompute JSON and byte length for accurate packing
  const encoder = new TextEncoder();
  const itemJson = apiItems.map((it) => JSON.stringify(it));
  const itemBytes = itemJson.map((s) => encoder.encode(s).length);

  // Approximate wrapper overhead for {"items":[ ... ]}:
  // - '{ "items": [' → 10 bytes (rough constant)
  // - ']}'           → 2 bytes
  const WRAP_PREFIX = 10;
  const WRAP_SUFFIX = 2;

  const batches = [];
  let currentItems = [];
  let currentBytes = WRAP_PREFIX + WRAP_SUFFIX;
  let added = 0;

  for (let i = 0; i < apiItems.length; i++) {
    // +1 byte for the comma when appending after the first
    const nextSize = currentBytes + itemBytes[i] + (added > 0 ? 1 : 0);

    if (nextSize <= limit) {
      currentItems.push(apiItems[i]);
      currentBytes = nextSize;
      added++;
      continue;
    }

    // If the very first item doesn't fit, fail fast with a clear error.
    if (added === 0) {
      const singleSize = WRAP_PREFIX + itemBytes[i] + WRAP_SUFFIX;
      const sampleId = apiItems[i]?.id ?? i;
      throw new Error(`Item exceeds size limit (${singleSize}B > ${limit}B). id=${sampleId}`);
    }

    // Flush current batch and start a new one with the current item.
    batches.push({ items: currentItems });
    currentItems = [apiItems[i]];
    currentBytes = WRAP_PREFIX + WRAP_SUFFIX + itemBytes[i];
    added = 1;
  }

  if (currentItems.length) batches.push({ items: currentItems });

  return batches;
}

/**
 * Convenience helper to POST batches sequentially to a target endpoint.
 * Ensures ordering and provides a minimal success summary.
 *
 * @param {string} url - POST endpoint
 * @param {Array} rawItems - original items to convert/pack
 * @param {Object} convertOpts - forwarded to convertItemsToApiPayload
 * @param {Object} packOpts - forwarded to makeBatchPayloads
 * @returns {Promise<{batches:number}>}
 * @throws Error if any POST returns a non-2xx response
 */
export async function postBatchesSequential(url, rawItems, convertOpts, packOpts) {
  const payloads = makeBatchPayloads(rawItems, convertOpts, packOpts);

  if (!payloads.length) return { batches: 0 };

  for (const payload of payloads) {
    if (!payload.items || payload.items.length === 0) continue;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`POST failed (${res.status}): ${text || res.statusText}`);
    }
  }

  return { batches: payloads.length };
}
