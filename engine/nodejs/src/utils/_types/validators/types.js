// @ts-check

/**
 * Common typedefs for Joi / Celebrate validators.
 */

/**
 * Generic Joi schema.
 * Mirrors `import('joi').Schema`.
 * @typedef {import('joi').Schema} JoiSchema
 */

/**
 * Joi object schema.
 * Mirrors `import('joi').ObjectSchema`.
 * @typedef {import('joi').ObjectSchema} JoiObjectSchema
 */

/**
 * Celebrate options shape used in Express middleware.
 * This is a minimal structural type matching what we actually pass.
 * It does not depend on the `celebrate` package types at runtime.
 *
 * @typedef {object} CelebrateOptions
 * @property {boolean} convert       - Coerce types and apply defaults.
 * @property {boolean} stripUnknown  - Remove unknown keys from validated segments.
 * @property {boolean} abortEarly    - If false, report all issues together.
 */

module.exports = {};
