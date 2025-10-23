const express = require('express');
const router = express.Router();

const { queueHttpRequests } = require('../queue');

const {
  httpBuilders: {
    buildSelectRequests,
    bindingsToRequestsJson,
    buildSelectRequestsPaged
  },
  graphdb: { runSelect }
} = require('../utils');

/**
 * Ingest one o più HTTP requests (enqueue write job).
 */
router.post('/ingest-http', async (req, res) => {
  try {
    const raw = req.body ?? {};

    const list = Array.isArray(raw)
      ? raw
      : (Array.isArray(raw.items) ? raw.items : [raw]);

    if (!Array.isArray(list) || list.length === 0) {
      return res.status(400).json({ error: 'Empty payload: expected an object, an array, or { items: [...] }' });
    }

    const errors = [];
    list.forEach((item, idx) => {
      const ok =
        item && typeof item === 'object' &&
        item.id &&
        item.method &&
        item.uri &&
        item.uri.full;
      if (!ok) {
        errors.push({ index: idx, message: 'Missing id/method/uri.full', item });
      }
    });

    if (errors.length) {
      return res.status(400).json({
        error: 'Validation failed for one or more items',
        details: errors
      });
    }

    const job = await queueHttpRequests.add('http-ingest', { payload: list });

    res.status(202).json({
      accepted: true,
      jobId: job.id,
      count: list.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Enqueue failed', detail: err.message });
  }
});

/**
 * Paginated list of HTTP requests — SINGLE GraphDB request.
 * Usa una SELECT con 2 subquery: total + page ids, poi join sui dettagli.
 */
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
      text
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

    const detailBindings = bindings.filter(b => b?.id?.value);

    let items = [];
    if (detailBindings.length > 0) {
      items = (bindingsToRequestsJson(detailBindings).items || []);
      items.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    }

    const hasNext = off + lim < total;
    const hasPrev = off > 0;
    const nextOffset = hasNext ? off + lim : null;
    const prevOffset = hasPrev ? Math.max(0, off - lim) : null;

    res.json({
      items,
      page: {
        limit: lim,
        offset: off,
        total,
        hasNext,
        hasPrev,
        nextOffset,
        prevOffset
      }
    });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'GraphDB query failed', detail: err.message });
  }
});

/**
 * Get a single HTTP request by id — già SINGLE GraphDB request.
 */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const sparql = buildSelectRequests({
      ids: [id],
      filters: {},
      limit: 1000,
      offset: 0
    });
    const data = await runSelect(sparql);
    const json = bindingsToRequestsJson(data.results?.bindings || []);
    const item = (json.items || [])[0];
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'GraphDB query failed', detail: err.message });
  }
});

module.exports = router;
