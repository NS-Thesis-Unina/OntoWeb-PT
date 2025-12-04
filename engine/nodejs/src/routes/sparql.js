const express = require('express');
const router = express.Router();

const { celebrate, Segments } = require('celebrate');

const { queueSparql } = require('../queue');
const {
  isSelectOrAsk,
  isUpdate,
  graphdb: { runSelect },
  makeLogger,
  validators: {
    sparql: { sparqlQuerySchema, sparqlUpdateSchema },
    celebrateOptions,
  },
} = require('../utils');

const log = makeLogger('api:sparql');

/**
 * POST /sparql/query
 *
 * Execute a SPARQL SELECT/ASK query synchronously against GraphDB.
 *
 * Constraints:
 * - Only SELECT and ASK queries are allowed.
 * - UPDATE statements are explicitly rejected at validation level.
 *
 * Request body:
 * - sparql: SPARQL query string
 *
 * Response:
 * - 200 with the raw GraphDB JSON response ({ head, results })
 * - 400 on validation error (handled by celebrate)
 * - 502 if the underlying GraphDB query fails
 */
router.post(
  '/query',
  celebrate({ [Segments.BODY]: sparqlQuerySchema(isSelectOrAsk) }, celebrateOptions),
  async (req, res) => {
    try {
      const { sparql } = req.body || {};
      const data = await runSelect(sparql);

      log.info('query sparql ok', data.head);

      res.json({ data });
    } catch (err) {
      log.error('query sparql failed', err?.message || err);
      res.status(502).json({
        error: 'GraphDB query failed',
        detail: String(err?.message || err),
      });
    }
  }
);

/**
 * POST /sparql/update
 *
 * Enqueue a SPARQL UPDATE statement for asynchronous execution.
 * The actual execution is performed by the SPARQL worker (see worker.js).
 *
 * Request body:
 * - sparqlUpdate: SPARQL UPDATE string (INSERT/DELETE/etc.)
 *
 * Response:
 * - 202 with { accepted: true, jobId } when the job has been enqueued
 * - 400 on validation error (handled by celebrate)
 * - 500 if the job cannot be enqueued
 */
router.post(
  '/update',
  celebrate({ [Segments.BODY]: sparqlUpdateSchema(isUpdate) }, celebrateOptions),
  async (req, res) => {
    try {
      const { sparqlUpdate } = req.body || {};
      const job = await queueSparql.add('sparql-update', { sparqlUpdate });

      log.info('update sparql enqueued', { jobId: job.id });

      res.status(202).json({ accepted: true, jobId: job.id });
    } catch (err) {
      log.error('update sparql failed', err?.message || err);
      res.status(500).json({
        error: 'Enqueue failed',
        detail: String(err?.message || err),
      });
    }
  }
);

module.exports = router;
