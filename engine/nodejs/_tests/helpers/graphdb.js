// @ts-check

const { postGraphDBSelect } = require('./http');

/**
 * Base IRI for the ontology prefix `ex:` used in tests.
 * Overridable via env TEST_ONTO_EX.
 * @type {string}
 */
const ONT_EX =
  process.env.TEST_ONTO_EX ||
  'http://www.semanticweb.org/nda/ontologies/2025/8/untitled-ontology-18#';

/**
 * Build an ASK query that checks whether a Request with `ex:id` equals the given literal
 * exists in any named graph.
 * @param {string} idLiteral Raw request id (will be escaped as SPARQL string).
 * @returns {string} SPARQL ASK query string.
 */
function buildAskByRequestId(idLiteral) {
  return `
    PREFIX ex: <${ONT_EX}>
    ASK {
      GRAPH ?g {
        ?req a ex:Request ;
             ex:id ${sparqlStr(idLiteral)} .
      }
    }
  `;
}

/**
 * Build a SELECT query for a Request by `ex:id`, returning basic details.
 * @param {string} idLiteral Raw request id (will be escaped as SPARQL string).
 * @returns {string} SPARQL SELECT query string.
 */
function buildSelectByRequestId(idLiteral) {
  return `
    PREFIX ex: <${ONT_EX}>
    SELECT ?g ?req ?methodName ?scheme ?authority ?path ?statusCode WHERE {
      GRAPH ?g {
        ?req a ex:Request ;
             ex:id ${sparqlStr(idLiteral)} ;
             ex:mthd ?m .
        OPTIONAL { ?m ex:methodName ?methodName }
        OPTIONAL {
          ?req ex:uriRequest ?u .
          OPTIONAL { ?u ex:scheme ?scheme }
          OPTIONAL { ?u ex:authority ?authority }
          OPTIONAL { ?u ex:path ?path }
        }
        OPTIONAL {
          ?req ex:resp ?resp .
          OPTIONAL {
            ?resp ex:sc ?sc .
            OPTIONAL { ?sc ex:statusCodeNumber ?statusCode }
          }
        }
      }
    } LIMIT 10
  `;
}

/**
 * Escape a raw JS string into a SPARQL string literal (double-quoted).
 * Minimal escaping for quotes and backslashes.
 * @param {string} s Raw string.
 * @returns {string} Escaped SPARQL literal, wrapped in double quotes.
 */
function sparqlStr(s) {
  return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Run an ASK over all graphs to check if a Request with the given id exists.
 * @param {string} id Request id.
 * @returns {Promise<boolean>} True if it exists, false otherwise.
 */
async function askRequestExists(id) {
  const ask = buildAskByRequestId(id);
  const res = await postGraphDBSelect(ask);
  if (res.status !== 200) return false;
  /** @type {{ boolean?: boolean }} */
  const body = res.data || {};
  return Boolean(body.boolean);
}

/**
 * Run the SELECT-by-id and return the SPARQL JSON payload as-is.
 * @param {string} id Request id.
 * @returns {Promise<import('./_types').SparqlSelectResult|null>} SPARQL JSON or null on non-200.
 */
async function selectRequestInfo(id) {
  const q = buildSelectByRequestId(id);
  const res = await postGraphDBSelect(q);
  if (res.status !== 200) return null;
  return /* @type {import('./_types').SparqlSelectResult} */ (res.data);
}

/**
 * Build an ASK query restricted to a specific named graph.
 * @param {string} graphIri Named graph IRI.
 * @param {string} idLiteral Raw request id.
 * @returns {string} SPARQL ASK query string.
 */
function buildAskByRequestIdInGraph(graphIri, idLiteral) {
  return `
    PREFIX ex: <${ONT_EX}>
    ASK {
      GRAPH <${graphIri}> {
        ?req a ex:Request ;
             ex:id ${sparqlStr(idLiteral)} .
      }
    }
  `;
}

/**
 * Check existence of a Request(id) in a specific named graph.
 * @param {string} graphIri Named graph IRI.
 * @param {string} id Request id.
 * @returns {Promise<boolean>} True if it exists in the graph.
 */
async function askRequestExistsInGraph(graphIri, id) {
  const ask = buildAskByRequestIdInGraph(graphIri, id);
  const res = await postGraphDBSelect(ask);
  if (res.status !== 200) return false;
  /** @type {{ boolean?: boolean }} */
  const body = res.data || {};
  return Boolean(body.boolean);
}

/**
 * Build a SELECT that counts distinct `ex:Request` with the given id in a graph.
 * @param {string} graphIri Named graph IRI.
 * @param {string} idLiteral Raw request id.
 * @returns {string} SPARQL SELECT query string.
 */
function buildCountRequestsInGraphById(graphIri, idLiteral) {
  return `
    PREFIX ex: <${ONT_EX}>
    SELECT (COUNT(DISTINCT ?req) AS ?n)
    WHERE {
      GRAPH <${graphIri}> {
        ?req a ex:Request ; ex:id ${sparqlStr(idLiteral)} .
      }
    }
  `;
}

/**
 * Build a SELECT that returns distinct status code numbers for a Request(id) in a graph.
 * @param {string} graphIri Named graph IRI.
 * @param {string} idLiteral Raw request id.
 * @returns {string} SPARQL SELECT query string.
 */
function buildSelectStatusCodesInGraphById(graphIri, idLiteral) {
  return `
    PREFIX ex: <${ONT_EX}>
    SELECT DISTINCT ?code
    WHERE {
      GRAPH <${graphIri}> {
        ?req a ex:Request ; ex:id ${sparqlStr(idLiteral)} .
        OPTIONAL {
          ?req ex:resp ?resp .
          OPTIONAL {
            ?resp ex:sc ?sc .
            OPTIONAL { ?sc ex:statusCodeNumber ?code }
          }
        }
      }
    }
  `;
}

/**
 * Build a SELECT that counts distinct headers linked to a Request(id) in a graph.
 * Counts any of: ex:reqHeader | ex:payHeader | ex:repHeader.
 * @param {string} graphIri Named graph IRI.
 * @param {string} idLiteral Raw request id.
 * @returns {string} SPARQL SELECT query string.
 */
function buildCountHeadersInGraphById(graphIri, idLiteral) {
  return `
    PREFIX ex: <${ONT_EX}>
    SELECT (COUNT(DISTINCT ?h) AS ?n)
    WHERE {
      GRAPH <${graphIri}> {
        ?req a ex:Request ; ex:id ${sparqlStr(idLiteral)} .
        {
          ?req ex:reqHeader ?h .
        } UNION {
          ?req ex:payHeader ?h .
        } UNION {
          ?req ex:repHeader ?h .
        }
      }
    }
  `;
}

/**
 * Count distinct `ex:Request` (by resource) with the given id in a named graph.
 * @param {string} graphIri Named graph IRI.
 * @param {string} id Request id.
 * @returns {Promise<number>} Count (0 on error).
 */
async function countRequestsInGraphById(graphIri, id) {
  const q = buildCountRequestsInGraphById(graphIri, id);
  const res = await postGraphDBSelect(q);
  if (res.status !== 200) return 0;
  const v = res.data?.results?.bindings?.[0]?.n?.value;
  return Number.parseInt(v, 10) || 0;
}

/**
 * Count distinct headers attached to a Request(id) in a named graph.
 * @param {string} graphIri Named graph IRI.
 * @param {string} id Request id.
 * @returns {Promise<number>} Count (0 on error).
 */
async function countHeadersInGraphById(graphIri, id) {
  const q = buildCountHeadersInGraphById(graphIri, id);
  const res = await postGraphDBSelect(q);
  if (res.status !== 200) return 0;
  const v = res.data?.results?.bindings?.[0]?.n?.value;
  return Number.parseInt(v, 10) || 0;
}

/**
 * Retrieve the list of distinct numeric status codes associated with a Request(id) in a graph.
 * @param {string} graphIri Named graph IRI.
 * @param {string} id Request id.
 * @returns {Promise<number[]>} Array of status codes (ints).
 */
async function getStatusCodesInGraphById(graphIri, id) {
  const q = buildSelectStatusCodesInGraphById(graphIri, id);
  const res = await postGraphDBSelect(q);
  if (res.status !== 200) return [];
  return (res.data?.results?.bindings || [])
    .map(b => (b.code ? Number.parseInt(b.code.value, 10) : null))
    .filter(n => Number.isInteger(n));
}

/**
 * Ask whether a specific triple exists in a given named graph.
 * @param {string} graph Named graph IRI.
 * @param {string} subject Subject IRI.
 * @param {string} predicate Predicate IRI.
 * @param {string} objectLiteral Object literal (will be double-quoted).
 * @returns {Promise<boolean>} True if the triple exists.
 */
async function askTripleExists(graph, subject, predicate, objectLiteral) {
  const q = `
    ASK {
      GRAPH <${graph}> {
        <${subject}> <${predicate}> "${objectLiteral}"
      }
    }
  `;
  const res = await postGraphDBSelect(q);
  return res.status === 200 && Boolean(res.data?.boolean);
}

module.exports = {
  askRequestExists,
  selectRequestInfo,
  buildAskByRequestId,
  buildSelectByRequestId,
  sparqlStr,
  buildAskByRequestIdInGraph,
  askRequestExistsInGraph,
  buildCountRequestsInGraphById,
  countRequestsInGraphById,
  countHeadersInGraphById,
  getStatusCodesInGraphById,
  askTripleExists,
  ONT_EX
};
