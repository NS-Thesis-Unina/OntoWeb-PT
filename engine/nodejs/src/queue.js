const { Queue } = require('bullmq');
const { makeLogger } = require('./utils');

const logQ = makeLogger('bull');
const logR = makeLogger('redis');

/**
 * Shared Redis connection configuration used by all BullMQ queues.
 *
 * - host / port default to localhost:6379
 * - enableReadyCheck ensures we wait for Redis to be ready before operating
 * - retryStrategy implements exponential backoff with a capped delay
 *
 * The retry strategy can optionally be silenced via QUIET_REDIS_ERRORS=1.
 */
const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  enableReadyCheck: true,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    const delay = Math.min(1000 * Math.pow(2, times), 30000);
    const quiet = process.env.QUIET_REDIS_ERRORS === '1';
    if (!quiet) {
      logR.warn(`retrying redis connection in ${delay}ms (attempt ${times})`);
    }
    return delay;
  },
};

/* ========================================================================
 * Queue names (configurable)
 * ====================================================================== */

const queueNameHttpRequestsWrites =
  process.env.QUEUE_NAME_HTTP_REQUESTS_WRITES || 'http-requests-writes';
const queueNameSparqlWrites = process.env.QUEUE_NAME_SPARQL_WRITES || 'sparql-writes';
const queueNameTechstackWrites = process.env.QUEUE_NAME_TECHSTACK_WRITES || 'techstack-analyze';
const queueNameAnalyzerWrites = process.env.QUEUE_NAME_ANALYZER_WRITES || 'analyzer-writes';

/* ========================================================================
 * HTTP Requests queue
 * ====================================================================== */

/**
 * Queue for:
 * - HTTP ingestion jobs
 * - HTTP analysis jobs
 *
 * Default job options:
 * - retries: 5
 * - exponential backoff (2s base delay)
 * - bounded history for completed/failed jobs
 */
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

/* ========================================================================
 * SPARQL queue
 * ====================================================================== */

/**
 * Queue for generic SPARQL UPDATE jobs.
 *
 * Configurable via:
 * - JOB_SPARQL_ATTEMPTS
 * - JOB_SPARQL_BACKOFF_TYPE
 * - JOB_SPARQL_DELAY
 * - JOB_SPARQL_ON_COMPLETE
 * - JOB_SPARQL_REMOVE_ON_FAIL
 */
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

/* ========================================================================
 * Techstack queue
 * ====================================================================== */

/**
 * Queue for technology stack analysis jobs.
 *
 * Typically triggered after passive fingerprinting or external scans.
 */
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

/* ========================================================================
 * Analyzer queue
 * ====================================================================== */

/**
 * Queue for SAST / analyzer jobs.
 *
 * These jobs are usually CPU-intensive and may have a different retry policy
 * compared to simple SPARQL or ingestion tasks.
 */
const queueAnalyzer = new Queue(queueNameAnalyzerWrites, {
  connection,
  defaultJobOptions: {
    attempts: Number(process.env.JOB_ANALYZER_ATTEMPTS) || 3,
    backoff: {
      type: process.env.JOB_ANALYZER_BACKOFF_TYPE || 'exponential',
      delay: Number(process.env.JOB_ANALYZER_BACKOFF_DELAY) || 2000,
    },
    removeOnComplete: Number(process.env.JOB_ANALYZER_REMOVE_ON_COMPLETE) || 300,
    removeOnFail: Number(process.env.JOB_ANALYZER_REMOVE_ON_FAIL) || 800,
  },
});

/* ========================================================================
 * Shared error handling for queues
 * ====================================================================== */

/**
 * Suppress noisy connection errors when QUIET_REDIS_ERRORS=1 and log only
 * meaningful failures. This keeps BullMQ logs readable in unstable networks.
 */
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
    ) {
      return;
    }
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
