const axios = require('axios');

const GRAPHDB_BASE = process.env.GRAPHDB_BASE;
const GRAPHDB_REPO = process.env.GRAPHDB_REPO;

// Syncronous SELECT/ASK
async function runSelect(sparql) {
  const url = `${GRAPHDB_BASE}/repositories/${encodeURIComponent(GRAPHDB_REPO)}`;
  const res = await axios.post(url, `query=${encodeURIComponent(sparql)}`, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/sparql-results+json'
    },
    timeout: 30000
  });
  return res.data;
}

// Asyncronous UPDATE (INSERT/DELETE/LOAD...)
async function runUpdate(sparqlUpdate) {
  const url = `${GRAPHDB_BASE}/repositories/${encodeURIComponent(GRAPHDB_REPO)}/statements`;
  const res = await axios.post(url, sparqlUpdate, {
    headers: { 'Content-Type': 'application/sparql-update' },
    timeout: 60000
  });
  return res.status;
}

module.exports = { runSelect, runUpdate };
