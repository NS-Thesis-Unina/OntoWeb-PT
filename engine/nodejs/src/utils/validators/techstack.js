// @ts-check
/**
 * Techstack validators (Celebrate/Joi)
 * ------------------------------------
 * Schemas used by /routes/techStack.js.
 * Relaxed to accommodate real-world payloads (waf.version, cookies.value, raw, storage, non-standard URLs).
 */

const { Joi } = require('celebrate');

/**
 * Body schema for POST /techstack/analyze
 * @type {import('joi').ObjectSchema}
 */
const techstackBodySchema = Joi.object({
  technologies: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        version: Joi.string().allow('', null),
      }).unknown(false)
    )
    .required(),

  waf: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        // Added: allow optional version field
        version: Joi.string().allow('', null).optional(),
      }).unknown(false)
    )
    .default([]),

  secureHeaders: Joi.array()
    .items(
      Joi.object({
        header: Joi.string().required(),
        description: Joi.string().allow('', null),
        // Relaxed: URLs may contain non-RFC chars (e.g., '|'), so do not force Joi.uri()
        urls: Joi.array().items(Joi.string().trim().max(4000)).default([]),
      }).unknown(false)
    )
    .default([]),

  cookies: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        domain: Joi.string().allow('', null),
        // Added: allow cookie value field
        value: Joi.string().allow('', null).optional(),
        secure: Joi.boolean().default(false),
        httpOnly: Joi.boolean().default(false),
        sameSite: Joi.string().allow('', null),
        expirationDate: Joi.number().allow(null),
      }).unknown(false)
    )
    .default([]),

  mainDomain: Joi.string().allow('', null).default(null),

  // Accept auxiliary blobs as-is (relaxed)
  raw: Joi.object().unknown(true).optional(),
  storage: Joi.object().unknown(true).optional(),
})
  .required()
  .unknown(false); // keep top-level strict, but we whitelisted raw/storage explicitly

/**
 * Params schema for GET /techstack/results/:jobId
 * @type {import('joi').ObjectSchema}
 */
const jobIdParamSchema = Joi.object({
  jobId: Joi.string().required(),
}).unknown(false);

module.exports = {
  techstackBodySchema,
  jobIdParamSchema,
};
