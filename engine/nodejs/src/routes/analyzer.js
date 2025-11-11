// src/routes/analyzer.js
const express = require('express');
const router = express.Router();

const { celebrate, Segments, Joi } = require('celebrate');
const { queueAnalyzer } = require('../queue');
const { makeLogger } = require('../utils');

const log = makeLogger('api:analyzer');

const analyzerSchema = Joi.object({
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
      })
    )
    .default([]),

  forms: Joi.array()
    .items(
      Joi.object({
        action: Joi.string().allow('', null),
        method: Joi.string().allow('', null),
        inputs: Joi.array().items(Joi.string()).default([]),
      })
    )
    .default([]),

  iframes: Joi.array()
    .items(Joi.object({ src: Joi.string().allow('', null) }))
    .default([]),

  includeSnippets: Joi.boolean().default(false),
}).required();

// === POST /analyzer/analyze ===
router.post(
  '/analyze',
  celebrate({ [Segments.BODY]: analyzerSchema }),
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
  celebrate({
    [Segments.PARAMS]: Joi.object({
      jobId: Joi.string().required(),
    }),
  }),
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

module.exports = router;
