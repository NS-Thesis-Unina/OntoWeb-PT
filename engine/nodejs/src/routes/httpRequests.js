const express = require('express');
const router = express.Router();

const { queueHttpRequests } = require('../queue');
const {
  httpBuilders: {
    buildSelectRequests,
    bindingsToRequestsJson,
    buildSelectRequestsPaged,
  },
  graphdb: { runSelect },
  makeLogger
} = require('../utils');

const log = makeLogger('api:http');

// Ingest one or more HTTP requests (enqueue write job)
router.post('/ingest-http', async (req, res) => {
  try {
    const raw = req.body ?? {};
    const list = Array.isArray(raw) ? raw : (Array.isArray(raw.items) ? raw.items : [raw]);

    if (!Array.isArray(list) || list.length === 0) {
      log.warn('ingest-http validation: empty payload');
      return res
        .status(400)
        .json({ error: 'Empty payload: expected an object, an array, or { items: [...] }' });
    }

    const errors = [];
    list.forEach((item, idx) => {
      const ok = item && typeof item === 'object' && item.id && item.method && item.uri && item.uri.full;
      if (!ok) errors.push({ index: idx, message: 'Missing id/method/uri.full' });
    });

    if (errors.length) {
      log.warn('ingest-http validation failed', { count: errors.length });
      return res.status(400).json({
        error: 'Validation failed for one or more items',
        details: errors,
      });
    }

    const job = await queueHttpRequests.add('http-ingest', { payload: list });
    log.info('ingest-http enqueued', { jobId: job.id, count: list.length });

    res.status(202).json({ accepted: true, jobId: job.id, count: list.length });
  } catch (err) {
    log.error('ingest-http enqueue failed', err?.message || err);
    res.status(500).json({ error: 'Enqueue failed', detail: String(err?.message || err) });
  }
});

// Paginated list — single GraphDB request (total + page ids + details)
router.get('/list', async (req, res) => {
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

    const filters = { method, scheme, authority, path, headerName, headerValue, text };
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
      page: { limit: lim, offset: off, total, hasNext, hasPrev, nextOffset, prevOffset },
    });
  } catch (err) {
    log.error('list GraphDB query failed', err?.message || err);
    res.status(502).json({ error: 'GraphDB query failed', detail: String(err?.message || err) });
  }
});

// Get a single HTTP request by id — single GraphDB request
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const sparql = buildSelectRequests({ ids: [id], filters: {}, limit: 1000, offset: 0 });
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
    res.status(502).json({ error: 'GraphDB query failed', detail: String(err?.message || err) });
  }
});

module.exports = router;
