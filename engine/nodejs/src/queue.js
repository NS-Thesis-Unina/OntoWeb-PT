const { Queue } = require('bullmq');

// Single connection object is shared by producers and workers.
const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379)
};

const queueNameHttpRequestsWrites = process.env.QUEUE_NAME_HTTP_REQUESTS_WRITES || 'http-requests-writes';
const queueNameSparqlWrites = process.env.QUEUE_NAME_SPARQL_WRITES || 'sparql-writes';

// Producer for HTTP Request write jobs.
const queueHttpRequests = new Queue(queueNameHttpRequestsWrites, {
  connection,
  defaultJobOptions: {
    attempts: Number(process.env.JOB_HTTP_REQUESTS_ATTEMPTS) || 5,
    backoff: {
      type: process.env.JOB_HTTP_REQUESTS_BACKOFF_TYPE || 'exponential',
      delay: Number(process.env.JOB_HTTP_REQUESTS_BACKOFF_DELAY) || 2000
    },
    removeOnComplete: Number(process.env.JOB_HTTP_REQUESTS_REMOVE_ON_COMPLETE) || 500,
    removeOnFail: Number(process.env.JOB_HTTP_REQUESTS_REMOVE_ON_FAIL) || 1000
  }
});

// Producer for SPARQL UPDATE jobs.
const queueSparql = new Queue(queueNameSparqlWrites, {
  connection,
  defaultJobOptions: {
    attempts: Number(process.env.JOB_SPARQL_ATTEMPTS) || 5,
    backoff: {
      type: process.env.JOB_SPARQL_BACKOFF_TYPE || 'exponential',
      delay: Number(process.env.JOB_SPARQL_DELAY) || 2000
    },
    removeOnComplete: Number(process.env.JOB_SPARQL_ON_COMPLETE) || 500,
    removeOnFail: Number(process.env.JOB_SPARQL_REMOVE_ON_FAIL) || 1000
  }
});

module.exports = {
  queueHttpRequests,
  queueSparql,
  connection,
  queueNameHttpRequestsWrites,
  queueNameSparqlWrites
};
