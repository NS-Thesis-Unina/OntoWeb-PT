const { Server } = require('socket.io');
const { QueueEvents } = require('bullmq');
const {
  connection,
  queueNameHttpRequestsWrites,
  queueNameSparqlWrites,
  queueNameTechstackWrites,
  queueNameAnalyzerWrites
} = require('./queue');
const { makeLogger } = require('./utils');

module.exports = async function attachSockets(httpServer) {
  const log = makeLogger('ws');

  const io = new Server(httpServer, {
    cors: { origin: process.env.SOCKETS_CORS_ORIGIN || '*' },
  });

  const qHttp = new QueueEvents(queueNameHttpRequestsWrites, { connection });
  const qSp = new QueueEvents(queueNameSparqlWrites, { connection });
  const qTech = new QueueEvents(queueNameTechstackWrites, { connection }); 
  const qAnaly = new QueueEvents(queueNameAnalyzerWrites, { connection }); 

  await Promise.all([qHttp.waitUntilReady(), qSp.waitUntilReady(), qTech.waitUntilReady(), qAnaly.waitUntilReady()]);
  log.info('QueueEvents ready');

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

  // Fan-out helper
  const forward = (queue) => (evt, payload) => {
    const { jobId } = payload || {};
    if (!jobId) return;
    io.to(`job:${jobId}`).emit(evt, { queue, ...payload });
  };

  const fHttp = forward('http');
  const fSp = forward('sparql');
  const fTech = forward('techstack');
  const fAnaly = forward('analyzer');

  // Event forwarding
  qHttp.on('completed', (p) => fHttp('completed', p));
  qSp.on('completed', (p) => fSp('completed', p));
  qTech.on('completed', (p) => fTech('completed', p));
  qAnaly.on('completed', (p) => fAnaly('completed', p));

  qHttp.on('failed', (p) => fHttp('failed', p));
  qSp.on('failed', (p) => fSp('failed', p));
  qTech.on('failed', (p) => fTech('failed', p)); 
  qAnaly.on('failed', (p) => fAnaly('failed', p));

  [qHttp, qSp, qTech, qAnaly].forEach((qe) =>
    qe.on('error', (err) => log.warn('QueueEvents error', err?.message || err))
  );

  return io;
};
