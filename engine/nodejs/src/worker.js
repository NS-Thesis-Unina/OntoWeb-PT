const { Worker } = require('bullmq');
require('dotenv').config();

const {
  connection,
  queueNameHttpRequestsWrites,
  queueNameSparqlWrites,
} = require('./queue');

const {
  graphdb: { runUpdate, runSelect },
  httpBuilders: {
    buildInsertFromHttpRequest,
    buildInsertFromHttpRequestsArray,
    normalizeHttpRequestsPayload,
  },
  monitors: {
    startRedisMonitor,
    startGraphDBHealthProbe
  },
  makeLogger
} = require('./utils');

const logHttp = makeLogger('worker:http');
const logSp = makeLogger('worker:sparql');

// HTTP requests writer: builds a single INSERT (single/batch) and updates GraphDB
const workerHttpRequests = new Worker(
  queueNameHttpRequestsWrites,
  async (job) => {
    switch (job.name) {
      case 'http-ingest': {
        const { payload } = job.data || {};
        if (!payload) throw new Error('Missing payload');

        const list = normalizeHttpRequestsPayload(payload);
        const update =
          list.length === 1
            ? buildInsertFromHttpRequest(list[0])
            : buildInsertFromHttpRequestsArray(list);

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
    stalledInterval: Number(process.env.STALLED_INTERVAL_WORKER_HTTP_REQUESTS) || 30000,
  }
);

workerHttpRequests.on('completed', (job, result) => {
  logHttp.info(`completed job=${job.name} id=${job.id}`, { result });
});
workerHttpRequests.on('failed', (job, err) => {
  logHttp.warn(`failed job=${job?.name} id=${job?.id}`, err?.message || err);
});
workerHttpRequests.on('error', (err) => {
  logHttp.warn('worker error', err?.message || err);
});

// Generic SPARQL UPDATE worker
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
    stalledInterval: Number(process.env.STALLED_INTERVAL_WORKER_SPARQL) || 30000,
  }
);

workerSparql.on('completed', (job, result) => {
  logSp.info(`completed job=${job.name} id=${job.id}`, { result });
});
workerSparql.on('failed', (job, err) => {
  logSp.warn(`failed job=${job?.name} id=${job?.id}`, err?.message || err);
});
workerSparql.on('error', (err) => {
  logSp.warn('worker error', err?.message || err);
});

startRedisMonitor(connection, 'redis:worker');
startGraphDBHealthProbe(runSelect, 'graphdb:worker');