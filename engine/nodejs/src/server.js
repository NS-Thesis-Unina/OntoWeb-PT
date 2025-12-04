const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
require('dotenv').config();

const { errors: celebrateErrors } = require('celebrate');

const attachSockets = require('./sockets');

const {
  makeLogger,
  monitors: { startRedisMonitor, startGraphDBHealthProbe, setState, getHealth },
  graphdb: { runSelect },
} = require('./utils');

const sparqlRoutes = require('./routes/sparql');
const httpRequestRoutes = require('./routes/httpRequests');
const techStackRoutes = require('./routes/techstack');
const analyzerRoutes = require('./routes/analyzer');
const pcapRoutes = require('./routes/pcap');

const { connection } = require('./queue');

const log = makeLogger('api');
const app = express();

/**
 * Core middlewares
 * - CORS: allow cross-origin requests (origin configurable via the reverse proxy)
 * - JSON body parsing: accept JSON payloads up to 15 MB
 */
app.use(cors());
app.use(express.json({ limit: '15mb' }));

/**
 * Health endpoint (readiness)
 *
 * Returns 200 only when:
 * - the API process is marked as "up" in the health registry
 * - Redis and GraphDB monitors are reporting healthy states
 *
 * Otherwise returns 503 so that orchestrators/load balancers can avoid routing
 * traffic to this instance.
 */
app.get('/health', (_req, res) => {
  const h = getHealth();
  res.set('Cache-Control', 'no-store');
  res.status(h.ok ? 200 : 503).json(h);
});

/**
 * API route mounting
 *
 * Each router encapsulates its own validation, controller logic and error handling.
 * Paths are grouped by domain:
 * - /sparql         → direct SPARQL queries against GraphDB
 * - /http-requests  → HTTP traffic ingestion, search and analysis
 * - /techstack      → technology fingerprinting and related findings
 * - /analyzer       → SAST / DOM / HTML analysis
 * - /pcap           → PCAP upload and HTTP extraction workflows
 */
app.use('/sparql', sparqlRoutes);
app.use('/http-requests', httpRequestRoutes);
app.use('/techstack', techStackRoutes);
app.use('/analyzer', analyzerRoutes);
app.use('/pcap', pcapRoutes);

// Serve Dashboard
app.use(express.static(path.join(__dirname, 'dashboard')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard', 'index.html'));
});

/**
 * Celebrate validation error handler
 *
 * Converts schema validation errors into a clean 400 response with a consistent
 * structure. Must be registered after all routes.
 */
app.use(celebrateErrors());

/**
 * WebSocket server attachment
 *
 * The Socket.IO server is mounted on the same HTTP server instance so that:
 * - job progress can be streamed to clients in real time
 * - logs can be forwarded to the dashboard via the /logs namespace
 */
const server = http.createServer(app);
attachSockets(server).catch((err) => log.error('attachSockets failed', err?.message || err));

/**
 * HTTP server bootstrap
 *
 * PORT and HOST can be configured via environment variables:
 * - SERVER_PORT (default: 8081)
 * - SERVER_HOST (default: localhost)
 */
const PORT = Number(process.env.SERVER_PORT || 8081);
const HOST = process.env.SERVER_HOST || 'localhost';

server.listen(PORT, () => {
  log.info(`API listening on http://${HOST}:${PORT}`);
  // Explicitly mark the server as up in the health registry once listening.
  setState('server', 'up');
});

/**
 * Health monitors (API process)
 *
 * These probes periodically update the shared health registry with the status
 * of Redis and GraphDB so the /health endpoint can reflect their state.
 */
startRedisMonitor(connection, 'redis:api', (st) => {
  /**
   * Map Redis states into the health registry domain.
   *
   * - "up"        → ready
   * - "down"      → not ready
   * - otherwise   → "connecting" (not ready but we keep the detailed state
   *                 for observability)
   */
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

/**
 * Process-level hardening
 *
 * These handlers ensure that unexpected failures are at least logged once,
 * and that a controlled shutdown is attempted when possible.
 */
process.on('unhandledRejection', (reason) => {
  log.error('UnhandledRejection', reason instanceof Error ? reason : String(reason));
});

process.on('uncaughtException', (err) => {
  log.error('UncaughtException', err);
});

process.on('SIGTERM', () => {
  log.info('Shutting down...');
  setState('server', 'shutting_down');
  // Note: in a more advanced setup, we could implement a graceful shutdown
  // (close server, wait for in-flight requests, etc.) before exiting.
  process.exit(0);
});
