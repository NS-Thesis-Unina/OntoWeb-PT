const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const sparqlRoutes = require('./routes/sparql');
const httpRequestRoutes = require('./routes/httpRequests');

const app = express();

// Basic middlewares: CORS, JSON body limit, logging.
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// Liveness check.
app.get('/health', (req, res) => res.json({ ok: true }));

// Route mounting.
app.use('/sparql', sparqlRoutes);
app.use('/http-requests', httpRequestRoutes);

const PORT = Number(process.env.SERVER_PORT || 8081);

// Start the HTTP server.
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
