const { Server } = require('socket.io');
const { QueueEvents } = require('bullmq');
const {
  connection,
  queueNameHttpRequestsWrites,
  queueNameSparqlWrites,
  queueNameTechstackWrites,
  queueNameAnalyzerWrites,
} = require('./queue');

const { makeLogger, onLog } = require('./utils');

/**
 * Attach Socket.IO to the provided HTTP server instance.
 *
 * Responsibilities:
 * - Provide a /logs namespace to stream logs in real time to dashboard clients.
 * - Provide a default namespace to subscribe to BullMQ job events by jobId.
 * - Forward API process logs to all /logs subscribers.
 *
 * @param {import('http').Server} httpServer
 * @returns {Promise<import('socket.io').Server>}
 */
module.exports = async function attachSockets(httpServer) {
  const log = makeLogger('ws');

  const io = new Server(httpServer, {
    cors: { origin: process.env.SOCKETS_CORS_ORIGIN || '*' },
  });

  /* ======================================================================
   * /logs namespace: real-time log streaming
   * ==================================================================== */

  const logsNsp = io.of('/logs');

  logsNsp.on('connection', (socket) => {
    log.info('logs client connected', { sid: socket.id });

    /**
     * When any client (e.g. a worker) pushes a log entry to this namespace,
     * broadcast it to all connected /logs clients.
     */
    socket.on('log', (entry) => {
      logsNsp.emit('log', entry);
    });

    socket.on('disconnect', () => {
      log.info('logs client disconnected', { sid: socket.id });
    });
  });

  /**
   * Forward logs produced by the API process itself to the /logs namespace.
   *
   * The workers connect to /logs as Socket.IO clients, so the dashboard
   * receives a unified stream: API logs + worker logs.
   */
  onLog((entry) => {
    logsNsp.emit('log', entry);
  });

  /* ======================================================================
   * Default namespace: job events fan-out
   * ==================================================================== */

  const qHttp = new QueueEvents(queueNameHttpRequestsWrites, { connection });
  const qSp = new QueueEvents(queueNameSparqlWrites, { connection });
  const qTech = new QueueEvents(queueNameTechstackWrites, { connection });
  const qAnaly = new QueueEvents(queueNameAnalyzerWrites, { connection });

  /**
   * Wait until all QueueEvents instances are connected and ready before
   * serving job events to clients.
   */
  await Promise.all([
    qHttp.waitUntilReady(),
    qSp.waitUntilReady(),
    qTech.waitUntilReady(),
    qAnaly.waitUntilReady(),
  ]);
  log.info('QueueEvents ready');

  /**
   * Default namespace connection: used by clients to subscribe to job events
   * by a logical room "job:<jobId>".
   */
  io.on('connection', (socket) => {
    log.info('client connected', { sid: socket.id });

    /**
     * Subscribe the client to a given BullMQ job room.
     * The dashboard typically uses this to track the lifecycle of a job.
     */
    socket.on('subscribe-job', (jobId) => {
      if (!jobId) return;
      socket.join(`job:${jobId}`);
      log.debug('subscribed', { sid: socket.id, jobId });
    });

    socket.on('unsubscribe-job', (jobId) => {
      if (!jobId) return;
      socket.leave(`job:${jobId}`);
      log.debug('unsubscribed', { sid: socket.id, jobId });
    });

    socket.on('disconnect', () => log.info('client disconnected', { sid: socket.id }));
  });

  /**
   * Helper to forward BullMQ events for a specific queue.
   *
   * Each event is emitted to room "job:<jobId>" with:
   * - queue: logical queue identifier
   * - all BullMQ event payload fields
   */
  const forward = (queue) => (evt, payload) => {
    const { jobId } = payload || {};
    if (!jobId) return;
    io.to(`job:${jobId}`).emit(evt, { queue, ...payload });
  };

  const fHttp = forward('http');
  const fSp = forward('sparql');
  const fTech = forward('techstack');
  const fAnaly = forward('analyzer');

  // Forward "completed" events
  qHttp.on('completed', (p) => fHttp('completed', p));
  qSp.on('completed', (p) => fSp('completed', p));
  qTech.on('completed', (p) => fTech('completed', p));
  qAnaly.on('completed', (p) => fAnaly('completed', p));

  // Forward "failed" events
  qHttp.on('failed', (p) => fHttp('failed', p));
  qSp.on('failed', (p) => fSp('failed', p));
  qTech.on('failed', (p) => fTech('failed', p));
  qAnaly.on('failed', (p) => fAnaly('failed', p));

  /**
   * Log queue-level errors.
   *
   * These usually indicate connectivity issues with Redis or internal
   * BullMQ problems; they do not carry a jobId.
   */
  [qHttp, qSp, qTech, qAnaly].forEach((qe) =>
    qe.on('error', (err) => log.warn('QueueEvents error', err?.message || err))
  );

  return io;
};
