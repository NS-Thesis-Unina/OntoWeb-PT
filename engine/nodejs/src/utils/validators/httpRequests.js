// @ts-check

/**
 * HTTP Requests validators (Celebrate/Joi)
 * ----------------------------------------
 * Schemas used by /routes/httpRequests.js.
 * Logic is preserved from the previous common validators file.
 */

const { Joi } = require('celebrate');

/** @typedef {import('../_types/validators/types').JoiSchema} JoiSchema */
/** @typedef {import('../_types/validators/types').JoiObjectSchema} JoiObjectSchema */

/** RFC 7230 "token" for HTTP header names — now optional (kept for reference) */
const HEADER_TOKEN_RE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

/** ID schema: relaxed, any printable string up to 256 chars */
const idSchema = Joi.string()
  .trim()
  .max(256)
  .messages({ 'string.max': 'Invalid id: too long (max 256 chars)' });

/** HTTP method: allow any string (uppercased by client) */
const methodSchema = Joi.string().trim().uppercase().max(32);

/** URL: accept anything that looks like a URL, even relative */
const urlSchema = Joi.string().trim().max(4000);

/** Lowercased normalizations for scheme/authority */
const schemeSchema = Joi.string().trim().lowercase().max(20);
const authoritySchema = Joi.string().trim().lowercase().max(255);

/** Ensure path starts with "/" if present */
const pathSchema = Joi.string()
  .trim()
  .max(2000)
  .custom((v) => (v && !v.startsWith('/') ? `/${v}` : v), 'ensure leading slash');

const fragmentSchema = Joi.string().trim().max(200);
const xmlSchema = Joi.string().trim().max(20000); // queryXml

/** Header object: relaxed — no pattern check on name */
const headerSchema = Joi.object({
  name: Joi.string().trim().lowercase().max(256).required(),
  value: Joi.string().trim().allow('').max(8000).default(''),
}).unknown(false);

/** Query params array: unchanged, just relaxed types */
const paramsSchema = Joi.array()
  .items(
    Joi.object({
      name: Joi.string().trim().max(256).required(),
      value: Joi.string().trim().allow('').max(2000).default(''),
    }).unknown(false)
  )
  .max(200);

/** queryRaw: strip a leading '?' if present */
const queryRawSchema = Joi.string()
  .trim()
  .max(4000)
  .custom((v) => (v && v.startsWith('?') ? v.slice(1) : v), 'strip leading ?');

/** URI shape: no strict URL validation */
const uriSchema = Joi.object({
  full: urlSchema.required(),
  scheme: schemeSchema.optional(),
  authority: authoritySchema.optional(),
  path: pathSchema.optional(),
  fragment: fragmentSchema.optional(),
  queryXml: xmlSchema.optional(),
  params: paramsSchema.optional(),
  queryRaw: queryRawSchema.optional(),
}).unknown(false);

/** Base64 scrubber: remove whitespace before validation */
const base64Sanitizer = (v) => (typeof v === 'string' ? v.replace(/\s+/g, '') : v);

/**
 * Request object: relaxed and tolerant.
 * @type {JoiObjectSchema}
 */
const requestSchema = Joi.object({
  graph: Joi.string().trim().max(2048).optional(),

  id: idSchema.required(),
  method: methodSchema.required(),
  httpVersion: Joi.string().trim().max(16).optional(),

  bodyBase64: Joi.string()
    .custom((v) => base64Sanitizer(v), 'strip whitespace')
    .max(10 * 1024 * 1024)
    .optional(),

  uri: uriSchema.required(),

  requestHeaders: Joi.array().items(headerSchema).max(200).optional(),

  response: Joi.object({
    httpVersion: Joi.string().trim().max(16).optional(),
    status: Joi.number().integer().min(0).max(999).optional(),
    reason: Joi.string().trim().max(256).optional(),
    bodyBase64: Joi.string()
      .custom((v) => base64Sanitizer(v), 'strip whitespace')
      .max(20 * 1024 * 1024)
      .optional(),
    headers: Joi.array().items(headerSchema).max(200).optional(),
  })
    .unknown(false)
    .optional(),

  connection: Joi.object({
    authority: authoritySchema.required(),
  })
    .unknown(false)
    .optional(),
}).unknown(false);

/**
 * Validate & sanitize payloads for POST /ingest-http.
 * Functional: allows any of { object | array | { items: [...] } }
 * @type {JoiSchema}
 */
const ingestPayloadSchema = Joi.alternatives().try(
  requestSchema,
  Joi.array().items(requestSchema).min(1),
  Joi.object({
    items: Joi.array().items(requestSchema).min(1).required(),
    activateResolver: Joi.boolean().default(false),
  }).unknown(false)
);

/**
 * Validate & sanitize query string for GET /http-requests/list.
 * Functional: all optional, very permissive.
 * @type {JoiSchema}
 */
const listQuerySchema = Joi.object({
  limit: Joi.number().integer().min(0).max(1000).default(10),
  offset: Joi.number().integer().min(0).max(1_000_000).default(0),
  method: methodSchema.optional(),
  scheme: schemeSchema.optional(),
  authority: authoritySchema.optional(),
  path: pathSchema.optional(),
  headerName: Joi.string().trim().lowercase().max(256).optional(),
  headerValue: Joi.string().trim().max(8000).optional(),
  text: Joi.string().trim().max(4000).optional(),
}).unknown(false);

/**
 * Path parameter :id — keep basic sanity.
 * @type {JoiSchema}
 */
const idParamSchema = Joi.object({
  id: idSchema.required(),
}).unknown(false);

/**
 * Params schema for GET /analyzer/results/:jobId
 * Matches the style used in other validators (techstack/jobId).
 * @type {JoiObjectSchema}
 */
const jobIdParamSchema = Joi.object({
  jobId: Joi.string().required(),
}).unknown(false);

module.exports = {
  ingestPayloadSchema,
  listQuerySchema,
  idParamSchema,
  jobIdParamSchema,
};
