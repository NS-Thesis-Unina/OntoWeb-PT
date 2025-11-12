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
    sparql: {
      sparqlQuerySchema,
      sparqlUpdateSchema
    },
    celebrateOptions
  }
} = require('../utils');

const log = makeLogger('api:sparql');

/**
 * Execute a SPARQL SELECT/ASK synchronously.
 * Validates the input to avoid UPDATEs in this endpoint.
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
      res.status(502).json({ error: 'GraphDB query failed', detail: err.message });
    }
  }
);

/**
 * Enqueue a SPARQL UPDATE for async execution.
 * The actual execution happens in the worker.
 */
router.post(
  '/update',
  celebrate({ [Segments.BODY]: sparqlUpdateSchema(isUpdate) }, celebrateOptions),
  async (req, res) => {
    try {
      const { sparqlUpdate } = req.body || {};
      const job = await queueSparql.add('sparql-update', { sparqlUpdate });
      log.info('update sparql enqueued', { jobId: job.id })
      res.status(202).json({ accepted: true, jobId: job.id });
    } catch (err) {
      log.error('update sparql failed', err?.message || err);
      res.status(500).json({ error: 'Enqueue failed', detail: err.message });
    }
  }
);

module.exports = router;
