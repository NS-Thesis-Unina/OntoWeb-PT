const express = require('express');
const router = express.Router();

const { celebrate, Segments } = require('celebrate');
const { queueTechstack } = require('../queue');
const {
  makeLogger,
  validators: {
    techstack: { techstackBodySchema, jobIdParamSchema },
    celebrateOptions,
  },
} = require('../utils');

const log = makeLogger('api:techstack');

router.post(
  '/analyze',
  celebrate({ [Segments.BODY]: techstackBodySchema }, celebrateOptions),
  async (req, res) => {
    try {
      const { technologies, waf, secureHeaders, cookies, mainDomain } = req.body || {};

      const job = await queueTechstack.add('techstack-analyze', {
        technologies,
        waf,
        secureHeaders,
        cookies,
        mainDomain,
      });

      log.info('techstack-analyze enqueued', {
        jobId: job.id,
        count: technologies.length,
        cookies: cookies.length,
      });

      res.status(202).json({
        accepted: true,
        jobId: job.id,
        technologies: technologies.length,
        waf: waf.length,
        secureHeaders: secureHeaders.length,
        cookies: cookies.length,
      });
    } catch (err) {
      log.error('techstack enqueue failed', err?.message || err);
      res
        .status(500)
        .json({ error: 'Enqueue failed', detail: String(err?.message || err) });
    }
  }
);

router.get(
  '/results/:jobId',
  celebrate({ [Segments.PARAMS]: jobIdParamSchema }, celebrateOptions),
  async (req, res) => {
    try {
      const { jobId } = req.params;
      const job = await queueTechstack.getJob(jobId);

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
