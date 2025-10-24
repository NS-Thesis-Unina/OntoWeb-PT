const { Queue } = require('bullmq');
const { makeLogger } = require('./utils');
const logQ = makeLogger('bull');
const logR = makeLogger('redis');

// Shared Redis connection for producers/workers.
// Exponential backoff and optional quiet mode to avoid noisy ECONNREFUSED spam.
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

const queueNameHttpRequestsWrites =
  process.env.QUEUE_NAME_HTTP_REQUESTS_WRITES || 'http-requests-writes';
const queueNameSparqlWrites =
  process.env.QUEUE_NAME_SPARQL_WRITES || 'sparql-writes';

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

// Suppress common connection noise when QUIET_REDIS_ERRORS=1
queueHttpRequests.on('error', (err) => {
  if (
    process.env.QUIET_REDIS_ERRORS === '1' &&
    /ECONNREFUSED|getaddrinfo|ETIMEDOUT/i.test(String(err?.message))
  ) return;
  logQ.warn(`[${queueNameHttpRequestsWrites}] error`, err?.message || err);
});

queueSparql.on('error', (err) => {
  if (
    process.env.QUIET_REDIS_ERRORS === '1' &&
    /ECONNREFUSED|getaddrinfo|ETIMEDOUT/i.test(String(err?.message))
  ) return;
  logQ.warn(`[${queueNameSparqlWrites}] error`, err?.message || err);
});

module.exports = {
  queueHttpRequests,
  queueSparql,
  connection,
  queueNameHttpRequestsWrites,
  queueNameSparqlWrites,
};
