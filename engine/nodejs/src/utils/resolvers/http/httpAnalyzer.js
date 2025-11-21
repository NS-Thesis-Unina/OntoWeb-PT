const { makeLogger } = require('../../logs/logger');
const { httpRules } = require('./httpRules');
const { G_HTTP } = require('../../constants');
const {
  iriRequest,
  iriURI,
  iriResponse,
  iriHeader,
  iriResHeader,
  iriParam,
} = require('../../iri/http');

const log = makeLogger('resolver:http');

/**
 * Costruisce il contesto HTTP comune a tutte le regole per una request.
 * Qui le cose che servono a legare i finding all’ontologia:
 *   - requestId (usato in EX:id)
 *   - graph (named graph dove è stata inserita la Request)
 *   - IRIs di Request / URI / Response
 */
function buildBaseHttpContext(req) {
  const requestId = req?.id || null;
  const graph = req?.graph || G_HTTP;

  const ctx = {
    requestId,
    graph,
  };

  if (requestId) {
    ctx.requestIri = iriRequest(requestId);
    ctx.uriIri = iriURI(requestId);
    if (req?.response) {
      ctx.responseIri = iriResponse(requestId);
    }
  }

  return ctx;
}

/**
 * Arricchisce il contesto HTTP con IRIs specifici per headers / params / cookies,
 * usando gli indici presenti in evidence.
 *
 * - headers[].iri       -> urn:req:{id}:hdr:{i} o :resh:{i}
 * - params[].iri        -> urn:req:{id}:param:{i}
 * - cookies[].headerIri -> IRI dell’header che contiene i cookie
 */
function enrichHttpContextWithEvidence(baseCtx, evidence) {
  const ctx = { ...baseCtx };

  const requestId = baseCtx.requestId;
  if (!requestId) {
    // senza id non possiamo calcolare URN; restituiamo solo baseCtx
    return ctx;
  }

  if (evidence && Array.isArray(evidence.params)) {
    ctx.params = evidence.params.map((p) => ({
      ...p,
      iri: iriParam(requestId, p.index),
    }));
  }

  if (evidence && Array.isArray(evidence.headers)) {
    ctx.headers = evidence.headers.map((h) => {
      let iri = null;
      if (h.where === 'request') {
        iri = iriHeader(requestId, h.index);
      } else if (h.where === 'response') {
        iri = iriResHeader(requestId, h.index);
      }

      return {
        ...h,
        iri,
      };
    });
  }

  if (evidence && Array.isArray(evidence.cookies)) {
    ctx.cookies = evidence.cookies.map((c) => {
      let headerIri = null;
      if (c.where === 'request') {
        headerIri = iriHeader(requestId, c.headerIndex);
      } else if (c.where === 'response') {
        headerIri = iriResHeader(requestId, c.headerIndex);
      }

      return {
        ...c,
        headerIri,
      };
    });
  }

  return ctx;
}

async function analyzeHttpRequests(requests = [], verbose = false) {
  log.info(`Analyzing ${requests.length} HTTP requests with ${httpRules.length} rules...`);

  const findings = [];

  for (const req of requests) {
    const baseCtx = buildBaseHttpContext(req);

    for (const rule of httpRules) {
      try {
        const evidence = rule.check(req);

        if (!evidence) {
          continue;
        }

        const httpContext = enrichHttpContextWithEvidence(baseCtx, evidence);

        const finding = {
          // === Metadata della regola ===
          ruleId: rule.id,
          severity: rule.severity,
          description: rule.description,
          category: rule.category,
          owasp: rule.owasp,

          // === Info HTTP “classiche” ===
          url: req?.uri?.full,
          method: req?.method,
          responseStatus: req?.response?.status,

          // === Collegamento all’ontologia ===
          // Request già inserita in GraphDB con:
          //   <urn:req:{id}> a ex:Request ; ex:id "{id}" .
          requestId: baseCtx.requestId,
          graph: baseCtx.graph,

          // Resolver semantico (per ex:detectedByResolver)
          // mappabile all’individual HttpResolverInstance
          resolver: 'HttpResolverInstance',

          // Contesto HTTP con IRIs pronti per essere usati in SPARQL:
          // - httpContext.requestIri
          // - httpContext.uriIri
          // - httpContext.responseIri
          // - httpContext.headers[].iri
          // - httpContext.params[].iri
          // - httpContext.cookies[].headerIri
          httpContext,

          // Evidence raw, utile lato UI / debug
          evidence,
        };

        findings.push(finding);

        if (verbose) {
          log.info(`🧩 Rule matched: ${rule.id}`, {
            url: finding.url,
            method: finding.method,
            severity: finding.severity,
            requestId: finding.requestId,
          });
        }
      } catch (err) {
        log.warn(`Rule ${rule.id} threw an error: ${err.message}`);
      }
    }
  }

  const stats = {
    high: findings.filter((f) => f.severity === 'high').length,
    medium: findings.filter((f) => f.severity === 'medium').length,
    low: findings.filter((f) => f.severity === 'low').length,
  };

  log.info(
    `HTTP analysis completed — ${findings.length} findings (H:${stats.high}, M:${stats.medium}, L:${stats.low})`
  );

  return {
    ok: true,
    totalFindings: findings.length,
    stats,
    findings,
  };
}

module.exports = { analyzeHttpRequests };
