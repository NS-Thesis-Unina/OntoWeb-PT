// @ts-check

const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

const { errors: celebrateErrors } = require('celebrate');

const attachSockets = require('./sockets');

const {
  makeLogger,
  monitors: {
    startRedisMonitor,
    startGraphDBHealthProbe,
    setState,
    getHealth
  },
  graphdb: {
    runSelect
  }
} = require('./utils');

const sparqlRoutes = require('./routes/sparql');
const httpRequestRoutes = require('./routes/httpRequests');
const techStackRoutes = require('./routes/techstack');
const analyzerRoutes = require('./routes/analyzer');
const pcapRoutes = require('./routes/pcap');

const { connection } = require('./queue');

const log = makeLogger('api');
const app = express();

// Core middlewares
app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Health endpoint (readiness): 200 only if server, GraphDB and Redis are UP; otherwise 503.
app.get('/health', (_req, res) => {
  const h = getHealth();
  res.set('Cache-Control', 'no-store');
  res.status(h.ok ? 200 : 503).json(h);
});

// Route mounting
app.use('/sparql', sparqlRoutes);
app.use('/http-requests', httpRequestRoutes);
app.use('/techstack', techStackRoutes); 
app.use('/analyzer', analyzerRoutes);
app.use('/pcap', pcapRoutes);


// Celebrate validation error handler (returns 400 with clean details)
app.use(celebrateErrors());

// Attach Sockets
const server = http.createServer(app);
attachSockets(server).catch((err) => log.error('attachSockets failed', err?.message || err));

// Start HTTP server
const PORT = Number(process.env.SERVER_PORT || 8081);
const HOST = process.env.SERVER_HOST || "localhost";
server.listen(PORT, () => {
  log.info(`API listening on http://${HOST}:${PORT}`);
  // Explicitly mark server as up in the health registry
  setState('server', 'up');
});

// Health monitors (API) - report component states to the health registry
startRedisMonitor(connection, 'redis:api', (st) => {
  // Map redis states to the registry domain
  // 'connecting' is considered not-ready for readiness purposes,
  // but we keep the exact state for visibility.
  if (st === 'up') setState('redis', 'up');
  else if (st === 'down') setState('redis', 'down');
  else setState('redis', 'connecting');
});

startGraphDBHealthProbe(
  runSelect,
  'graphdb:api',
  Number(process.env.GRAPHDB_HEALTH_INTERVAL_MS || 5000),
  (st) => setState('graphdb', st)
);

// Process-level hardening
process.on('unhandledRejection', (reason) => {
  log.error('UnhandledRejection', reason instanceof Error ? reason : String(reason));
});
process.on('uncaughtException', (err) => {
  log.error('UncaughtException', err);
});
process.on('SIGTERM', () => {
  log.info('Shutting down...');
  setState('server', 'shutting_down');
  process.exit(0);
});
