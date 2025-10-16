const EX = (process.env.ONT_EX || 'http://www.semanticweb.org/nda/ontologies/2025/8/untitled-ontology-18') + '#';
const G_HTTP = process.env.HTTP_REQUESTS_NAME_GRAPH || 'http://example.com/graphs/http-requests';

function buildSelectRequests({ ids = [], filters = {}, limit = 50, offset = 0 }) {
  const {
    method,             // es. GET
    scheme,             // es. https
    authority,          // es. api.example.com
    path,               // es. /v1/search
    headerName,         // es. Content-Type
    headerValue,        // es. application/json
    text,               // simple search on uri.full (string contains)
  } = filters || {};

  const idFilters = Array.isArray(ids) && ids.length
    ? `VALUES ?idVal { ${ids.map(id => `"${escapeStr(id)}"`).join(' ')} }`
    : '';

  const whereFilters = [];

  if (method)     whereFilters.push(`FILTER(ucase(str(?methodName)) = "${escapeStr(String(method).toUpperCase())}")`);
  if (scheme)     whereFilters.push(`FILTER(str(?scheme) = "${escapeStr(scheme)}")`);
  if (authority)  whereFilters.push(`FILTER(str(?authority) = "${escapeStr(authority)}")`);
  if (path)       whereFilters.push(`FILTER(str(?path) = "${escapeStr(path)}")`);
  if (text)       whereFilters.push(`FILTER(CONTAINS(str(?uriFull), "${escapeStr(text)}"))`);
  if (headerName) whereFilters.push(`FILTER(lcase(str(?hdrName)) = "${escapeStr(headerName.toLowerCase())}")`);
  if (headerValue)whereFilters.push(`FILTER(str(?hdrValue) = "${escapeStr(headerValue)}")`);

  return `
    PREFIX ex: <${EX}>
    SELECT
      (?idVal AS ?id) ?httpVersion ?methodName
      ?uriFull ?scheme ?authority ?path ?fragment ?queryXml
      ?bodyBase64
      ?hdrName ?hdrValue
      ?paramName ?paramValue
    WHERE {
      GRAPH <${G_HTTP}> {
        # Core nodes
        ?req a ex:Request ;
             ex:uriRequest ?uriRes ;
             ex:mthd ?methodInd .
        OPTIONAL { ?req ex:id ?idExplicit . }
        BIND(COALESCE(?idExplicit, STRAFTER(STR(?req), "urn:req:")) AS ?idVal)

        # method as local name
        BIND(STRAFTER(STR(?methodInd), "#") AS ?methodName)

        # httpVersion (opt)
        OPTIONAL { ?req ex:httpVersion ?httpVersion . }

        # bodyBase64 (opt, datatyped)
        OPTIONAL {
          ?req ex:body ?bodyBase64 .
        }

        # URI node and its parts
        ?uriRes a ex:URI .
        OPTIONAL { ?uriRes ex:uri       ?uriFull . }
        OPTIONAL { ?uriRes ex:scheme    ?scheme . }
        OPTIONAL { ?uriRes ex:authority ?authority . }
        OPTIONAL { ?uriRes ex:path      ?path . }
        OPTIONAL { ?uriRes ex:fragment  ?fragment . }
        OPTIONAL { ?uriRes ex:query     ?queryXml . } # rdf:XMLLiteral

        # Headers (0..n)
        OPTIONAL {
          {
            ?req ex:reqHeader ?hdr .
          } UNION {
            ?req ex:repHeader ?hdr .
          } UNION {
            ?req ex:payHeader ?hdr .
          }
          ?hdr ex:fieldName ?hdrName .
          OPTIONAL { ?hdr ex:fieldValue ?hdrValue . }
        }

        # Params (0..n)
        OPTIONAL {
          ?uriRes ex:param ?param .
          ?param a ex:Parameter ;
                ex:nameParameter ?paramName .
          OPTIONAL { ?param ex:valueParameter ?paramValue . }
        }

        ${idFilters}

        # Filtri aggiuntivi
        ${whereFilters.join('\n    ')}
      }
    }
    LIMIT ${Number.isFinite(+limit) ? +limit : 50}
    OFFSET ${Number.isFinite(+offset) ? +offset : 0}
  `.trim();
}

function escapeStr(s = '') {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

function bindingsToRequestsJson(bindings) {
  const byId = new Map();

  for (const b of bindings) {
    const id = valueOf(b.id);
    if (!id) continue;

    if (!byId.has(id)) {
      byId.set(id, {
        id,
        httpVersion: valueOf(b.httpVersion) || undefined,
        method: valueOf(b.methodName) || undefined,
        uri: {
          full: valueOf(b.uriFull) || undefined,
          scheme: valueOf(b.scheme) || undefined,
          authority: valueOf(b.authority) || undefined,
          path: valueOf(b.path) || undefined,
          fragment: valueOf(b.fragment) || undefined,
        },
        requestHeaders: [],
        bodyBase64: valueOf(b.bodyBase64) || '',
        graph: G_HTTP
      });
    }

    const obj = byId.get(id);

    // Headers
    const hn = valueOf(b.hdrName);
    if (hn) {
      const hv = valueOf(b.hdrValue) ?? '';
      if (!obj.requestHeaders.some(h => h.name === hn && h.value === hv)) {
        obj.requestHeaders.push({ name: hn, value: hv });
      }
    }

    // Params
    const pn = valueOf(b.paramName);
    if (pn) {
      const pv = valueOf(b.paramValue) ?? '';
      if (!obj.uri.params) obj.uri.params = [];
      if (!obj.uri.params.some(p => p.name === pn && String(p.value ?? '') === pv)) {
        obj.uri.params.push({ name: pn, value: pv });
      }
    }
  }

  // post-processing: order headers/params and build queryRaw
  for (const r of byId.values()) {
    if (r.requestHeaders?.length) {
      r.requestHeaders.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (r.uri?.params?.length) {
      r.uri.params.sort((a, b) => a.name.localeCompare(b.name));
      // generate queryRaw
      if (!r.uri.queryRaw) {
        r.uri.queryRaw = r.uri.params
          .map(p => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.value ?? '')}`)
          .join('&');
      }
    }

    if (!r.httpVersion) delete r.httpVersion;
    if (!r.uri.fragment) delete r.uri.fragment;
    if (!r.uri.scheme) delete r.uri.scheme;
    if (!r.uri.authority) delete r.uri.authority;
    if (!r.uri.path) delete r.uri.path;
    if (!r.uri.full) delete r.uri.full;
    if (!r.uri.queryRaw) delete r.uri.queryRaw;
    if (!r.uri.params || r.uri.params.length === 0) delete r.uri.params;
    if (!r.requestHeaders || r.requestHeaders.length === 0) delete r.requestHeaders;
    if (!r.bodyBase64) delete r.bodyBase64;
  }

  return { items: Array.from(byId.values()) };
}

function valueOf(bindingTerm) {
  if (!bindingTerm) return undefined;
  if (Object.prototype.hasOwnProperty.call(bindingTerm, 'value')) {
    return bindingTerm.value;
  }
  return undefined;
}

function buildSelectRequestIds({ filters = {}, limit = 50, offset = 0, orderBy = 'id' }) {
  const {
    method, scheme, authority, path, headerName, headerValue, text,
  } = filters || {};

  const whereFilters = [];
  if (method)     whereFilters.push(`FILTER(ucase(str(?methodName)) = "${escapeStr(String(method).toUpperCase())}")`);
  if (scheme)     whereFilters.push(`FILTER(str(?scheme) = "${escapeStr(scheme)}")`);
  if (authority)  whereFilters.push(`FILTER(str(?authority) = "${escapeStr(authority)}")`);
  if (path)       whereFilters.push(`FILTER(str(?path) = "${escapeStr(path)}")`);
  if (text)       whereFilters.push(`FILTER(CONTAINS(str(?uriFull), "${escapeStr(text)}"))`);
  if (headerName) whereFilters.push(`FILTER(lcase(str(?hdrName)) = "${escapeStr(headerName.toLowerCase())}")`);
  if (headerValue)whereFilters.push(`FILTER(str(?hdrValue) = "${escapeStr(headerValue)}")`);

  const order = (orderBy === 'id') ? 'ORDER BY ?idVal' : '';

  return `
    PREFIX ex: <${EX}>
    SELECT DISTINCT ?idVal
    WHERE {
      GRAPH <${G_HTTP}> {
        ?req a ex:Request ;
             ex:uriRequest ?uriRes ;
             ex:mthd ?methodInd .
        OPTIONAL { ?req ex:id ?idExplicit . }
        BIND(COALESCE(?idExplicit, STRAFTER(STR(?req), "urn:req:")) AS ?idVal)
        BIND(STRAFTER(STR(?methodInd), "#") AS ?methodName)

        ?uriRes a ex:URI .
        OPTIONAL { ?uriRes ex:uri       ?uriFull . }
        OPTIONAL { ?uriRes ex:scheme    ?scheme . }
        OPTIONAL { ?uriRes ex:authority ?authority . }
        OPTIONAL { ?uriRes ex:path      ?path . }

        OPTIONAL {
          { ?req ex:reqHeader ?hdr . } UNION
          { ?req ex:repHeader ?hdr . } UNION
          { ?req ex:payHeader ?hdr . }
          ?hdr ex:fieldName ?hdrName .
          OPTIONAL { ?hdr ex:fieldValue ?hdrValue . }
        }

        ${whereFilters.join('\n        ')}
      }
    }
    ${order}
    LIMIT ${Number.isFinite(+limit) ? +limit : 50}
    OFFSET ${Number.isFinite(+offset) ? +offset : 0}
  `.trim();
}

function buildCountRequests({ filters = {} }) {
  const {
    method, scheme, authority, path, headerName, headerValue, text,
  } = filters || {};

  const whereFilters = [];
  if (method)     whereFilters.push(`FILTER(ucase(str(?methodName)) = "${escapeStr(String(method).toUpperCase())}")`);
  if (scheme)     whereFilters.push(`FILTER(str(?scheme) = "${escapeStr(scheme)}")`);
  if (authority)  whereFilters.push(`FILTER(str(?authority) = "${escapeStr(authority)}")`);
  if (path)       whereFilters.push(`FILTER(str(?path) = "${escapeStr(path)}")`);
  if (text)       whereFilters.push(`FILTER(CONTAINS(str(?uriFull), "${escapeStr(text)}"))`);
  if (headerName) whereFilters.push(`FILTER(lcase(str(?hdrName)) = "${escapeStr(headerName.toLowerCase())}")`);
  if (headerValue)whereFilters.push(`FILTER(str(?hdrValue) = "${escapeStr(headerValue)}")`);

  return `
    PREFIX ex: <${EX}>
    SELECT (COUNT(DISTINCT ?req) AS ?total)
    WHERE {
      GRAPH <${G_HTTP}> {
        ?req a ex:Request ;
             ex:uriRequest ?uriRes ;
             ex:mthd ?methodInd .
        BIND(STRAFTER(STR(?methodInd), "#") AS ?methodName)

        ?uriRes a ex:URI .
        OPTIONAL { ?uriRes ex:uri       ?uriFull . }
        OPTIONAL { ?uriRes ex:scheme    ?scheme . }
        OPTIONAL { ?uriRes ex:authority ?authority . }
        OPTIONAL { ?uriRes ex:path      ?path . }

        OPTIONAL {
          { ?req ex:reqHeader ?hdr . } UNION
          { ?req ex:repHeader ?hdr . } UNION
          { ?req ex:payHeader ?hdr . }
          ?hdr ex:fieldName ?hdrName .
          OPTIONAL { ?hdr ex:fieldValue ?hdrValue . }
        }

        ${whereFilters.join('\n        ')}
      }
    }
  `.trim();
}

module.exports = {
  bindingsToRequestsJson,
  buildSelectRequests,
  buildSelectRequestIds,
  buildCountRequests
};


module.exports = {
  bindingsToRequestsJson,
  buildSelectRequests,
  buildSelectRequestIds,
  buildCountRequests
};
