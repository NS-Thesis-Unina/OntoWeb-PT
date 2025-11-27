// @ts-check

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

/** @typedef {import('../../_types/resolvers/http/types').HttpResolverRequest} HttpResolverRequest */
/** @typedef {import('../../_types/resolvers/http/types').HttpResolverResult} HttpResolverResult */
/** @typedef {import('../../_types/resolvers/http/types').HttpContextBase} HttpContextBase */
/** @typedef {import('../../_types/resolvers/http/types').HttpContext} HttpContext */
/** @typedef {import('../../_types/resolvers/http/types').HttpEvidence} HttpEvidence */

const log = makeLogger('resolver:http');

/**
 * Build the base HTTP context shared by all rules for a single request.
 *
 * This context carries:
 *   - requestId (used in EX:id)
 *   - graph    (named graph where the Request was inserted)
 *   - IRIs     for Request / URI / Response
 *
 * @param {HttpResolverRequest} req
 * @returns {HttpContextBase}
 */
function buildBaseHttpContext(req) {
  const requestId = req?.id || null;
  const graph = req?.graph || G_HTTP;

  /** @type {HttpContextBase} */
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
 * Enrich the HTTP context with header/param/cookie IRIs using the
 * evidence indexes provided by the rules.
 *
 * - headers[].iri       -> urn:req:{id}:hdr:{i} or :resh:{i}
 * - params[].iri        -> urn:req:{id}:param:{i}
 * - cookies[].headerIri -> IRI of the header that contains the cookie
 *
 * @param {HttpContextBase} baseCtx
 * @param {HttpEvidence | undefined | null} evidence
 * @returns {HttpContext}
 */
function enrichHttpContextWithEvidence(baseCtx, evidence) {
  /** @type {HttpContext} */
  const ctx = { ...baseCtx };

  const requestId = baseCtx.requestId;
  if (!requestId) {
    // Without an ID we cannot compute URNs; return baseCtx as-is.
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

/**
 * Run ontology-aware HTTP security rules on a list of HTTP requests.
 *
 * For each request:
 *  - Build a base HTTP context (requestId, graph, IRIs).
 *  - Execute all rules from httpRules.
 *  - When a rule matches, compute an enriched httpContext using the evidence.
 *  - Emit a normalized finding object that can be directly mapped to the ontology.
 *
 * @param {HttpResolverRequest[]} [requests=[]]
 * @param {boolean} [verbose=false]
 * @returns {Promise<HttpResolverResult>}
 */
async function analyzeHttpRequests(requests = [], verbose = false) {
  log.info(`Analyzing ${requests.length} HTTP requests with ${httpRules.length} rules...`);

  /** @type {import('../../_types/resolvers/http/types').HttpResolverFinding[]} */
  const findings = [];

  for (const req of requests) {
    const baseCtx = buildBaseHttpContext(req);

    for (const rule of httpRules) {
      try {
        /** @type {HttpEvidence | false | null | undefined} */
        // @ts-ignore - httpRules is a plain JS array, we trust its shape
        const evidence = rule.check(req);

        if (!evidence) {
          continue;
        }

        const httpContext = enrichHttpContextWithEvidence(baseCtx, evidence);

        const finding = {
          // === Rule metadata ===
          ruleId: rule.id,
          severity: rule.severity,
          description: rule.description,
          category: rule.category,
          owasp: rule.owasp,

          // === Classic HTTP info ===
          url: req?.uri?.full,
          method: req?.method,
          responseStatus: req?.response?.status,

          // === Ontology linkage ===
          // Request already inserted in GraphDB with:
          //   <urn:req:{id}> a ex:Request ; ex:id "{id}" .
          requestId: baseCtx.requestId,
          graph: baseCtx.graph,

          // Semantic resolver (for ex:detectedByResolver)
          // mappable to the HttpResolverInstance individual
          resolver: 'HttpResolverInstance',

          // HTTP context with IRIs ready to be used in SPARQL:
          // - httpContext.requestIri
          // - httpContext.uriIri
          // - httpContext.responseIri
          // - httpContext.headers[].iri
          // - httpContext.params[].iri
          // - httpContext.cookies[].headerIri
          httpContext,

          // Raw evidence, useful for UI / debugging
          evidence,
        };

        findings.push(finding);

        if (verbose) {
          log.info(`Rule matched: ${rule.id}`, {
            url: finding.url,
            method: finding.method,
            severity: finding.severity,
            requestId: finding.requestId,
          });
        }
      } catch (err) {
        const e = /** @type {any} */ (err);
        log.warn(`Rule ${rule.id} threw an error: ${e?.message || e}`);
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
