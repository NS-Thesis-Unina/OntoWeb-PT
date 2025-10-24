// sockets.js
const { Server } = require('socket.io');
const { QueueEvents } = require('bullmq');
const { connection, queueNameHttpRequestsWrites, queueNameSparqlWrites } = require('./queue');
const { makeLogger } = require('./utils');

module.exports = async function attachSockets(httpServer) {
  const log = makeLogger('ws');

  const io = new Server(httpServer, {
    cors: { origin: process.env.SOCKETS_CORS_ORIGIN || '*' }
  });

  // QueueEvents: listen for BullMQ events (one per queue, shared among all clients)
  const qHttp = new QueueEvents(queueNameHttpRequestsWrites, { connection });
  const qSp   = new QueueEvents(queueNameSparqlWrites,        { connection });

  await Promise.all([qHttp.waitUntilReady(), qSp.waitUntilReady()]);
  log.info('QueueEvents ready');

  // Handle client connections
  io.on('connection', (socket) => {
    log.info('client connected', { sid: socket.id });

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

  // Fan-out: broadcast BullMQ events to the corresponding jobId room
  const forward = (queue) => (evt, payload) => {
    const { jobId } = payload || {};
    if (!jobId) return;
    io.to(`job:${jobId}`).emit(evt, { queue, ...payload });
  };

  const fHttp = forward('http');
  const fSp   = forward('sparql');

  // Forward BullMQ events for HTTP jobs
  qHttp.on('progress',  (p) => fHttp('progress',  p));
  qHttp.on('completed', (p) => fHttp('completed', p));
  qHttp.on('failed',    (p) => fHttp('failed',    p));

  // Forward BullMQ events for SPARQL jobs
  qSp.on('progress',    (p) => fSp('progress',    p));
  qSp.on('completed',   (p) => fSp('completed',   p));
  qSp.on('failed',      (p) => fSp('failed',      p));

  // Log any QueueEvents-related errors
  [qHttp, qSp].forEach((qe) =>
    qe.on('error', (err) => log.warn('QueueEvents error', err?.message || err))
  );

  return io;
};
