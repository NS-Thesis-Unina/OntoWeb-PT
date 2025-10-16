const {
  escapeStringLiteral,
  iriFragmentSafe,
  xmlLiteralFromQueryRaw,
  xmlLiteralFromParams,
  classifyRequestHeader
} = require('../utils');

// Ontology Prefix 
const EX = (process.env.ONT_EX || 'http://www.semanticweb.org/nda/ontologies/2025/8/untitled-ontology-18') + '#';
const CONTENT = process.env.ONT_CONTENT ? 
  process.env.ONT_CONTENT + "#" : 'http://www.w3.org/2008/content#';

// IRI helpers
function iriRequest(id) { return `urn:req:${iriFragmentSafe(id)}`; }
function iriURI(id)     { return `urn:req:${iriFragmentSafe(id)}:uri`; }
function iriHeader(id, idx) { return `urn:req:${iriFragmentSafe(id)}:hdr:${idx}`; }
function iriParam(id, idx)  { return `urn:req:${iriFragmentSafe(id)}:param:${idx}`; }

// Build INSERT DATA for a single request HTTP
function buildInsertFromHttpRequest(p = {}) {

  if (!p.id || !p.method || !p.uri || !p.uri.full) {
    throw new Error('Missing id/method/uri.full');
  }

  const g = process.env.HTTP_REQUESTS_NAME_GRAPH || p.graph || 'http://example.com/graphs/http-requests';
  const reqIri = `<${iriRequest(p.id)}>`;
  const uriIri = `<${iriURI(p.id)}>`;
  const methodName = String(p.method || '').toUpperCase();
  const methodInd = `<${EX}${methodName}>`;

  const triples = [];

  // Types Base
  triples.push(
    `${reqIri} a <${EX}Request> .`,
    `${uriIri} a <${EX}URI> .`
  );

  triples.push(`${reqIri} <${EX}id> "${escapeStringLiteral(p.id)}" .`);
  triples.push(`${reqIri} <${EX}uriRequest> ${uriIri} .`);
  triples.push(`${reqIri} <${EX}mthd> ${methodInd} .`);

  if (p.httpVersion) {
    triples.push(`${reqIri} <${EX}httpVersion> "${escapeStringLiteral(p.httpVersion)}" .`);
  }

  // Body base64
  if (p.bodyBase64) {
    triples.push(`${reqIri} <${EX}body> "${escapeStringLiteral(p.bodyBase64)}"^^<${CONTENT}ContentAsBase64> .`);
  }

  // URI data properties
  const u = p.uri || {};
  if (u.scheme)    triples.push(`${uriIri} <${EX}scheme> "${escapeStringLiteral(u.scheme)}" .`);
  if (u.authority) triples.push(`${uriIri} <${EX}authority> "${escapeStringLiteral(u.authority)}" .`);
  if (u.path)      triples.push(`${uriIri} <${EX}path> "${escapeStringLiteral(u.path)}" .`);
  if (u.fragment)  triples.push(`${uriIri} <${EX}fragment> "${escapeStringLiteral(u.fragment)}" .`);
  if (u.full)      triples.push(`${uriIri} <${EX}uri> "${escapeStringLiteral(u.full)}" .`);

  // ex:query as rdf:XMLLiteral
  // - priority: uri.queryXml (already XML) → use directly
  // - then: uri.queryRaw (string) → converted into <query>raw</query>
  // - otherwise: if params exist, serialize as <query><param ...>...</param></query>
  if (u.queryXml && String(u.queryXml).trim()) {
    const xmlLiteral = require('../utils').asXmlLiteral(String(u.queryXml));
    triples.push(`${uriIri} <${EX}query> ${xmlLiteral} .`);
  } else if (u.queryRaw && String(u.queryRaw).trim()) {
    triples.push(`${uriIri} <${EX}query> ${xmlLiteralFromQueryRaw(u.queryRaw)} .`);
  } else if (Array.isArray(u.params) && u.params.length > 0) {
    triples.push(`${uriIri} <${EX}query> ${xmlLiteralFromParams(u.params)} .`);
  }

  // Parameters -> ex:Parameter + link ex:param
  const params = Array.isArray(u.params) ? u.params : [];
  params.forEach((prm, i) => {
    const paramIri = `<${iriParam(p.id, i)}>`;
    triples.push(
      `${paramIri} a <${EX}Parameter> .`,
      `${paramIri} <${EX}nameParameter> "${escapeStringLiteral(prm.name || '')}"^^<http://www.w3.org/2001/XMLSchema#string> .`
    );
    if (prm.value !== undefined && prm.value !== null) {
      triples.push(`${paramIri} <${EX}valueParameter> "${escapeStringLiteral(String(prm.value))}" .`);
    }
    triples.push(`${uriIri} <${EX}param> ${paramIri} .`);
  });

  // Headers: classified into RequestHeader / RepresentationHeaders / PayloadHeaders
  const headers = Array.isArray(p.requestHeaders) ? p.requestHeaders : [];
  headers.forEach((h, i) => {
    const hdrIri = `<${iriHeader(p.id, i)}>`;
    const { cls, prop } = classifyRequestHeader(h?.name || '');
    triples.push(
      `${hdrIri} a <${EX}${cls}> .`,
      `${hdrIri} <${EX}fieldName> "${escapeStringLiteral(h?.name || '')}"^^<http://www.w3.org/2001/XMLSchema#string> .`
    );
    if (h?.value !== undefined && h?.value !== null) {
      triples.push(`${hdrIri} <${EX}fieldValue> "${escapeStringLiteral(String(h.value))}" .`);
    }
    // prop: reqHeader | repHeader | payHeader
    triples.push(`${reqIri} <${EX}${prop}> ${hdrIri} .`);
  });

  // Final building
  const update = `
  PREFIX ex: <${EX}>
  PREFIX content: <${CONTENT}>
  PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
  INSERT DATA {
    GRAPH <${g}> {
      ${triples.join('\n    ')}
    }
  }
  `.trim();

  return update;
}

// Build a single INSERT DATA by concatenating multiple requests (using the same graph is recommended)
function buildInsertFromHttpRequestsArray(
  list = [], 
  defaultGraph = process.env.HTTP_REQUESTS_NAME_GRAPH ?? 'http://example.com/graphs/http-requests'
) {
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('Expected a non-empty array of requests');
  }
  const graphs = new Map();

  for (const p of list) {
    const g = p.graph || defaultGraph;
    if (!graphs.has(g)) graphs.set(g, []);
    const triples = extractTriplesForSingleRequest(p);
    graphs.get(g).push(...triples);
  }

  const parts = [];
  parts.push(`PREFIX ex: <${EX}>`);
  parts.push(`PREFIX content: <${CONTENT}>`);
  parts.push(`PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>`);
  parts.push(`INSERT DATA {`);
  for (const [g, triples] of graphs.entries()) {
    parts.push(`  GRAPH <${g}> {`);
    parts.push(`    ${triples.join('\n    ')}`);
    parts.push(`  }`);
  }
  parts.push(`}`);

  return parts.join('\n');
}

// Internal utility: generates ONLY the triples (array of strings) for reuse in batch operations
function extractTriplesForSingleRequest(p = {}) {
  if (!p.id || !p.method || !p.uri || !p.uri.full) {
    throw new Error('Missing id/method/uri.full');
  }

  const reqIri = `<${iriRequest(p.id)}>`;
  const uriIri = `<${iriURI(p.id)}>`;
  const methodName = String(p.method || '').toUpperCase();
  const methodInd = `<${EX}${methodName}>`;

  const triples = [];

  triples.push(
    `${reqIri} a <${EX}Request> .`,
    `${uriIri} a <${EX}URI> .`,
    `${reqIri} <${EX}id> "${escapeStringLiteral(p.id)}" .`,
    `${reqIri} <${EX}uriRequest> ${uriIri} .`,
    `${reqIri} <${EX}mthd> ${methodInd} .`
  );

  if (p.httpVersion) {
    triples.push(`${reqIri} <${EX}httpVersion> "${escapeStringLiteral(p.httpVersion)}" .`);
  }
  if (p.bodyBase64) {
    triples.push(`${reqIri} <${EX}body> "${escapeStringLiteral(p.bodyBase64)}"^^<${CONTENT}ContentAsBase64> .`);
  }

  const u = p.uri || {};
  if (u.scheme)    triples.push(`${uriIri} <${EX}scheme> "${escapeStringLiteral(u.scheme)}" .`);
  if (u.authority) triples.push(`${uriIri} <${EX}authority> "${escapeStringLiteral(u.authority)}" .`);
  if (u.path)      triples.push(`${uriIri} <${EX}path> "${escapeStringLiteral(u.path)}" .`);
  if (u.fragment)  triples.push(`${uriIri} <${EX}fragment> "${escapeStringLiteral(u.fragment)}" .`);
  if (u.full)      triples.push(`${uriIri} <${EX}uri> "${escapeStringLiteral(u.full)}" .`);

  if (u.queryXml && String(u.queryXml).trim()) {
    const xmlLiteral = require('../utils').asXmlLiteral(String(u.queryXml));
    triples.push(`${uriIri} <${EX}query> ${xmlLiteral} .`);
  } else if (u.queryRaw && String(u.queryRaw).trim()) {
    triples.push(`${uriIri} <${EX}query> ${xmlLiteralFromQueryRaw(u.queryRaw)} .`);
  } else if (Array.isArray(u.params) && u.params.length > 0) {
    triples.push(`${uriIri} <${EX}query> ${xmlLiteralFromParams(u.params)} .`);
  }

  const params = Array.isArray(u.params) ? u.params : [];
  params.forEach((prm, i) => {
    const paramIri = `<${iriParam(p.id, i)}>`;
    triples.push(
      `${paramIri} a <${EX}Parameter> .`,
      `${paramIri} <${EX}nameParameter> "${escapeStringLiteral(prm.name || '')}"^^<http://www.w3.org/2001/XMLSchema#string> .`
    );
    if (prm.value !== undefined && prm.value !== null) {
      triples.push(`${paramIri} <${EX}valueParameter> "${escapeStringLiteral(String(prm.value))}" .`);
    }
    triples.push(`${uriIri} <${EX}param> ${paramIri} .`);
  });

  const headers = Array.isArray(p.requestHeaders) ? p.requestHeaders : [];
  headers.forEach((h, i) => {
    const hdrIri = `<${iriHeader(p.id, i)}>`;
    const { cls, prop } = classifyRequestHeader(h?.name || '');
    triples.push(
      `${hdrIri} a <${EX}${cls}> .`,
      `${hdrIri} <${EX}fieldName> "${escapeStringLiteral(h?.name || '')}"^^<http://www.w3.org/2001/XMLSchema#string> .`
    );
    if (h?.value !== undefined && h?.value !== null) {
      triples.push(`${hdrIri} <${EX}fieldValue> "${escapeStringLiteral(String(h.value))}" .`);
    }
    triples.push(`${reqIri} <${EX}${prop}> ${hdrIri} .`);
  });

  return triples;
}

module.exports = {
  buildInsertFromHttpRequest,
  buildInsertFromHttpRequestsArray
};
