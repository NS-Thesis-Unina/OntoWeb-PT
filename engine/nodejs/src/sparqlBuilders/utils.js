// Literal Escaping SPARQL
function escapeStringLiteral(s = '') {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

// Minimal Escaping XML (rdf:XMLLiteral)
function escapeXml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Convert querystring raw in a simple XMLLiteral <query>...</query>
function xmlLiteralFromQueryRaw(raw = '') {
  const xml = `<query>${escapeXml(String(raw))}</query>`;
  return asXmlLiteral(xml);
}

// Convert an object params [{name,value}] in XMLLiteral
function xmlLiteralFromParams(params = []) {
  const items = (Array.isArray(params) ? params : []).map(p => {
    const n = escapeXml(p?.name ?? '');
    const v = escapeXml(String(p?.value ?? ''));
    return `  <param name="${n}">${v}</param>`;
  }).join('\n');
  const xml = `<query>\n${items}\n</query>`;
  return asXmlLiteral(xml);
}

// Wrap an XML string in a literal rdf:XMLLiteral ready for SPARQL
function asXmlLiteral(xmlString = '') {
  const escaped = xmlString
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
  return `"${escaped}"^^<http://www.w3.org/1999/02/22-rdf-syntax-ns#XMLLiteral>`;
}

// Build an URN/IRI
function iriFragmentSafe(s = '') {
  return encodeURIComponent(String(s));
}

// Heuristics for classifying REQUEST headers according to ontology
// - RequestHeader (fallback)
// - RepresentationHeaders (es. Accept*, Content Negotiation)
// - PayloadHeaders (es. Content-*)
function classifyRequestHeader(name = '') {
  const n = String(name).toLowerCase();

  const payloadSet = new Set([
    'content-type', 'content-length', 'content-encoding', 'content-language',
    'content-location', 'content-md5', 'content-range'
  ]);

  const representationSet = new Set([
    'accept', 'accept-language', 'accept-encoding', 'accept-charset', 'accept-datetime'
  ]);

  if (payloadSet.has(n))  return { cls: 'PayloadHeaders', prop: 'payHeader' };
  if (representationSet.has(n)) return { cls: 'RepresentationHeaders', prop: 'repHeader' };

  return { cls: 'RequestHeader', prop: 'reqHeader' };
}

module.exports = {
  escapeStringLiteral,
  escapeXml,
  xmlLiteralFromQueryRaw,
  xmlLiteralFromParams,
  asXmlLiteral,
  iriFragmentSafe,
  classifyRequestHeader
};
