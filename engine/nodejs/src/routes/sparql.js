const express = require('express');
const router = express.Router();

const { queueSparql } = require('../queue');

// Import SPARQL helpers and GraphDB client from utils.
const {
  isSelectOrAsk,
  isUpdate,
  graphdb: { runSelect },
  makeLogger
} = require('../utils');

const log = makeLogger('api:sparql')

/**
 * Execute a SPARQL SELECT/ASK synchronously.
 * Validates the input to avoid UPDATEs in this endpoint.
 */
router.post('/query', async (req, res) => {
  try {
    const { sparql } = req.body || {};
    if (!sparql || !isSelectOrAsk(sparql)) {
      log.warn('query spaqrl validation: no SELECT or ASK in sparql');
      return res.status(400).json({ error: 'Provide a SPARQL SELECT/ASK in "sparql"' });
    }
    const data = await runSelect(sparql);
    log.info('query sparql ok', data.head);
    res.json({ data });
  } catch (err) {
    log.error('query sparql failed', err?.message || err);
    res.status(502).json({ error: 'GraphDB query failed', detail: err.message });
  }
});

/**
 * Enqueue a SPARQL UPDATE for async execution.
 * The actual execution happens in the worker.
 */
router.post('/update', async (req, res) => {
  try {
    const { sparqlUpdate } = req.body || {};
    if (!sparqlUpdate || !isUpdate(sparqlUpdate)) {
      log.warn('query spaqrl validation: no valid SPARQL UPDATE');
      return res.status(400).json({ error: 'Provide a valid SPARQL UPDATE in "sparqlUpdate"' });
    }
    const job = await queueSparql.add('sparql-update', { sparqlUpdate });
    log.info('update sparql enqueued', { jobId: job.id })
    res.status(202).json({ accepted: true, jobId: job.id });
  } catch (err) {
    log.error('update sparql failed', err?.message || err);
    res.status(500).json({ error: 'Enqueue failed', detail: err.message });
  }
});

module.exports = router;
