const { Queue } = require('bullmq');
const { makeLogger } = require('./utils');
const logQ = makeLogger('bull');
const logR = makeLogger('redis');

// Shared Redis connection
const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  enableReadyCheck: true,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    const delay = Math.min(1000 * Math.pow(2, times), 30000);
    const quiet = process.env.QUIET_REDIS_ERRORS === '1';
    if (!quiet) logR.warn(`retrying redis connection in ${delay}ms (attempt ${times})`);
    return delay;
  },
};

// === Queue names ===
const queueNameHttpRequestsWrites =
  process.env.QUEUE_NAME_HTTP_REQUESTS_WRITES || 'http-requests-writes';
const queueNameSparqlWrites =
  process.env.QUEUE_NAME_SPARQL_WRITES || 'sparql-writes';
const queueNameTechstackWrites =
  process.env.QUEUE_NAME_TECHSTACK_WRITES || 'techstack-analyze';
const queueNameAnalyzerWrites = 
  process.env.QUEUE_NAME_ANALYZER_WRITES || 'analyzer-writes';


// === HTTP Requests queue ===
const queueHttpRequests = new Queue(queueNameHttpRequestsWrites, {
  connection,
  defaultJobOptions: {
    attempts: Number(process.env.JOB_HTTP_REQUESTS_ATTEMPTS) || 5,
    backoff: {
      type: process.env.JOB_HTTP_REQUESTS_BACKOFF_TYPE || 'exponential',
      delay: Number(process.env.JOB_HTTP_REQUESTS_BACKOFF_DELAY) || 2000,
    },
    removeOnComplete: Number(process.env.JOB_HTTP_REQUESTS_REMOVE_ON_COMPLETE) || 500,
    removeOnFail: Number(process.env.JOB_HTTP_REQUESTS_REMOVE_ON_FAIL) || 1000,
  },
});

// === SPARQL queue ===
const queueSparql = new Queue(queueNameSparqlWrites, {
  connection,
  defaultJobOptions: {
    attempts: Number(process.env.JOB_SPARQL_ATTEMPTS) || 5,
    backoff: {
      type: process.env.JOB_SPARQL_BACKOFF_TYPE || 'exponential',
      delay: Number(process.env.JOB_SPARQL_DELAY) || 2000,
    },
    removeOnComplete: Number(process.env.JOB_SPARQL_ON_COMPLETE) || 500,
    removeOnFail: Number(process.env.JOB_SPARQL_REMOVE_ON_FAIL) || 1000,
  },
});

// === TECHSTACK queue ===
const queueTechstack = new Queue(queueNameTechstackWrites, {
  connection,
  defaultJobOptions: {
    attempts: Number(process.env.JOB_TECHSTACK_ATTEMPTS) || 3,
    backoff: {
      type: process.env.JOB_TECHSTACK_BACKOFF_TYPE || 'exponential',
      delay: Number(process.env.JOB_TECHSTACK_BACKOFF_DELAY) || 2000,
    },
    removeOnComplete: Number(process.env.JOB_TECHSTACK_REMOVE_ON_COMPLETE) || 300,
    removeOnFail: Number(process.env.JOB_TECHSTACK_REMOVE_ON_FAIL) || 800,
  },
});

// === ANALYZER queue ===
const queueAnalyzer = new Queue(queueNameAnalyzerWrites, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 300,
    removeOnFail: 800,
  },
});

// Suppress noisy connection errors
for (const [q, name] of [
  [queueHttpRequests, queueNameHttpRequestsWrites],
  [queueSparql, queueNameSparqlWrites],
  [queueTechstack, queueNameTechstackWrites],
  [queueAnalyzer, queueNameAnalyzerWrites],
]) {
  q.on('error', (err) => {
    if (
      process.env.QUIET_REDIS_ERRORS === '1' &&
      /ECONNREFUSED|getaddrinfo|ETIMEDOUT/i.test(String(err?.message))
    ) return;
    logQ.warn(`[${name}] error`, err?.message || err);
  });
}

module.exports = {
  queueHttpRequests,
  queueSparql,
  queueTechstack, 
  queueAnalyzer,
  connection,
  queueNameHttpRequestsWrites,
  queueNameSparqlWrites,
  queueNameTechstackWrites,
  queueNameAnalyzerWrites,
};
