const express = require('express');
const router = express.Router();

const { celebrate, Segments } = require('celebrate');
const { queueAnalyzer } = require('../queue');
const {
  makeLogger,
  findingBuilders: {
    buildSelectAnalyzerFindingsPaged,
    bindingsToAnalyzerFindingsList,
    buildSelectAnalyzerFindingById,
    bindingsToAnalyzerFindingDetail,
  },
  graphdb: { runSelect },
  validators: {
    analyzer: {
      analyzerBodySchema,
      jobIdParamSchema,
      analyzerFindingsListQuerySchema,
      analyzerFindingIdParamSchema,
    },
    celebrateOptions,
  },
} = require('../utils');

const log = makeLogger('api:analyzer');

/**
 * POST /analyzer/analyze
 *
 * Enqueue a SAST/DOM/HTML analysis job.
 *
 * Request body:
 * - url             : page URL (used for context and correlation)
 * - html            : raw HTML of the page
 * - scripts         : array of script descriptors
 * - forms           : array of form descriptors
 * - iframes         : array of iframe descriptors
 * - includeSnippets : whether to include code snippets in the analysis
 *
 * Response:
 * - 202 Accepted with a BullMQ job id
 * - 400 if validation fails (handled by celebrate)
 * - 500 if the job cannot be enqueued
 */
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
      res.status(500).json({ error: 'Enqueue failed', detail: String(err?.message || err) });
    }
  }
);

/**
 * GET /analyzer/results/:jobId
 *
 * Retrieve the status and result of a previously enqueued analyzer job.
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

/**
 * GET /analyzer/finding/list
 *
 * Paginated list of AnalyzerFinding created by the analyzer worker.
 * This endpoint only returns finding identifiers and summary information, not
 * the full HTML context.
 *
 * Query parameters:
 * - limit  : page size (default: 100)
 * - offset : page offset (default: 0)
 */
router.get(
  '/finding/list',
  celebrate({ [Segments.QUERY]: analyzerFindingsListQuerySchema }, celebrateOptions),
  async (req, res) => {
    try {
      const { limit = '100', offset = '0' } = req.query;

      const lim = Number.parseInt(String(limit), 10) || 100;
      const off = Number.parseInt(String(offset), 10) || 0;

      const sparql = buildSelectAnalyzerFindingsPaged({ limit: lim, offset: off });
      const data = await runSelect(sparql);
      const bindings = data.results?.bindings || [];

      const { items, total } = bindingsToAnalyzerFindingsList(bindings);

      const hasNext = off + lim < total;
      const hasPrev = off > 0;
      const nextOffset = hasNext ? off + lim : null;
      const prevOffset = hasPrev ? Math.max(0, off - lim) : null;

      log.info('analyzer findings list ok', {
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
      log.error('analyzer findings list GraphDB query failed', err?.message || err);
      res.status(502).json({
        error: 'GraphDB query failed',
        detail: String(err?.message || err),
      });
    }
  }
);

/**
 * GET /analyzer/finding/:id
 *
 * Retrieve detailed information for a single AnalyzerFinding.
 *
 * The SPARQL query aggregates:
 * - scalar fields (severity, category, etc.)
 * - contextual information (location in the DOM, related assets)
 * - full HTML reference (root + nested tags, when available)
 */
router.get(
  '/finding/:id',
  celebrate({ [Segments.PARAMS]: analyzerFindingIdParamSchema }, celebrateOptions),
  async (req, res) => {
    try {
      const { id } = req.params; // raw id from URL (URN)

      const sparql = buildSelectAnalyzerFindingById({ id });
      const data = await runSelect(sparql);
      const bindings = data.results?.bindings || [];

      const detail = bindingsToAnalyzerFindingDetail(bindings);

      if (!detail) {
        log.info('analyzer finding detail: not found', { id });
        return res.status(404).json({ error: 'Not found', id });
      }

      log.info('analyzer finding detail ok', { id });
      res.json(detail);
    } catch (err) {
      log.error('analyzer finding detail GraphDB query failed', err?.message || err);
      res.status(502).json({
        error: 'GraphDB query failed',
        detail: String(err?.message || err),
      });
    }
  }
);

module.exports = router;
