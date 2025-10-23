const { Worker } = require('bullmq');
require('dotenv').config();

const {
  connection,
  queueNameHttpRequestsWrites,
  queueNameSparqlWrites
} = require('./queue');

// Import GraphDB update client + HTTP builders from utils.
const {
  graphdb: { runUpdate },
  httpBuilders: {
    buildInsertFromHttpRequest,
    buildInsertFromHttpRequestsArray,
    normalizeHttpRequestsPayload
  }
} = require('./utils');

// Worker consuming HTTP Request write jobs.
const workerHttpRequests = new Worker(
  queueNameHttpRequestsWrites,
  async (job) => {
    switch (job.name) {
      case 'http-ingest': {
        const { payload } = job.data || {};
        if (!payload) throw new Error('Missing payload');

        // Normalize and branch single vs batch to reduce SPARQL size.
        const list = normalizeHttpRequestsPayload(payload);

        let update;
        if (list.length === 1) {
          update = buildInsertFromHttpRequest(list[0]);
        } else {
          update = buildInsertFromHttpRequestsArray(list);
        }

        // Execute update; GraphDB handles transaction internally.
        const status = await runUpdate(update);
        return { status, count: list.length };
      }
      default:
        throw new Error(`Unknown job: ${job.name}`);
    }
  },
  {
    connection,
    // Tune concurrency and stalled checks via env.
    concurrency: Number(process.env.CONCURRENCY_WORKER_HTTP_REQUESTS) || 2,
    stalledInterval: Number(process.env.STALLED_INTERVAL_WORKER_HTTP_REQUESTS) || 30000
  }
);

// Worker consuming generic SPARQL UPDATE jobs.
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

// Basic observability (log successes/failures).
workerHttpRequests.on('completed', (job, result) =>
  console.log(`[HttpRequests Worker] Completed ${job.id}`, result)
);
workerHttpRequests.on('failed', (job, err) =>
  console.error(`[HttpRequests Worker] Failed ${job?.id}`, err?.message)
);
workerHttpRequests.on('error', (err) =>
  console.error('[HttpRequests Worker] Error', err?.message)
);

workerSparql.on('completed', (job, result) =>
  console.log(`[Sparql Worker] Completed ${job.id}`, result)
);
workerSparql.on('failed', (job, err) =>
  console.error(`[Sparql Worker] Failed ${job?.id}`, err?.message)
);
workerSparql.on('error', (err) =>
  console.error('[Sparql Worker] Error', err?.message)
);
