// @ts-check

/** @typedef {import('../_types/validators/types').CelebrateOptions} CelebrateOptions */

/**
 * Celebrate options used by all validators.
 * @type {{ celebrateOptions: CelebrateOptions }}
 */
module.exports = {
  celebrateOptions: {
    // Coerce types and apply defaults
    convert: true,
    // Remove unknown keys in validated segments (top-level)
    stripUnknown: true,
    // Report all issues together
    abortEarly: false,
  },
};
