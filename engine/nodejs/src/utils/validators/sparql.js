// @ts-check
/**
 * SPARQL validators (Celebrate/Joi)
 * ---------------------------------
 * Schemas used by /routes/sparql.js for SELECT/ASK and UPDATE endpoints.
 * Logic is preserved from the previous common validators file.
 */

const { Joi } = require('celebrate');

const sparqlMax = 100_000;         // 100 KB for SELECT/ASK
const sparqlUpdateMax = 2_000_000; // 2 MB for UPDATE

/**
 * Factory: Joi schema for POST /sparql/query (SELECT/ASK only).
 * @param {Function} isSelectOrAsk
 * @returns {import('joi').Schema}
 */
const sparqlQuerySchema = (isSelectOrAsk) =>
  Joi.object({
    sparql: Joi.string().trim().max(sparqlMax).required()
  }).unknown(false);

/**
 * Factory: Joi schema for POST /sparql/update (UPDATE only).
 * @param {Function} isUpdate
 * @returns {import('joi').Schema}
 */
const sparqlUpdateSchema = (isUpdate) =>
  Joi.object({
    sparqlUpdate: Joi.string().trim().max(sparqlUpdateMax).required()
  }).unknown(false);

module.exports = {
  sparqlQuerySchema,
  sparqlUpdateSchema
};
