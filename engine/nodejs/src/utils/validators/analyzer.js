// @ts-check
/**
 * Analyzer validators (Celebrate/Joi)
 * -----------------------------------
 * Schemas used by /routes/analyzer.js.
 * Mirrors the in-route schema, keeping the same relaxed allowances:
 * - nested objects allow unknown keys where explicitly set (.unknown(true))
 * - top-level is required (no .unknown(false) at the root, to match the original)
 */

const { Joi } = require('celebrate');

/**
 * Body schema for POST /analyzer/analyze
 * Keep parity with the original inline schema from routes/analyzer.js.
 * @type {import('joi').ObjectSchema}
 */
const analyzerBodySchema = Joi.object({
  url: Joi.string()
    .pattern(/^https?:\/\/.+/i)
    .required()
    .messages({
      'string.empty': '"url" is required',
      'string.pattern.base': '"url" must start with http:// or https://',
    }),

  html: Joi.string().allow('', null).default(null),

  scripts: Joi.array()
    .items(
      Joi.object({
        src: Joi.string().allow('', null),
        code: Joi.string().allow('', null),
      }).unknown(true) // allow extra fields for real-world script captures
    )
    .default([]),

  forms: Joi.array()
    .items(
      Joi.object({
        action: Joi.string().allow('', null),
        method: Joi.string().allow('', null),
        inputs: Joi.array()
          .items(
            Joi.alternatives().try(
              Joi.string(),
              Joi.object({
                name: Joi.string().allow('', null),
                tag: Joi.string().allow('', null),
                type: Joi.string().allow('', null),
                value: Joi.string().allow('', null),
                placeholder: Joi.string().allow('', null),
              }).unknown(true) // tolerate extra input attributes
            )
          )
          .default([]),
      }).unknown(true) // tolerate extra form attributes
    )
    .default([]),

  iframes: Joi.array()
    .items(
      Joi.object({
        src: Joi.string().allow('', null),
        title: Joi.string().allow('', null),
      }).unknown(true) // tolerate extra iframe attributes
    )
    .default([]),

  includeSnippets: Joi.boolean().default(false),
}).required();

/**
 * Params schema for GET /analyzer/results/:jobId
 * Matches the style used in other validators (techstack/jobId).
 * @type {import('joi').ObjectSchema}
 */
const jobIdParamSchema = Joi.object({
  jobId: Joi.string().required(),
}).unknown(false);

module.exports = {
  analyzerBodySchema,
  jobIdParamSchema,
};
