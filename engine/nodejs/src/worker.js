const { Worker } = require('bullmq');
require('dotenv').config();
const { 
  connection, 
  queueNameHttpRequestsWrites, 
  queueNameSparqlWrites 
} = require('./queue');
const { runUpdate } = require('./sparql');
const {
  buildInsertFromHttpRequest,
  buildInsertFromHttpRequestsArray
} = require('./sparqlBuilders/httpRequests/ingestHttp');


// Payload Types:
// 1) payload = { ...single request... }
// 2) payload = [ {...}, {...} ]
// 3) payload = { items: [ {...}, {...} ] }
function normalizeHttpRequestsPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  if (payload && typeof payload === 'object') return [payload];
  throw new Error('Invalid payload: expected object, array, or { items: [...] }');
}

const workerHttpRequests = new Worker(
  queueNameHttpRequestsWrites,
  async (job) => {
    switch (job.name) {
      case 'http-ingest': {
        const { payload } = job.data || {};
        if (!payload) throw new Error('Missing payload');

        const list = normalizeHttpRequestsPayload(payload);

        let update;
        if (list.length === 1) {
          update = buildInsertFromHttpRequest(list[0]);
        } else {
          update = buildInsertFromHttpRequestsArray(list);
        }

        const status = await runUpdate(update);
        return { status, count: list.length };
      }
      default:
        throw new Error(`Unknown job: ${job.name}`);
    }
  },
  {
    connection,
    concurrency: Number(process.env.CONCURRENCY_WORKER_HTTP_REQUESTS) || 2,
    stalledInterval: Number(process.env.STALLED_INTERVAL_WORKER_HTTP_REQUESTS) || 30000
  }
);

const workerSparql = new Worker(
  queueNameSparqlWrites,
  async (job) => {
    switch (job.name) {
      case 'sparql-update': {
        const { sparqlUpdate } = job.data || {};
        if (!sparqlUpdate) throw new Error('Missing sparqlUpdate');
        const status = await runUpdate(sparqlUpdate);
        return { status };
      }
      default:
        throw new Error(`Unknown job: ${job.name}`);
    }
  },
  {
    connection,
    concurrency: Number(process.env.CONCURRENCY_WORKER_SPARQL) || 2,
    stalledInterval: Number(process.env.STALLED_INTERVAL_WORKER_SPARQL) || 30000
  }
);

workerHttpRequests.on('completed', (job, result) => console.log(`[HttpRequests Worker] Completed ${job.id}`, result));
workerHttpRequests.on('failed', (job, err) => console.error(`[HttpRequests Worker] Failed ${job?.id}`, err?.message));
workerHttpRequests.on('error', (err) => console.error('[HttpRequests Worker] Error', err?.message));

workerSparql.on('completed', (job, result) => console.log(`[Sparql Worker] Completed ${job.id}`, result));
workerSparql.on('failed', (job, err) => console.error(`[Sparql Worker] Failed ${job?.id}`, err?.message));
workerSparql.on('error', (err) => console.error('[Sparql Worker] Error', err?.message));