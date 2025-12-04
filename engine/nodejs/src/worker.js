const { Worker } = require('bullmq');
require('dotenv').config();

const {
  connection,
  queueNameHttpRequestsWrites,
  queueNameSparqlWrites,
  queueNameTechstackWrites,
  queueNameAnalyzerWrites,
} = require('./queue');

const { io } = require('socket.io-client');
const { onLog } = require('./utils');

const {
  graphdb: { runUpdate, runSelect },
  httpBuilders: {
    buildInsertFromHttpRequest,
    buildInsertFromHttpRequestsArray,
    normalizeHttpRequestsPayload,
  },
  findingBuilders: { buildInsertFromFindingsArray },
  resolvers: {
    techstack: { resolveTechstack },
    analyzer: { resolveAnalyzer },
    http: { analyzeHttpRequests },
  },
  monitors: { startRedisMonitor, startGraphDBHealthProbe },
  makeLogger,
} = require('./utils');

const logHttp = makeLogger('worker:http');
const logSp = makeLogger('worker:sparql');
const logTech = makeLogger('worker:techstack');
const logAnalyzer = makeLogger('worker:analyzer');

const logForward = makeLogger('logs-forwarder');

/**
 * WebSocket URL of the API server that exposes the /logs namespace.
 *
 * This allows the worker process to forward its logs to the API instance,
 * which then broadcasts them to connected dashboard clients.
 */
const LOGS_WS_URL =
  process.env.LOGS_WS_URL ||
  `http://${process.env.SERVER_HOST || 'localhost'}:${process.env.SERVER_PORT || 8081}/logs`;

/**
 * Socket.IO client towards the API server (/logs namespace).
 *
 * The worker emits log entries over this connection so that all logs
 * (API + workers) can be observed in a single WebSocket stream.
 */
const logsSocket = io(LOGS_WS_URL, {
  transports: ['websocket'],
  reconnection: true,
});

logsSocket.on('connect', () => {
  logForward.info('Connected to logs WebSocket', { url: LOGS_WS_URL });
});

logsSocket.on('disconnect', () => {
  logForward.warn('Disconnected from logs WebSocket');
});

logsSocket.on('error', (err) => {
  logForward.warn('Logs WebSocket error', err?.message || err);
});

/**
 * Global log forwarder
 *
 * Every log entry produced via makeLogger in this process is forwarded
 * to the API server, which then emits it to /logs subscribers.
 */
onLog((entry) => {
  try {
    // entry: { ts, level, ns, msg }
    logsSocket.emit('log', entry);
  } catch {
    // If the socket is down we simply drop this log entry.
  }
});

/* ========================================================================
 * HTTP Requests worker
 * ====================================================================== */

/**
 * Worker that:
 * - Ingests raw HTTP request payloads and persists them into GraphDB
 * - Runs HTTP analysis jobs and writes corresponding findings
 */
const workerHttpRequests = new Worker(
  queueNameHttpRequestsWrites,
  async (job) => {
    switch (job.name) {
      case 'http-ingest': {
        const { payload } = job.data || {};
        if (!payload) throw new Error('Missing payload');

        /**
         * Normalize the incoming payload into a list of HTTP request records,
         * then build a single SPARQL UPDATE that inserts them into GraphDB.
         */
        const list = normalizeHttpRequestsPayload(payload);
        const update =
          list.length === 1
            ? buildInsertFromHttpRequest(list[0])
            : buildInsertFromHttpRequestsArray(list);

        const status = await runUpdate(update);
        return { status, count: list.length, payload };
      }
      case 'http-resolver': {
        const { list } = job.data || {};
        if (!list || !Array.isArray(list)) throw new Error('Missing or invalid requests list');

        logHttp.info(`http-resolver start (count=${list.length})`);

        /**
         * Analyze HTTP requests and derive:
         * - security findings
         * - aggregate statistics per host / endpoint / category
         */
        const result = await analyzeHttpRequests(list);

        logHttp.info('http-resolver completed', {
          totalFindings: result.totalFindings,
          stats: result.stats,
        });

        // Persist HTTP findings into the findings graph.
        let insertStatus = null;
        try {
          if (result && Array.isArray(result.findings) && result.findings.length > 0) {
            const findingsForInsert = result.findings.map((f) => ({
              ...f,
              // Ensure that a "source" is always present for traceability.
              source: f.source || 'http',
            }));
            const sparql = buildInsertFromFindingsArray(findingsForInsert);
            insertStatus = await runUpdate(sparql);
            logHttp.info('http-resolver findings inserted into GraphDB', {
              status: insertStatus,
              count: findingsForInsert.length,
            });
          }
        } catch (err) {
          logHttp.warn('Failed to insert HTTP findings into GraphDB', err?.message || err);
        }

        return { result, insertStatus };
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
  if (job.name === 'http-ingest') {
    logHttp.info(`completed job=${job.name} id=${job.id}`, {
      status: result.status,
      count: result.count,
    });
  } else if (job.name === 'http-resolver') {
    logHttp.info(`completed job=${job.name} id=${job.id}`, {
      ok: result?.result?.ok,
      totalFindings: result?.result?.totalFindings,
      stats: result?.result?.stats,
      insertStatus: result?.insertStatus ?? null,
    });
  } else {
    logHttp.info(`completed job=${job.name} id=${job.id}`, result);
  }
});

workerHttpRequests.on('failed', (job, err) => {
  logHttp.warn(`failed job=${job?.name} id=${job?.id}`, err?.message || err);
});

workerHttpRequests.on('error', (err) => {
  logHttp.warn('worker error', err?.message || err);
});

/* ========================================================================
 * SPARQL UPDATE worker
 * ====================================================================== */

/**
 * Worker responsible for executing generic SPARQL UPDATE statements.
 *
 * This decouples write traffic from the API process and allows retries
 * with custom backoff strategies.
 */
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

/* ========================================================================
 * Techstack analysis worker
 * ====================================================================== */

/**
 * Worker that resolves the technology stack information into structured
 * findings and persists them into GraphDB.
 */
const workerTechstack = new Worker(
  queueNameTechstackWrites,
  async (job) => {
    switch (job.name) {
      case 'techstack-analyze': {
        const { technologies, waf, secureHeaders, cookies, mainDomain } = job.data || {};
        if (!technologies || !Array.isArray(technologies)) {
          throw new Error('Invalid technologies payload');
        }

        const result = await resolveTechstack({
          technologies,
          waf,
          secureHeaders,
          cookies,
          mainDomain,
        });

        let insertStatus = null;
        try {
          if (result && Array.isArray(result.findings) && result.findings.length > 0) {
            const findingsForInsert = result.findings.map((f) => ({
              ...f,
              source: f.source || 'techstack',
            }));
            const sparql = buildInsertFromFindingsArray(findingsForInsert);
            insertStatus = await runUpdate(sparql);
            logTech.info('techstack-analyze findings inserted into GraphDB', {
              status: insertStatus,
              count: findingsForInsert.length,
            });
          }
        } catch (err) {
          logTech.warn('Failed to insert Techstack findings into GraphDB', err?.message || err);
        }

        return { result, insertStatus };
      }
      default:
        throw new Error(`Unknown job: ${job.name}`);
    }
  },
  {
    connection,
    concurrency: Number(process.env.CONCURRENCY_WORKER_TECHSTACK) || 2,
    stalledInterval: Number(process.env.STALLED_INTERVAL_WORKER_TECHSTACK) || 30000,
  }
);

workerTechstack.on('completed', (job, result) => {
  logTech.info(`completed job=${job.name} id=${job.id}`, {
    results: {
      technologies: result?.result?.technologies?.length || 0,
      waf: result?.result?.waf?.length || 0,
      secureHeaders: result?.result?.secureHeaders?.length || 0,
      cookies: result?.result?.cookies?.length || 0,
    },
    insertStatus: result?.insertStatus ?? null,
  });
});

workerTechstack.on('failed', (job, err) => {
  logTech.warn(`failed job=${job?.name} id=${job?.id}`, err?.message || err);
});

workerTechstack.on('error', (err) => {
  logTech.warn('worker error', err?.message || err);
});

/* ========================================================================
 * Analyzer (SAST) worker
 * ====================================================================== */

/**
 * Worker that runs static analysis (SAST-like) against HTML/JS artifacts
 * and persists the resulting findings into GraphDB.
 */
const workerAnalyzer = new Worker(
  queueNameAnalyzerWrites,
  async (job) => {
    if (job.name === 'sast-analyze') {
      const { url, html, scripts, forms, iframes, includeSnippets } = job.data || {};

      const result = await resolveAnalyzer({
        url,
        html,
        scripts,
        forms,
        iframes,
        includeSnippets: includeSnippets ?? false,
      });

      let insertStatus = null;
      try {
        if (result && result.ok && Array.isArray(result.findings) && result.findings.length > 0) {
          const findingsForInsert = result.findings.map((f) => ({
            ...f,
            source: f.source || 'analyzer',
          }));
          const sparql = buildInsertFromFindingsArray(findingsForInsert);
          insertStatus = await runUpdate(sparql);
          logAnalyzer.info('sast-analyze findings inserted into GraphDB', {
            status: insertStatus,
            count: findingsForInsert.length,
          });
        }
      } catch (err) {
        logAnalyzer.warn('Failed to insert Analyzer findings into GraphDB', err?.message || err);
      }

      return { result, insertStatus };
    }
    throw new Error(`Unknown job: ${job.name}`);
  },
  {
    connection,
    concurrency: Number(process.env.CONCURRENCY_WORKER_ANALYZER) || 2,
    stalledInterval: Number(process.env.STALLED_INTERVAL_WORKER_ANALYZER) || 30000,
  }
);

workerAnalyzer.on('completed', (job, result) => {
  logAnalyzer.info(`completed job=${job.name} id=${job.id}`, {
    ok: result?.result?.ok,
    totalFindings: result?.result?.totalFindings,
    stats: result?.result?.stats,
    insertStatus: result?.insertStatus ?? null,
  });
});

workerAnalyzer.on('failed', (job, err) => {
  logAnalyzer.warn(`failed job=${job?.name} id=${job?.id}`, err?.message || err);
});

workerAnalyzer.on('error', (err) => {
  logAnalyzer.warn('worker error', err?.message || err);
});

/* ========================================================================
 * Monitors (worker process)
 * ====================================================================== */

/**
 * Health monitors for the worker process.
 *
 * These do not update the API-facing registry directly, but are useful
 * for logs and external observability.
 */
startRedisMonitor(connection, 'redis:worker');
startGraphDBHealthProbe(runSelect, 'graphdb:worker');
