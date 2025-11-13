const express = require('express');
const router = express.Router();

const { celebrate, Segments } = require('celebrate');

const { queueHttpRequests } = require('../queue');
const {
  httpBuilders: {
    buildSelectRequests,
    bindingsToRequestsJson,
    buildSelectRequestsPaged,
  },
  graphdb: { runSelect },
  makeLogger,
  validators: {
    httpRequests: {
      ingestPayloadSchema,
      listQuerySchema,
      idParamSchema,
      jobIdParamSchema,
    },
    celebrateOptions,
  },
} = require('../utils');

const log = makeLogger('api:http');

/**
 * Ingest one or more HTTP requests (enqueue write job)
 */
router.post(
  '/ingest-http',
  celebrate({ [Segments.BODY]: ingestPayloadSchema }, celebrateOptions),
  async (req, res) => {
    try {
      const raw = req.body ?? {};
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw.items)
        ? raw.items
        : [raw];

      const job = await queueHttpRequests.add('http-ingest', { payload: list });
      log.info('ingest-http enqueued', { jobId: job.id, count: list.length });

      if(raw?.activateResolver){
        const jobRes = await queueHttpRequests.add('http-resolver', {list});
        log.info('http-resolver enqueued', { jobId: jobRes.id, count: list.length });
      }

      res.status(202).json({ accepted: true, jobId: job.id, count: list.length });
    } catch (err) {
      log.error('ingest-http enqueue failed', err?.message || err);
      res
        .status(500)
        .json({ error: 'Enqueue failed', detail: String(err?.message || err) });
    }
  }
);

/**
 * Get the status/result of an HTTP ingest job
 * Mirrors /analyzer/results/:jobId but uses queueHttpRequests.
 *
 * GET /http/results/:jobId
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
 * Paginated list — single GraphDB request (total + page ids + details)
 */
router.get(
  '/list',
  celebrate({ [Segments.QUERY]: listQuerySchema }, celebrateOptions),
  async (req, res) => {
    try {
      const {
        limit = '10',
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
      const lim = Number.parseInt(limit, 10) || 10;
      const off = Number.parseInt(offset, 10) || 0;

      const sparql = buildSelectRequestsPaged({ filters, limit: lim, offset: off });
      const data = await runSelect(sparql);
      const bindings = data.results?.bindings || [];

      const total = (() => {
        for (const b of bindings) {
          const v = b?.total?.value;
          if (v !== undefined) return Number(v) || 0;
        }
        return 0;
      })();

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
 * Get a single HTTP request by id — single GraphDB request
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
        limit: 1000,
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

module.exports = router;
