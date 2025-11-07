const express = require('express');
const router = express.Router();

const { celebrate, Segments, Joi } = require('celebrate');
const { queueTechstack } = require('../queue');
const { makeLogger } = require('../utils');

const log = makeLogger('api:techstack');


const techstackSchema = Joi.object({
  technologies: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        version: Joi.string().allow('', null),
      })
    )
    .required(),

  waf: Joi.array()
    .items(Joi.object({ name: Joi.string().required() }))
    .default([]),

  secureHeaders: Joi.array()
    .items(
      Joi.object({
        header: Joi.string().required(),
        description: Joi.string().allow('', null),
        urls: Joi.array().items(Joi.string().uri()).default([]),
      })
    )
    .default([]),


  cookies: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        domain: Joi.string().allow('', null),
        secure: Joi.boolean().default(false),
        httpOnly: Joi.boolean().default(false),
        sameSite: Joi.string().allow('', null),
        expirationDate: Joi.number().allow(null),
      })
    )
    .default([]),


  mainDomain: Joi.string().allow('', null).default(null),
}).required();


router.post(
  '/analyze',
  celebrate({ [Segments.BODY]: techstackSchema }),
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
  celebrate({
    [Segments.PARAMS]: Joi.object({
      jobId: Joi.string().required(),
    }),
  }),
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
