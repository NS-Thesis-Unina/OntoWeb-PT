const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const { makeLogger } = require('./utils');
const log = makeLogger('api');

const sparqlRoutes = require('./routes/sparql');
const httpRequestRoutes = require('./routes/httpRequests');

const app = express();

// Core middlewares
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Simple liveness endpoint
app.get('/health', (_req, res) => res.json({ ok: true }));

// Route mounting
app.use('/sparql', sparqlRoutes);
app.use('/http-requests', httpRequestRoutes);

// Start HTTP server
const PORT = Number(process.env.SERVER_PORT || 8081);
app.listen(PORT, () => {
  log.info(`API listening on http://localhost:${PORT}`);
});

// Process-level hardening: log unhandled errors and keep a single exit point upstream (PM2/systemd)
process.on('unhandledRejection', (reason) => {
  log.error('UnhandledRejection', reason instanceof Error ? reason : String(reason));
});
process.on('uncaughtException', (err) => {
  log.error('UncaughtException', err);
});
