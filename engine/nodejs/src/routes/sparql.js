const express = require('express');
const router = express.Router();

const { queueSparql } = require('../queue');

// Import SPARQL helpers and GraphDB client from utils.
const {
  isSelectOrAsk,
  isUpdate,
  graphdb: { runSelect }
} = require('../utils');

/**
 * Execute a SPARQL SELECT/ASK synchronously.
 * Validates the input to avoid UPDATEs in this endpoint.
 */
router.post('/query', async (req, res) => {
  try {
    const { sparql } = req.body || {};
    if (!sparql || !isSelectOrAsk(sparql)) {
      return res.status(400).json({ error: 'Provide a SPARQL SELECT/ASK in "sparql"' });
    }
    const data = await runSelect(sparql);
    res.json({ data });
  } catch (err) {
    console.error(err.response?.data || err);
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
      return res.status(400).json({ error: 'Provide a valid SPARQL UPDATE in "sparqlUpdate"' });
    }
    const job = await queueSparql.add('sparql-update', { sparqlUpdate });
    res.status(202).json({ accepted: true, jobId: job.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Enqueue failed', detail: err.message });
  }
});

module.exports = router;
