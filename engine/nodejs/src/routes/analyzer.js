// src/routes/analyzer.js
const express = require('express');
const router = express.Router();

const { celebrate, Segments } = require('celebrate');
const { queueAnalyzer } = require('../queue');
const {
  makeLogger,
  validators: {
    analyzer: { analyzerBodySchema, jobIdParamSchema },
    celebrateOptions,
  },
} = require('../utils');

const log = makeLogger('api:analyzer');

// === POST /analyzer/analyze ===
router.post(
  '/analyze',
  celebrate({ [Segments.BODY]: analyzerBodySchema }, celebrateOptions),
  async (req, res) => {
    try {
      const { url, html, scripts, forms, iframes, includeSnippets } = req.body || {};

      const job = await queueAnalyzer.add('sast-analyze', {
        url,
        html,
        scripts,
        forms,
        iframes,
        includeSnippets,
      });

      log.info('sast-analyze enqueued', {
        jobId: job.id,
        scripts: scripts.length,
        forms: forms.length,
        includeSnippets,
      });

      res.status(202).json({
        accepted: true,
        jobId: job.id,
        url,
        scripts: scripts.length,
        forms: forms.length,
        iframes: iframes.length,
        includeSnippets,
      });
    } catch (err) {
      log.error('sast enqueue failed', err?.message || err);
      res
        .status(500)
        .json({ error: 'Enqueue failed', detail: String(err?.message || err) });
    }
  }
);

// === GET /analyzer/results/:jobId ===
router.get(
  '/results/:jobId',
  celebrate({ [Segments.PARAMS]: jobIdParamSchema }, celebrateOptions),
  async (req, res) => {
    try {
      const { jobId } = req.params;
      const job = await queueAnalyzer.getJob(jobId);

      if (!job) {
        log.info('results: job not found', { jobId });
        return res.status(404).json({ error: 'Job not found', jobId });
      }

      const state = await job.getState();
      const result = job.returnvalue || null;

      log.info('results: job status', { jobId, state });

      res.json({
        jobId,
        state,
        result,
        createdAt: job.timestamp,
        finishedAt: job.finishedOn || null,
      });
    } catch (err) {
      log.error('results lookup failed', err?.message || err);
      res.status(500).json({
        error: 'Failed to retrieve results',
        detail: String(err?.message || err),
      });
    }
  }
);

// /finding/list ti da tutta la lista di urn dei finding inerenti ad AnalyzerResolverIstance dell'ontologia
// /finding/:id ti da i dettagli di uno specifico finding ottenuto dall'urn. Utilizzare il normilize in builders/helpers. Inoltre ti deve dare anche tutto l'htmlRef.

module.exports = router;
