const express = require('express');
const router = express.Router();

const { celebrate, Segments } = require('celebrate');

const { queueHttpRequests } = require('../queue');
const {
  httpBuilders: { buildSelectRequests, bindingsToRequestsJson, buildSelectRequestsPaged },
  findingBuilders: {
    buildSelectHttpFindingsPaged,
    bindingsToHttpFindingsList,
    bindingsToHttpFindingDetail,
    buildSelectHttpFindingById,
  },
  graphdb: { runSelect },
  makeLogger,
  validators: {
    httpRequests: {
      ingestPayloadSchema,
      listQuerySchema,
      idParamSchema,
      jobIdParamSchema,
      httpFindingsListQuerySchema,
      httpFindingIdParamSchema,
    },
    celebrateOptions,
  },
} = require('../utils');

const log = makeLogger('api:http');

/**
 * POST /http-requests/ingest-http
 *
 * Ingest one or more HTTP requests and enqueue a write job.
 *
 * The payload can be:
 * - a single request object
 * - an array of request objects
 * - { items: Request[] } wrapper
 *
 * Optional:
 * - activateResolver: if true, enqueue an additional "http-resolver" job to
 *   analyze the ingested traffic and generate findings.
 *
 * Response (202):
 * {
 *   resRequest: {
 *     accepted: true,
 *     jobId: <id>,
 *     count: <number of ingested requests>
 *   },
 *   resResolver?: {
 *     accepted: true,
 *     jobId: <id>,
 *     count: <number of analyzed requests>
 *   }
 * }
 */
router.post(
  '/ingest-http',
  celebrate({ [Segments.BODY]: ingestPayloadSchema }, celebrateOptions),
  async (req, res) => {
    try {
      const raw = req.body ?? {};
      const list = Array.isArray(raw) ? raw : Array.isArray(raw.items) ? raw.items : [raw];

      let objRes = {};
      const job = await queueHttpRequests.add('http-ingest', { payload: list });
      log.info('ingest-http enqueued', { jobId: job.id, count: list.length });

      objRes = {
        resRequest: { accepted: true, jobId: job.id, count: list.length },
      };

      if (raw?.activateResolver) {
        const jobRes = await queueHttpRequests.add('http-resolver', { list });
        objRes = {
          ...objRes,
          resResolver: {
            accepted: true,
            jobId: jobRes.id,
            count: list.length,
          },
        };
        log.info('http-resolver enqueued', {
          jobId: jobRes.id,
          count: list.length,
        });
      }

      res.status(202).json(objRes);
    } catch (err) {
      log.error('ingest-http enqueue failed', err?.message || err);
      res.status(500).json({ error: 'Enqueue failed', detail: String(err?.message || err) });
    }
  }
);

/**
 * GET /http-requests/results/:jobId
 *
 * Retrieve the status and result of an HTTP job.
 * Mirrors /analyzer/results/:jobId but uses queueHttpRequests.
 *
 * Response:
 * - 200 with job status and return value
 * - 404 if the job does not exist
 * - 500 on internal errors
 */
router.get(
  '/results/:jobId',
  celebrate({ [Segments.PARAMS]: jobIdParamSchema }, celebrateOptions),
  async (req, res) => {
    try {
      const { jobId } = req.params;
      const job = await queueHttpRequests.getJob(jobId);

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
 * GET /http-requests/list
 *
 * Paginated list of HTTP requests.
 *
 * The underlying SPARQL query returns:
 * - the total count (for pagination metadata)
 * - page of request ids + detailed fields
 *
 * Query parameters:
 * - limit, offset           : pagination
 * - method, scheme, path... : optional filters applied at SPARQL level
 */
router.get(
  '/list',
  celebrate({ [Segments.QUERY]: listQuerySchema }, celebrateOptions),
  async (req, res) => {
    try {
      const {
        limit = '100',
        offset = '0',
        method,
        scheme,
        authority,
        path,
        headerName,
        headerValue,
        text,
      } = req.query;

      const filters = {
        method,
        scheme,
        authority,
        path,
        headerName,
        headerValue,
        text,
      };
      const lim = Number.parseInt(limit, 10) || 100;
      const off = Number.parseInt(offset, 10) || 0;

      const sparql = buildSelectRequestsPaged({ filters, limit: lim, offset: off });
      const data = await runSelect(sparql);
      const bindings = data.results?.bindings || [];

      // Extract total from the first row that exposes ?total
      const total = (() => {
        for (const b of bindings) {
          const v = b?.total?.value;
          if (v !== undefined) return Number(v) || 0;
        }
        return 0;
      })();

      // Filter rows that actually represent HTTP request details
      const detailBindings = bindings.filter((b) => b?.id?.value);

      let items = [];
      if (detailBindings.length > 0) {
        items = bindingsToRequestsJson(detailBindings).items || [];
        items.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      }

      const hasNext = off + lim < total;
      const hasPrev = off > 0;
      const nextOffset = hasNext ? off + lim : null;
      const prevOffset = hasPrev ? Math.max(0, off - lim) : null;

      log.info('list ok', { count: items.length, total, limit: lim, offset: off });

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
      log.error('list GraphDB query failed', err?.message || err);
      res.status(502).json({
        error: 'GraphDB query failed',
        detail: String(err?.message || err),
      });
    }
  }
);

/**
 * GET /http-requests/:id
 *
 * Retrieve a single HTTP request by id.
 * Uses a single SPARQL query to fetch the full representation.
 */
router.get(
  '/:id',
  celebrate({ [Segments.PARAMS]: idParamSchema }, celebrateOptions),
  async (req, res) => {
    try {
      const id = req.params.id;
      const sparql = buildSelectRequests({
        ids: [id],
        filters: {},
        limit: 100,
        offset: 0,
      });
      const data = await runSelect(sparql);
      const json = bindingsToRequestsJson(data.results?.bindings || []);
      const item = (json.items || [])[0];

      if (!item) {
        log.info('get by id: not found', { id });
        return res.status(404).json({ error: 'Not found' });
      }

      log.info('get by id: ok', { id });
      res.json(item);
    } catch (err) {
      log.error('get by id GraphDB query failed', err?.message || err);
      res.status(502).json({
        error: 'GraphDB query failed',
        detail: String(err?.message || err),
      });
    }
  }
);

/**
 * GET /http-requests/finding/list
 *
 * Paginated list of HttpFinding detected by the HTTP resolver.
 * This endpoint only returns finding identifiers and summary metadata.
 *
 * Query parameters:
 * - limit, offset : pagination
 */
router.get(
  '/finding/list',
  celebrate({ [Segments.QUERY]: httpFindingsListQuerySchema }, celebrateOptions),
  async (req, res) => {
    try {
      const { limit = '100', offset = '0' } = req.query;

      const lim = Number.parseInt(String(limit), 10) || 100;
      const off = Number.parseInt(String(offset), 10) || 0;

      const sparql = buildSelectHttpFindingsPaged({ limit: lim, offset: off });
      const data = await runSelect(sparql);
      const bindings = data.results?.bindings || [];

      const { items, total } = bindingsToHttpFindingsList(bindings);

      const hasNext = off + lim < total;
      const hasPrev = off > 0;
      const nextOffset = hasNext ? off + lim : null;
      const prevOffset = hasPrev ? Math.max(0, off - lim) : null;

      log.info('http findings list ok', {
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
      log.error('http findings list GraphDB query failed', err?.message || err);
      res.status(502).json({
        error: 'GraphDB query failed',
        detail: String(err?.message || err),
      });
    }
  }
);

/**
 * GET /http-requests/finding/:id
 *
 * Retrieve detailed information for a single HttpFinding.
 *
 * The detail includes:
 * - scalar attributes (severity, rule, evidence)
 * - related HTTP entities (request, response, headers, etc.)
 */
router.get(
  '/finding/:id',
  celebrate({ [Segments.PARAMS]: httpFindingIdParamSchema }, celebrateOptions),
  async (req, res) => {
    try {
      const { id } = req.params; // raw id from URL

      const sparql = buildSelectHttpFindingById({ id });
      const data = await runSelect(sparql);
      const bindings = data.results?.bindings || [];

      const detail = bindingsToHttpFindingDetail(bindings);

      if (!detail) {
        log.info('http finding detail: not found', { id });
        return res.status(404).json({ error: 'Not found', id });
      }

      log.info('http finding detail ok', { id });
      res.json(detail);
    } catch (err) {
      log.error('http finding detail GraphDB query failed', err?.message || err);
      res.status(502).json({
        error: 'GraphDB query failed',
        detail: String(err?.message || err),
      });
    }
  }
);

module.exports = router;
