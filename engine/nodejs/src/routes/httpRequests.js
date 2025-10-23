const express = require('express');
const router = express.Router();

const { queueHttpRequests } = require('../queue');

// Pull the HTTP builders from the central utils barrel.
const {
  httpBuilders: {
    buildSelectRequests,
    bindingsToRequestsJson,
    buildSelectRequestIds,
    buildCountRequests
  },
  graphdb: { runSelect } // <-- moved here from ../sparql
} = require('../utils');

// Extract value from SPARQL JSON binding term.
function valueOf(b) { return b?.value; }

/**
 * Ingest one or many HTTP requests (enqueue write job).
 * Accepts object, array or { items: [...] }.
 */
router.post('/ingest-http', async (req, res) => {
  try {
    const raw = req.body ?? {};

    // Normalize to a flat array of items.
    const list = Array.isArray(raw)
      ? raw
      : (Array.isArray(raw.items) ? raw.items : [raw]);

    if (!Array.isArray(list) || list.length === 0) {
      return res.status(400).json({ error: 'Empty payload: expected an object, an array, or { items: [...] }' });
    }

    // Fast validation to prevent bad jobs.
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

    // Enqueue a single job with the full batch.
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
 * Paginated list of HTTP requests.
 * Uses 2-step query: ids page + details for those ids.
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

    // Build filters from querystring.
    const filters = { method, scheme, authority, path, headerName, headerValue, text };
    const lim = Number.parseInt(limit, 10) || 10;
    const off = Number.parseInt(offset, 10) || 0;

    // Page of ids (stable order).
    const idsSparql = buildSelectRequestIds({ filters, limit: lim, offset: off, orderBy: 'id' });
    const idsData = await runSelect(idsSparql);
    const pageIds = (idsData.results?.bindings || [])
      .map(b => valueOf(b.idVal))
      .filter(Boolean);

    // Count total matching items.
    const countSparql = buildCountRequests({ filters });
    const countData = await runSelect(countSparql);
    const total = Number(valueOf(countData.results?.bindings?.[0]?.total) || 0);

    // Fetch details for current page ids only.
    let items = [];
    if (pageIds.length > 0) {
      const detailsSparql = buildSelectRequests({
        ids: pageIds,
        filters: {},
        limit: 100000, // high ceiling for the denormalized rowset
        offset: 0
      });
      const detailsData = await runSelect(detailsSparql);
      items = bindingsToRequestsJson(detailsData.results?.bindings || []).items || [];

      // Reorder to match the id page order.
      const order = new Map(pageIds.map((id, i) => [id, i]));
      items.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
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
 * Get a single HTTP request by id.
 * Returns normalized JSON composed from denormalized bindings.
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
