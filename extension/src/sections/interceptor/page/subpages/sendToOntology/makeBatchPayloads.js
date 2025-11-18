/**
 * HTTP Interceptor → Ontology API Payload Helpers (Hardened)
 * =====================================================================
 * Architectural Role:
 *   Interceptor → Ontology Ingestion Pipeline → Payload Preparation Layer
 *
 * Purpose:
 *   Provides safe and validated transformations from Interceptor “raw”
 *   captured request/response objects into *strict, size-limited, schema-
 *   conforming* payloads suitable for ingestion into the backend tool and
 *   ultimately GraphDB (Ontology).
 *
 * Responsibilities:
 *   - Normalize and sanitize all fields of a captured HTTP request
 *   - Validate and truncate URLs, headers, query parameters, fragments
 *   - Convert request/response bodies into Base64 respecting strict max sizes
 *   - Enforce RFC-valid header names and method names
 *   - Generate stable item IDs when missing or invalid
 *   - Provide batch-packing with precise byte accounting to comply with
 *     backend POST body limits
 *   - Provide a sequential POST helper guarding against empty batches
 *
 * Interactions:
 *   - Used by SendToOntologyInterceptor for preparing ingestion payloads
 *   - Aligns with backend validation logic (GraphDB ingestion microservice)
 *   - No filesystem/network interaction except in `postBatchesSequential`
 *
 * Security / Hardening Notes:
 *   - Rejects malformed URLs and non-http(s) schemes
 *   - Rejects unsafe header names
 *   - Enforces size caps to prevent overloading backend storage
 *   - Always truncates high-risk text fields (headers, URL parts)
 *   - Ensures internal metadata (id, URL parts) always meet expected format
 */

/* ====================================================================== */
/* Lookup tables, constants, validation regex                             */
/* ====================================================================== */

const REASON_BY_STATUS = new Map([
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

/** Header-name safety (matches RFC token) */
const HEADER_TOKEN_RE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

/** Allowed HTTP methods accepted by the ingestion backend */
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

/**
 * Size limits aligned with backend validator (Joi schema + DB limits).
 * These caps must not be violated — exceeding fields get truncated or dropped.
 */
const MAX_ID_LEN = 256;
const MAX_URL_LEN = 4000;
const MAX_PATH_LEN = 2000;
const MAX_QUERYRAW_LEN = 4000;
const MAX_FRAGMENT_LEN = 200;
const MAX_HDR_VALUE_LEN = 8000;
const MAX_PARAM_VALUE_LEN = 2000;
const MAX_PARAMS = 200;
const MAX_REQ_B64 = 10 * 1024 * 1024; // request body max (10MB)
const MAX_RES_B64 = 20 * 1024 * 1024; // response body max (20MB)

/* ====================================================================== */
/* Encoding helpers                                                       */
/* ====================================================================== */

/**
 * UTF-8 → Base64
 * Used for converting textual bodies to backend-safe base64.
 */
function toBase64Utf8(str) {
  if (typeof str !== 'string') return undefined;
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/**
 * Returns decoded binary length of a base64 string.
 * This is required to enforce body-size limits pre-upload.
 */
function base64DecodedBytesLen(b64) {
  if (typeof b64 !== 'string') return 0;
  const len = b64.length;
  if (!len) return 0;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

/* ====================================================================== */
/* Header normalization                                                    */
/* ====================================================================== */

/**
 * Convert input headers (object or array) to:
 *   [{ name, value }]
 *
 * Ensures:
 *   - Lowercase header names
 *   - Only valid token names accepted
 *   - Values truncated to MAX_HDR_VALUE_LEN
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

/* ====================================================================== */
/* URL resolution + absolute parsing                                       */
/* ====================================================================== */

/**
 * Resolve possibly-relative URL using the pageUrl base.
 * Returns absolute string or null if invalid.
 */
function resolveUrl(urlStr, base) {
  try {
    return new URL(urlStr, base || undefined).toString();
  } catch {
    return null;
  }
}

/**
 * Parse and normalize an absolute http/https URL.
 *
 * Returns:
 *   {
 *     full, scheme, authority, path,
 *     fragment?, queryRaw?, params?
 *   }
 *
 * Notes:
 *   - “full” must remain a valid URI; if too long, attempt a fallback
 *   - path/query/fragment truncated to safe limits
 *   - query parameters parsed and individually truncated
 */
function parseUriAbsolute(urlStr) {
  try {
    const u = new URL(urlStr);
    const scheme = u.protocol.replace(':', '');
    if (!/^https?$/i.test(scheme)) return null;

    // Full URL (validated length, fallback allowed)
    let full = u.toString();
    if (full.length > MAX_URL_LEN) {
      const shortFull = `${u.protocol}//${u.host}${u.pathname || '/'}`;
      if (shortFull.length <= MAX_URL_LEN) {
        full = shortFull;
      } else {
        return null;
      }
    }

    // Path normalization + truncation
    let path = u.pathname || '/';
    if (!path.startsWith('/')) path = `/${path}`;
    if (path.length > MAX_PATH_LEN) path = path.slice(0, MAX_PATH_LEN);

    // Raw query (string) truncated
    const raw = u.search.startsWith('?') ? u.search.slice(1) : u.search;
    const queryRaw = raw ? raw.slice(0, MAX_QUERYRAW_LEN) : undefined;

    // Structured params (limited count)
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

    // Fragment truncated
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

/* ====================================================================== */
/* ID normalization                                                        */
/* ====================================================================== */

/**
 * Valid ingestion id = /^[\w.\-:@/]+$/, max 256 chars.
 */
const ID_RE = /^[[\w.\-:@/]+$/;

/** Default auto-id if missing or invalid. */
function defaultId(item, idx) {
  const ts = item?.meta?.ts ?? Date.now();
  return `req-${ts}-${idx}`;
}

/** Enforce ID rules; fallback if invalid. */
function normalizeId(maybeId, fallback) {
  let id = (maybeId == null ? '' : String(maybeId)).trim();
  if (!ID_RE.test(id) || id.length > MAX_ID_LEN || id.length === 0) {
    return fallback;
  }
  return id;
}

/* ====================================================================== */
/* Method normalization                                                    */
/* ====================================================================== */

function normalizeMethod(m) {
  const v = String(m || 'GET').toUpperCase();
  return ALLOWED_METHODS.has(v) ? v : null;
}

/* ====================================================================== */
/* Body extraction (request/response)                                      */
/* ====================================================================== */

/**
 * Request body → base64 (text or already-base64).
 * Enforces MAX_REQ_B64.
 */
function pickRequestBodyBase64(req) {
  if (!req) return undefined;
  if (req.body == null) return undefined;

  // Already base64
  if (req.bodyEncoding === 'base64' && typeof req.body === 'string') {
    if (base64DecodedBytesLen(req.body) > MAX_REQ_B64) return undefined;
    return req.body;
  }

  // Text → base64
  if (req.bodyEncoding === 'text' && typeof req.body === 'string') {
    const b64 = toBase64Utf8(req.body);
    if (base64DecodedBytesLen(b64) > MAX_REQ_B64) return undefined;
    return b64;
  }

  return undefined;
}

/**
 * Response body → base64 (text or already-base64).
 * Enforces MAX_RES_B64.
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

/* ====================================================================== */
/* PUBLIC API – convertItemsToApiPayload                                   */
/* ====================================================================== */

/**
 * Convert raw intercepted items → uniform backend-ready API payload.
 *
 * Applies:
 *   - URL resolution + parse + truncate
 *   - Method filtering
 *   - Header normalization
 *   - Body base64 conversion with size limit
 *   - ID normalization
 *   - Removal of invalid or unsupported items
 *
 * Returns:
 *   { items: Array<NormalizedItem> }
 */
export function convertItemsToApiPayload(items, opts = {}) {
  const { graph = 'http://example.com/graphs/http-requests', idFn, forceHttpVersion } = opts;

  const mapped = [];
  const makeId = typeof idFn === 'function' ? idFn : defaultId;
  const arr = Array.isArray(items) ? items : [];

  for (let idx = 0; idx < arr.length; idx++) {
    const item = arr[idx] || {};
    const req = item.request || {};
    const res = item.response || {};

    /* --- Resolve absolute URL --- */
    const base = item?.meta?.pageUrl || undefined;
    const absoluteUrl = resolveUrl(req.url || '', base);
    if (!absoluteUrl) continue;

    const uri = parseUriAbsolute(absoluteUrl);
    if (!uri) continue;

    /* --- Validate method --- */
    const method = normalizeMethod(req.method);
    if (!method) continue;

    /* --- Normalize ID --- */
    const _id = normalizeId(item?.id, makeId(item, idx));

    /* --- Build response object (optional, only if any field present) --- */
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

    /* --- Build main object --- */
    const obj = {
      id: _id,
      method,
      ...(forceHttpVersion ? { httpVersion: forceHttpVersion } : {}),
      graph,
      uri,
      requestHeaders: toHeaderArray(req.headers),
      ...(uri.authority ? { connection: { authority: uri.authority } } : {}),
    };

    const reqBodyB64 = pickRequestBodyBase64(req);
    if (reqBodyB64) obj.bodyBase64 = reqBodyB64;

    // Attach response only if meaningful
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

/* ====================================================================== */
/* PUBLIC API – makeBatchPayloads                                         */
/* ====================================================================== */

/**
 * Split normalized items into POST-safe batches below a byte limit.
 *
 * - Precise byte accounting using TextEncoder
 * - Never returns empty batches
 * - Rejects single items exceeding limit
 *
 * @returns Array<{items:Array>}
 */
export function makeBatchPayloads(rawItems, convertOpts = {}, packOpts = {}) {
  const { maxBytes = 2 * 1024 * 1024, safetyMargin = 8 * 1024 } = packOpts;
  const limit = Math.max(1024, maxBytes - safetyMargin);

  const apiItems = convertItemsToApiPayload(rawItems, convertOpts).items;
  if (!apiItems.length) return []; // Do not return empty envelope

  const encoder = new TextEncoder();
  const itemJson = apiItems.map((it) => JSON.stringify(it));
  const itemBytes = itemJson.map((s) => encoder.encode(s).length);

  // JSON envelope overhead:
  // '{"items":[' = ~10 bytes
  // ']}'        = ~2 bytes
  const WRAP_PREFIX = 10;
  const WRAP_SUFFIX = 2;

  const batches = [];
  let currentItems = [];
  let currentBytes = WRAP_PREFIX + WRAP_SUFFIX;
  let added = 0;

  for (let i = 0; i < apiItems.length; i++) {
    const nextSize = currentBytes + itemBytes[i] + (added > 0 ? 1 : 0); // account for comma

    if (nextSize <= limit) {
      currentItems.push(apiItems[i]);
      currentBytes = nextSize;
      added++;
      continue;
    }

    // If we can't add the current item even when the batch is empty → reject as too large
    if (added === 0) {
      const singleSize = WRAP_PREFIX + itemBytes[i] + WRAP_SUFFIX;
      const sampleId = apiItems[i]?.id ?? i;
      throw new Error(`Item exceeds size limit (${singleSize}B > ${limit}B). id=${sampleId}`);
    }

    // Close previous batch and start a new one
    batches.push({ items: currentItems });
    currentItems = [apiItems[i]];
    currentBytes = WRAP_PREFIX + WRAP_SUFFIX + itemBytes[i];
    added = 1;
  }

  // Final incomplete batch
  if (currentItems.length) batches.push({ items: currentItems });

  return batches;
}

/* ====================================================================== */
/* PUBLIC API – postBatchesSequential                                    */
/* ====================================================================== */

/**
 * Sequential POST for all batches.
 *
 * Guarantees:
 *   - No empty POSTs
 *   - Proper JSON body
 *   - Detailed error text from backend
 *
 * @returns {Promise<{ batches: number }>}
 */
export async function postBatchesSequential(url, rawItems, convertOpts, packOpts) {
  const payloads = makeBatchPayloads(rawItems, convertOpts, packOpts);

  // Nothing to send
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
