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
  findingBuilders: {
    buildInsertFromFindingsArray,
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

        // Persist HTTP findings into the findings graph
        let insertStatus = null;
        try {
          if (result && Array.isArray(result.findings) && result.findings.length > 0) {
            const findingsForInsert = result.findings.map((f) => ({
              ...f,
              // garantisco che la sorgente sia sempre presente
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
          logHttp.warn(
            'Failed to insert HTTP findings into GraphDB',
            err?.message || err
          );
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
    stalledInterval:
      Number(process.env.STALLED_INTERVAL_WORKER_HTTP_REQUESTS) || 30000,
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
        const { technologies, waf, secureHeaders, cookies, mainDomain } =
          job.data || {};
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
          logTech.warn(
            'Failed to insert Techstack findings into GraphDB',
            err?.message || err
          );
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
    stalledInterval:
      Number(process.env.STALLED_INTERVAL_WORKER_TECHSTACK) || 30000,
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


// === Analyzer (SAST) worker ===
const workerAnalyzer = new Worker(
  queueNameAnalyzerWrites,
  async (job) => {
    if (job.name === 'sast-analyze') {
      const { url, html, scripts, forms, iframes, includeSnippets } =
        job.data || {};

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
        logAnalyzer.warn(
          'Failed to insert Analyzer findings into GraphDB',
          err?.message || err
        );
      }

      return { result, insertStatus };
    }
    throw new Error(`Unknown job: ${job.name}`);
  },
  {
    connection,
    concurrency: Number(process.env.CONCURRENCY_WORKER_ANALYZER) || 2,
    stalledInterval:
      Number(process.env.STALLED_INTERVAL_WORKER_ANALYZER) || 30000,
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

// Monitors
startRedisMonitor(connection, 'redis:worker');
startGraphDBHealthProbe(runSelect, 'graphdb:worker');