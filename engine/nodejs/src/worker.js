const { Worker } = require('bullmq');
require('dotenv').config();

const {
  connection,
  queueNameHttpRequestsWrites,
  queueNameSparqlWrites,
  queueNameTechstackWrites,
  queueNameAnalyzerWrites,
} = require('./queue');

const {
  graphdb: { runUpdate, runSelect },
  httpBuilders: {
    buildInsertFromHttpRequest,
    buildInsertFromHttpRequestsArray,
    normalizeHttpRequestsPayload,
  },
  resolvers: {
    techstack: { resolveTechstack },
    analyzer: { resolveAnalyzer },
    http: { analyzeHttpRequests },
  },
  monitors: {
    startRedisMonitor,
    startGraphDBHealthProbe,
  },
  makeLogger,
} = require('./utils');

const logHttp = makeLogger('worker:http');
const logSp = makeLogger('worker:sparql');
const logTech = makeLogger('worker:techstack');
const logAnalyzer = makeLogger('worker:analyzer');


// === HTTP Requests worker ===
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
        return { status, count: list.length, payload };
      }
      case 'http-resolver': {
         const { list } = job.data || {};
          if (!list || !Array.isArray(list))
            throw new Error('Missing or invalid requests list');

          logHttp.info(`http-resolver start (count=${list.length})`);

          const result = await analyzeHttpRequests(list);

          logHttp.info('http-resolver completed', {
            totalFindings: result.totalFindings,
            stats: result.stats,
          });

          return { result };
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
  logHttp.info(`completed job=${job.name} id=${job.id}`, job.name === "http-ingest" ? { status: result.status, count: result.count } : {
    ok: result.result.ok, 
    totalFindings: result.result.totalFindings, 
    stats: result.result.stats
  });
});
workerHttpRequests.on('failed', (job, err) => {
  logHttp.warn(`failed job=${job?.name} id=${job?.id}`, err?.message || err);
});
workerHttpRequests.on('error', (err) => {
  logHttp.warn('worker error', err?.message || err);
});

// === SPARQL UPDATE worker ===
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

// === Techstack analysis worker ===
const workerTechstack = new Worker(
  queueNameTechstackWrites,
  async (job) => {
    switch (job.name) {
      case 'techstack-analyze': {
        const { technologies, waf, secureHeaders, cookies } = job.data || {};
        if (!technologies || !Array.isArray(technologies)) {
          throw new Error('Invalid technologies payload');
        }

        const result = await resolveTechstack({ technologies, waf, secureHeaders, cookies });
        return { result };
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
      technologies: result.result.technologies.length,
      waf: result.result.waf.length,
      secureHeaders: result.result.secureHeaders.length,
      cookies: result.result.cookies.length,
    },
  });
});
workerTechstack.on('failed', (job, err) => {
  logTech.warn(`failed job=${job?.name} id=${job?.id}`, err?.message || err);
});
workerTechstack.on('error', (err) => {
  logTech.warn('worker error', err?.message || err);
});

// === Analyzer (SAST) worker ===
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

      return { result };
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
    ok: result.result.ok, 
    totalFindings: result.result.totalFindings, 
    stats: result.result.stats
  });
});
workerAnalyzer.on('failed', (job, err) => {
  logAnalyzer.warn(`failed job=${job?.name} id=${job?.id}`, err?.message || err);
});
workerAnalyzer.on('error', (err) => {
  logAnalyzer.warn('worker error', err?.message || err);
});

// Monitors
startRedisMonitor(connection, 'redis:worker');
startGraphDBHealthProbe(runSelect, 'graphdb:worker');