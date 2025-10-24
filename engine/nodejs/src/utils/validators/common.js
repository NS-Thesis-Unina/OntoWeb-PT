// @ts-check
const { Joi } = require('celebrate');

/** RFC 7230 "token" for HTTP header names */
const HEADER_TOKEN_RE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

/** Human/IRI-derived id: constrained charset + length with friendly error */
const idSchema = Joi.string()
  .trim()
  .max(256)
  .pattern(/^[\w.\-:@/]+$/)
  .messages({ 'string.pattern.base': 'Invalid id format' });

/** HTTP method normalized to UPPERCASE and whitelisted */
const methodSchema = Joi.string()
  .trim()
  .uppercase()
  .valid('GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH');

/** Full URL (http/https), trimmed + bounded length */
const urlSchema = Joi.string()
  .trim()
  .max(4000)
  .uri({ scheme: [/https?/] });

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

/** Header object: lowercase name, trimmed value */
const headerSchema = Joi.object({
  name: Joi.string().trim().lowercase().max(256).pattern(HEADER_TOKEN_RE).required(),
  value: Joi.string().trim().allow('').max(8000).default('')
}).unknown(false);

/** Query params array: trim both name and value */
const paramsSchema = Joi.array().items(
  Joi.object({
    name: Joi.string().trim().max(256).required(),
    value: Joi.string().trim().allow('').max(2000).default('')
  }).unknown(false)
).max(200);

/** queryRaw: strip a leading '?' if present */
const queryRawSchema = Joi.string()
  .trim()
  .max(4000)
  .custom((v) => (v && v.startsWith('?') ? v.slice(1) : v), 'strip leading ?');

/** URI shape: strict keys, accepts both params and/or queryRaw */
const uriSchema = Joi.object({
  full: urlSchema.required(),
  scheme: schemeSchema.optional(),
  authority: authoritySchema.optional(),
  path: pathSchema.optional(),
  fragment: fragmentSchema.optional(),
  queryXml: xmlSchema.optional(),
  params: paramsSchema.optional(),
  queryRaw: queryRawSchema.optional()
}).unknown(false);

/** Base64 scrubber: remove any whitespace/linebreaks before validation */
const base64Sanitizer = (v) => (typeof v === 'string' ? v.replace(/\s+/g, '') : v);

/** Request object: strict and normalized */
const requestSchema = Joi.object({
  graph: Joi.string().trim().max(2048).optional(),

  id: idSchema.required(),
  method: methodSchema.required(),
  httpVersion: Joi.string().trim().max(16).optional(),

  bodyBase64: Joi.string()
    .custom((v) => base64Sanitizer(v), 'strip whitespace')
    .base64({ paddingRequired: false })
    .max(10 * 1024 * 1024)
    .optional(),

  uri: uriSchema.required(),

  requestHeaders: Joi.array().items(headerSchema).max(200).optional(),

  response: Joi.object({
    httpVersion: Joi.string().trim().max(16).optional(),
    status: Joi.number().integer().min(100).max(599).optional(),
    reason: Joi.string().trim().max(256).optional(),
    bodyBase64: Joi.string()
      .custom((v) => base64Sanitizer(v), 'strip whitespace')
      .base64({ paddingRequired: false })
      .max(20 * 1024 * 1024)
      .optional(),
    headers: Joi.array().items(headerSchema).max(200).optional()
  }).unknown(false).optional(),

  connection: Joi.object({
    authority: authoritySchema.required()
  }).unknown(false).optional()
}).unknown(false);

/**
 * Validate & sanitize payloads for POST /ingest-http.
 *
 * Accepts:
 * - a single request object,
 * - an array of request objects (min 1),
 * - or an envelope `{ items: [...] }` (min 1).
 *
 * Sanitization highlights:
 * - `method` uppercased; `scheme`, `authority`, `header.name` lowercased.
 * - `path` ensured to start with `/`.
 * - `queryRaw` stripped of a leading `?`.
 * - Base64 bodies cleaned from whitespace.
 *
 * @type {import('joi').Schema}
 */
const ingestPayloadSchema = Joi.alternatives().try(
  requestSchema,
  Joi.array().items(requestSchema).min(1),
  Joi.object({ items: Joi.array().items(requestSchema).min(1).required() }).unknown(false)
);

/**
 * Validate & sanitize query string for GET /http-requests/list.
 *
 * Filters:
 * - `method`, `scheme` (lowercased), `authority` (lowercased), `path` (leading `/`),
 * - `headerName` (RFC 7230 token, lowercased), `headerValue`, `text`.
 *
 * Pagination:
 * - `limit` 0..1000 (default 10),
 * - `offset` 0..1,000,000 (default 0).
 *
 * NOTE: For numeric coercion and stripping of unknown top-level keys,
 * pass Celebrate options `{ convert: true, stripUnknown: true }` in the route.
 *
 * @type {import('joi').ObjectSchema}
 */
const listQuerySchema = Joi.object({
  limit: Joi.number().integer().min(0).max(1000).default(10),
  offset: Joi.number().integer().min(0).max(1_000_000).default(0),
  method: methodSchema.optional(),
  scheme: schemeSchema.optional(),
  authority: authoritySchema.optional(),
  path: pathSchema.optional(),
  headerName: Joi.string().trim().lowercase().max(256).pattern(HEADER_TOKEN_RE).optional(),
  headerValue: Joi.string().trim().max(8000).optional(),
  text: Joi.string().trim().max(4000).optional()
}).unknown(false);

/**
 * Validate `:id` path parameter for GET /http-requests/:id.
 *
 * Constraints:
 * - trimmed string,
 * - max length 256,
 * - allowed chars: alphanumerics plus `_ . - : @ /`.
 *
 * @type {import('joi').ObjectSchema}
 */
const idParamSchema = Joi.object({
  id: idSchema.required()
}).unknown(false);

const sparqlMax = 100_000;         // 100 KB for SELECT/ASK
const sparqlUpdateMax = 2_000_000; // 2 MB for UPDATE

/**
 * Factory: Joi schema for POST /sparql/query.
 *
 * Ensures:
 * - presence of `sparql` string,
 * - trimmed and size-bounded (<= `sparqlMax`),
 * - passes the provided `isSelectOrAsk` predicate (SELECT/ASK).
 *
 * @param {(q: any) => boolean} isSelectOrAsk Predicate that returns true if the text is a SELECT/ASK query.
 * @returns {import('joi').ObjectSchema} Schema for `{ sparql: string }`.
 *
 * @example
 * router.post('/sparql/query',
 *   celebrate({ [Segments.BODY]: sparqlQuerySchema(isSelectOrAsk) }, celebrateOptions),
 *   handler
 * );
 */
const sparqlQuerySchema = (isSelectOrAsk) =>
  Joi.object({
    sparql: Joi.string().trim().max(sparqlMax).required()
      .custom((value, helpers) => (!isSelectOrAsk(value) ? helpers.error('any.invalid') : value), 'isSelectOrAsk validator')
  }).unknown(false);

/**
 * Factory: Joi schema for POST /sparql/update.
 *
 * Ensures:
 * - presence of `sparqlUpdate` string,
 * - trimmed and size-bounded (<= `sparqlUpdateMax`),
 * - passes the provided `isUpdate` predicate (SPARQL UPDATE).
 *
 * @param {(q: any) => boolean} isUpdate Predicate that returns true if the text is a SPARQL UPDATE.
 * @returns {import('joi').ObjectSchema} Schema for `{ sparqlUpdate: string }`.
 *
 * @example
 * router.post('/sparql/update',
 *   celebrate({ [Segments.BODY]: sparqlUpdateSchema(isUpdate) }, celebrateOptions),
 *   handler
 * );
 */
const sparqlUpdateSchema = (isUpdate) =>
  Joi.object({
    sparqlUpdate: Joi.string().trim().max(sparqlUpdateMax).required()
      .custom((value, helpers) => (!isUpdate(value) ? helpers.error('any.invalid') : value), 'isUpdate validator')
  }).unknown(false);

module.exports = {
  ingestPayloadSchema,
  listQuerySchema,
  idParamSchema,
  sparqlQuerySchema,
  sparqlUpdateSchema
};
