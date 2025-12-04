const express = require('express');
const router = express.Router();

const { celebrate, Segments } = require('celebrate');
const { queueTechstack } = require('../queue');
const {
  makeLogger,
  findingBuilders: {
    buildSelectTechstackFindingsPaged,
    bindingsToTechstackFindingsList,
    buildSelectTechstackFindingById,
    bindingsToTechstackFindingDetail,
  },
  graphdb: { runSelect },
  validators: {
    techstack: {
      techstackBodySchema,
      jobIdParamSchema,
      techstackFindingsListQuerySchema,
      techstackFindingIdParamSchema,
    },
    celebrateOptions,
  },
} = require('../utils');

const log = makeLogger('api:techstack');

/**
 * POST /techstack/analyze
 *
 * Enqueue a tech stack analysis job.
 *
 * The input is typically produced by passive fingerprinting tools and scanners
 * (e.g. Wappalyzer-like output, headers, cookies).
 *
 * Request body:
 * - technologies   : detected technologies (frameworks, servers, plugins, etc.)
 * - waf            : detected WAF / reverse proxy information
 * - secureHeaders  : security-related HTTP headers
 * - cookies        : cookie metadata (flags, lifetimes, scope...)
 * - mainDomain     : primary domain under assessment
 *
 * Response:
 * - 202 with the BullMQ job id and basic counts of input arrays
 * - 400 on validation error (handled by celebrate)
 * - 500 if the job cannot be enqueued
 */
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
      res.status(500).json({ error: 'Enqueue failed', detail: String(err?.message || err) });
    }
  }
);

/**
 * GET /techstack/results/:jobId
 *
 * Retrieve the status and result of a tech stack analysis job.
 *
 * Response:
 * - 200 with job state, result and timestamps
 * - 404 if the job does not exist
 * - 500 on internal errors
 */
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

/**
 * GET /techstack/finding/list
 *
 * Paginated list of TechstackScan findings detected by the Techstack resolver.
 * This endpoint only returns finding identifiers and summary information
 * (no detailed evidence).
 *
 * Query parameters:
 * - limit  : page size (default: 100)
 * - offset : page offset (default: 0)
 */
router.get(
  '/finding/list',
  celebrate({ [Segments.QUERY]: techstackFindingsListQuerySchema }, celebrateOptions),
  async (req, res) => {
    try {
      const { limit = '100', offset = '0' } = req.query;

      const lim = Number.parseInt(String(limit), 10) || 100;
      const off = Number.parseInt(String(offset), 10) || 0;

      const sparql = buildSelectTechstackFindingsPaged({ limit: lim, offset: off });
      const data = await runSelect(sparql);
      const bindings = data.results?.bindings || [];

      const { items, total } = bindingsToTechstackFindingsList(bindings);

      const hasNext = off + lim < total;
      const hasPrev = off > 0;
      const nextOffset = hasNext ? off + lim : null;
      const prevOffset = hasPrev ? Math.max(0, off - lim) : null;

      log.info('techstack findings list ok', {
        count: items.length,
        total,
        limit: lim,
        offset: off,
      });

      res.json({
        items,
        page: {
          limit: lim,
          offset: off,
          total,
          hasNext,
          hasPrev,
          nextOffset,
          prevOffset,
        },
      });
    } catch (err) {
      log.error('techstack findings list GraphDB query failed', err?.message || err);
      res.status(502).json({
        error: 'GraphDB query failed',
        detail: String(err?.message || err),
      });
    }
  }
);

/**
 * GET /techstack/finding/:id
 *
 * Retrieve detailed information for a single TechstackScan finding.
 *
 * The SPARQL query aggregates:
 * - scalar fields (severity, rule id, description, etc.)
 * - software evidence (detected technologies and versions)
 * - header evidence (security-related HTTP headers)
 * - cookie evidence (flags, lifetimes, attributes)
 */
router.get(
  '/finding/:id',
  celebrate({ [Segments.PARAMS]: techstackFindingIdParamSchema }, celebrateOptions),
  async (req, res) => {
    try {
      const { id } = req.params; // raw id from URL (URN)

      const sparql = buildSelectTechstackFindingById({ id });
      const data = await runSelect(sparql);
      const bindings = data.results?.bindings || [];

      const detail = bindingsToTechstackFindingDetail(bindings);

      if (!detail) {
        log.info('techstack finding detail: not found', { id });
        return res.status(404).json({ error: 'Not found', id });
      }

      log.info('techstack finding detail ok', { id });
      res.json(detail);
    } catch (err) {
      log.error('techstack finding detail GraphDB query failed', err?.message || err);
      res.status(502).json({
        error: 'GraphDB query failed',
        detail: String(err?.message || err),
      });
    }
  }
);

module.exports = router;
