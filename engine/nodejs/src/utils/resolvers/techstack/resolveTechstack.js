// @ts-check

const axios = require('axios').default;
const { makeLogger } = require('../../logs/logger');
const log = makeLogger('resolver:techstack');

const NVD_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

/** @typedef {import('../../_types/resolvers/techstack/types').TechstackSeverity} TechstackSeverity */
/** @typedef {import('../../_types/resolvers/techstack/types').NvdLookupResult} NvdLookupResult */
/** @typedef {import('../../_types/resolvers/techstack/types').TechstackFinding} TechstackFinding */
/** @typedef {import('../../_types/resolvers/techstack/types').TechstackClassifiedHeader} TechstackClassifiedHeader */
/** @typedef {import('../../_types/resolvers/techstack/types').TechstackCookieFinding} TechstackCookieFinding */
/** @typedef {import('../../_types/resolvers/techstack/types').TechstackTechnologyNvdSummary} TechstackTechnologyNvdSummary */
/** @typedef {import('../../_types/resolvers/techstack/types').TechstackWafNvdSummary} TechstackWafNvdSummary */
/** @typedef {import('../../_types/resolvers/techstack/types').TechstackResolveInput} TechstackResolveInput */
/** @typedef {import('../../_types/resolvers/techstack/types').TechstackResolveResult} TechstackResolveResult */
/** @typedef {import('../../_types/resolvers/techstack/types').TechstackFindingCollector} TechstackFindingCollector */
/** @typedef {import('../../_types/resolvers/techstack/types').TechstackCookieIssue} TechstackCookieIssue */
/** @typedef {import('../../_types/resolvers/techstack/types').TechstackCookieInput} TechstackCookieInput */
/** @typedef {import('../../_types/resolvers/techstack/types').TechstackSecureHeaderInput} TechstackSecureHeaderInput */

// === NVD rate limiting config ===
// Without API key: 5 requests / 30 seconds
// With API key:   50 requests / 30 seconds
const NVD_WINDOW_MS = 30_000;
const NVD_LIMIT_NO_KEY = 5;
const NVD_LIMIT_WITH_KEY = 50;

// API key from environment (optional)
const NVD_API_KEY = process.env.NVD_API_KEY || null;

// In-memory list of timestamps for recent NVD calls
/** @type {number[]} */
let nvdCallTimestamps = [];

// Severity normalization and ordering (for ontology compatibility)
const SEVERITY_ORDER = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  INFO: 0,
  UNKNOWN: 0,
};

/**
 * Normalize any severity string to the internal TechstackSeverity set.
 *
 * @param {string} [severity]
 * @returns {TechstackSeverity}
 */
function normalizeSeverity(severity) {
  if (!severity) return 'UNKNOWN';
  const s = String(severity).toUpperCase();
  if (s === 'CRITICAL' || s === 'HIGH' || s === 'MEDIUM' || s === 'LOW' || s === 'INFO') {
    return /** @type {TechstackSeverity} */ (s);
  }
  return 'UNKNOWN';
}

/**
 * Pick the worst severity between two values according to SEVERITY_ORDER.
 *
 * @param {TechstackSeverity|string} current
 * @param {TechstackSeverity|string} candidate
 * @returns {TechstackSeverity}
 */
function worstSeverity(current, candidate) {
  const cur = normalizeSeverity(current);
  const cand = normalizeSeverity(candidate);
  return SEVERITY_ORDER[cand] > SEVERITY_ORDER[cur] ? cand : cur;
}

/**
 * Simple sleep helper (ms).
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrapper around axios.get with basic client-side rate limiting for NVD.
 *
 * @param {string} url
 * @param {import('axios').AxiosRequestConfig} [config]
 * @returns {Promise<import('axios').AxiosResponse<any>>}
 */
async function rateLimitedGet(url, config = {}) {
  const now = Date.now();
  const limit = NVD_API_KEY ? NVD_LIMIT_WITH_KEY : NVD_LIMIT_NO_KEY;

  // Drop timestamps that are outside the current window
  nvdCallTimestamps = nvdCallTimestamps.filter((t) => now - t < NVD_WINDOW_MS);

  if (nvdCallTimestamps.length >= limit) {
    const oldest = nvdCallTimestamps[0];
    const waitMs = NVD_WINDOW_MS - (now - oldest) + 100; // small safety margin
    log.info(`NVD rate limit reached (${nvdCallTimestamps.length}/${limit}), sleeping ${waitMs}ms`);
    await sleep(waitMs);
  }

  nvdCallTimestamps.push(Date.now());

  const headers = {
    ...(config.headers || {}),
  };

  if (NVD_API_KEY) {
    // NVD expects the API key in the "apiKey" header
    headers.apiKey = NVD_API_KEY;
  }

  return axios.get(url, {
    timeout: 15000,
    ...config,
    headers,
  });
}

/**
 * Lookup CVEs and CPEs on NVD for a given product/version pair.
 *
 * @param {string} product
 * @param {string} [version='']
 * @returns {Promise<NvdLookupResult>}
 */
async function lookupNvd(product, version = '') {
  const keyword = encodeURIComponent(`${product}${version ? ' ' + version : ''}`);
  const url = `${NVD_BASE}?keywordSearch=${keyword}`;

  const maxRetries = 2; // number of retries on HTTP 429
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const res = await rateLimitedGet(url);
      const vulns = res.data?.vulnerabilities || [];

      /** @type {NvdLookupResult} */
      const out = { cve: [], cpe: [] };
      const cpes = new Set();

      for (const v of vulns) {
        const id = v?.cve?.id;
        if (!id) continue;

        const metrics = v.cve?.metrics || {};
        const cvssV3 = metrics.cvssMetricV31?.[0]?.cvssData || metrics.cvssMetricV30?.[0]?.cvssData;
        const cvssV2 = metrics.cvssMetricV2?.[0]?.cvssData;
        const cvss = cvssV3 || cvssV2 || {};
        const score = cvss.baseScore || null;
        const severity = normalizeSeverity(cvss.baseSeverity || 'UNKNOWN');

        out.cve.push({ id, severity, score });

        const configs = v?.cve?.configurations || [];
        for (const c of configs) {
          for (const node of c?.nodes || []) {
            for (const match of node?.cpeMatch || []) {
              if (match?.criteria) cpes.add(match.criteria);
            }
          }
        }
      }

      out.cpe = [...cpes];
      return {
        cve: out.cve.slice(0, 10),
        cpe: out.cpe.slice(0, 10),
      };
    } catch (err) {
      const e = /** @type {any} */ (err);
      const status = e?.response?.status;
      const msg = e?.message || String(e);

      if (status === 429 && attempt < maxRetries) {
        const backoffMs = 2000 * (attempt + 1);
        log.warn(
          `lookup 429 for ${product} ${version}, retrying in ${backoffMs}ms (attempt ${
            attempt + 1
          }/${maxRetries})`
        );
        await sleep(backoffMs);
        attempt += 1;
        continue;
      }

      log.warn(`lookup failed for ${product} ${version}: status=${status} msg=${msg}`);
      return { cve: [], cpe: [] };
    }
  }

  // Fallback (should not normally reach here)
  return { cve: [], cpe: [] };
}

/**
 * Classify security headers (HSTS, CSP, X-Frame-Options, etc.) and
 * attach risk, severity and remediation hints.
 *
 * @param {TechstackSecureHeaderInput[]} headers
 * @returns {TechstackClassifiedHeader[]}
 */
function classifyHeaders(headers = []) {
  /** @type {TechstackClassifiedHeader[]} */
  const results = [];

  for (const h of headers) {
    const name = String(h.header || '').toLowerCase();
    let risk = 'INFO';
    let remediation = 'Review header policy manually';
    let category = 'HeaderSecurity';
    let rule = 'generic_header_observation';

    switch (name) {
      case 'hsts':
      case 'strict-transport-security':
        risk = 'HIGH';
        category = 'TransportSecurity';
        rule = 'missing_hsts';
        remediation = 'Add header: Strict-Transport-Security: max-age=31536000; includeSubDomains';
        break;

      case 'content-security-policy':
      case 'csp':
        risk = 'HIGH';
        category = 'ContentSecurityPolicy';
        rule = 'missing_csp';
        remediation = "Add a strict CSP policy, e.g.: Content-Security-Policy: default-src 'self';";
        break;

      case 'x-frame-options':
        risk = 'MEDIUM';
        category = 'ClickjackingProtection';
        rule = 'deprecated_x_frame_options';
        remediation =
          "Replace with Content-Security-Policy: frame-ancestors 'none' (X-Frame-Options is deprecated)";
        break;

      case 'x-content-type-options':
        risk = 'MEDIUM';
        category = 'MimeSniffingProtection';
        rule = 'missing_x_content_type_options';
        remediation = 'Add header: X-Content-Type-Options: nosniff to prevent MIME-type sniffing';
        break;

      case 'x-xss-protection':
        risk = 'LOW';
        category = 'LegacyXSSFilter';
        rule = 'deprecated_x_xss_protection';
        remediation = 'Header obsolete: remove or replace with proper CSP configuration';
        break;

      default:
        // keep defaults above
        break;
    }

    const severity = normalizeSeverity(risk);

    results.push({
      header: h.header,
      description: h.description || '',
      urls: h.urls || [],
      risk,
      severity,
      category,
      rule,
      remediation,
    });
  }

  return results;
}

/**
 * Analyze WAF technologies via NVD and optionally emit findings via a collector.
 *
 * @param {Array<{ name?: string }>} wafList
 * @param {TechstackFindingCollector} [collectFinding]
 * @returns {Promise<TechstackWafNvdSummary[]>}
 */
async function analyzeWaf(wafList = [], collectFinding) {
  /** @type {TechstackWafNvdSummary[]} */
  const analyzed = [];
  const hasCollector = typeof collectFinding === 'function';

  for (const w of wafList) {
    const name = String(w.name || '').trim();
    if (!name) continue;

    const nvd = await lookupNvd(name);
    const hasKnownCVE = nvd.cve.length > 0;

    analyzed.push({
      name,
      hasKnownCVE,
      cve: nvd.cve,
      cpe: nvd.cpe,
    });

    if (hasKnownCVE && hasCollector) {
      for (const cve of nvd.cve) {
        const severity = normalizeSeverity(cve.severity);
        /** @type {TechstackFinding} */
        const finding = {
          id: `waf:${name}:${cve.id}`,
          source: 'techstack',
          kind: 'WafCVE',
          rule: 'nvd_cve_match',
          severity,
          score: typeof cve.score === 'number' ? cve.score : null,
          category: 'WafVulnerability',
          message: `WAF ${name} has known vulnerability ${cve.id} (${severity}${
            cve.score != null ? ', score ' + cve.score : ''
          }).`,
          evidence: {
            type: 'WAF',
            name,
            cpe: nvd.cpe,
          },
        };
        collectFinding(finding);
      }
    }
  }

  return analyzed;
}

/**
 * Analyze cookies according to security flags and domain/scope.
 *
 * @param {TechstackCookieInput[]} cookies
 * @param {string} [mainDomain='']
 * @returns {TechstackCookieFinding[]}
 */
function analyzeCookies(cookies = [], mainDomain = '') {
  const now = Date.now() / 1000;
  /** @type {TechstackCookieFinding[]} */
  const findings = [];

  for (const c of cookies) {
    /** @type {TechstackCookieIssue[]} */
    const issues = [];
    /** @type {TechstackSeverity} */
    let cookieWorstSeverity = 'INFO';

    // NOTE: if "secure" / "httpOnly" / "sameSite" are missing in the input,
    // they are treated as false/undefined (conservative from a security POV).

    if (!c.secure) {
      const issue = {
        rule: 'missing_secure',
        risk: 'HIGH',
        severity: normalizeSeverity('HIGH'),
        category: 'SessionHijacking',
        description: 'Cookie not marked as Secure — can be sent over HTTP.',
        remediation: 'Set Secure flag.',
      };
      issues.push(issue);
      cookieWorstSeverity = worstSeverity(cookieWorstSeverity, issue.severity);
    }

    if (!c.httpOnly) {
      const issue = {
        rule: 'missing_httponly',
        risk: 'HIGH',
        severity: normalizeSeverity('HIGH'),
        category: 'XSSDataTheft',
        description: 'Cookie accessible from JavaScript.',
        remediation: 'Set HttpOnly flag.',
      };
      issues.push(issue);
      cookieWorstSeverity = worstSeverity(cookieWorstSeverity, issue.severity);
    }

    if (!c.sameSite) {
      const issue = {
        rule: 'missing_samesite',
        risk: 'MEDIUM',
        severity: normalizeSeverity('MEDIUM'),
        category: 'CSRF',
        description: 'Cookie lacks SameSite protection.',
        remediation: 'Set SameSite=Lax or Strict.',
      };
      issues.push(issue);
      cookieWorstSeverity = worstSeverity(cookieWorstSeverity, issue.severity);
    }

    if (c.sameSite === 'None' && !c.secure) {
      const issue = {
        rule: 'invalid_samesite_none',
        risk: 'HIGH',
        severity: normalizeSeverity('HIGH'),
        category: 'CSRFSessionLeak',
        description: 'SameSite=None without Secure is insecure.',
        remediation: 'Always set Secure with SameSite=None.',
      };
      issues.push(issue);
      cookieWorstSeverity = worstSeverity(cookieWorstSeverity, issue.severity);
    }

    if (c.expirationDate && c.expirationDate - now > 31536000) {
      const issue = {
        rule: 'long_expiry',
        risk: 'LOW',
        severity: normalizeSeverity('LOW'),
        category: 'PrivacyPersistence',
        description: 'Cookie persists for over 1 year.',
        remediation: 'Shorten cookie lifetime.',
      };
      issues.push(issue);
      cookieWorstSeverity = worstSeverity(cookieWorstSeverity, issue.severity);
    }

    if (mainDomain && c.domain && !c.domain.includes(mainDomain)) {
      const issue = {
        rule: 'third_party_cookie',
        risk: 'LOW',
        severity: normalizeSeverity('LOW'),
        category: 'ThirdPartyTracking',
        description: `Cookie from third-party domain ${c.domain}.`,
        remediation: 'Check necessity and GDPR compliance.',
      };
      issues.push(issue);
      cookieWorstSeverity = worstSeverity(cookieWorstSeverity, issue.severity);
    }

    if (/session|token|id/i.test(c.name) && (!c.secure || !c.httpOnly)) {
      const issue = {
        rule: 'unprotected_session_cookie',
        risk: 'HIGH',
        severity: normalizeSeverity('HIGH'),
        category: 'SessionExposure',
        description: `Sensitive cookie (${c.name}) lacks proper flags.`,
        remediation: 'Ensure both Secure and HttpOnly are set.',
      };
      issues.push(issue);
      cookieWorstSeverity = worstSeverity(cookieWorstSeverity, issue.severity);
    }

    if (issues.length > 0) {
      findings.push({
        name: c.name,
        domain: c.domain || null,
        path: c.path || null,
        secure: !!c.secure,
        httpOnly: !!c.httpOnly,
        sameSite: c.sameSite || null,
        expirationDate: c.expirationDate || null,
        worstSeverity: normalizeSeverity(cookieWorstSeverity),
        issues,
      });
    }
  }

  return findings;
}

/**
 * Techstack resolver: correlate technologies/WAF/headers/cookies with
 * known vulnerabilities and best practice recommendations.
 *
 * @param {TechstackResolveInput} param0
 * @returns {Promise<TechstackResolveResult>}
 */
async function resolveTechstack({
  technologies = [],
  waf = [],
  secureHeaders = [],
  cookies = [],
  mainDomain = '',
}) {
  log.info(
    `Techstack resolver start (technologies=${technologies.length}, waf=${waf.length}, headers=${secureHeaders.length}, cookies=${cookies.length})`
  );

  const analyzedAt = new Date().toISOString();

  // Global findings list (aligned with the ontology's Finding / Evidence model)
  /** @type {TechstackFinding[]} */
  const findings = [];
  /** @type {import('../../_types/resolvers/techstack/types').TechstackStats} */
  const stats = {
    bySeverity: /** @type {any} */ ({}),
    byCategory: {},
    byKind: {},
  };
  let totalFindings = 0;

  /** @type {TechstackFindingCollector} */
  function pushFinding(f) {
    findings.push(f);
    totalFindings += 1;

    const severity = normalizeSeverity(f.severity);
    stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1;

    if (f.category) {
      stats.byCategory[f.category] = (stats.byCategory[f.category] || 0) + 1;
    }
    if (f.kind) {
      stats.byKind[f.kind] = (stats.byKind[f.kind] || 0) + 1;
    }
  }

  // === Technologies → NVD → Findings ===
  /** @type {TechstackTechnologyNvdSummary[]} */
  const analyzedTech = [];
  for (const t of technologies) {
    const name = String(t.name || '').trim();
    const version = t.version != null ? String(t.version).trim() : '';

    if (!name) continue;

    const nvd = await lookupNvd(name, version);
    const hasKnownCVE = nvd.cve.length > 0;

    analyzedTech.push({
      name,
      version: version || null,
      cve: nvd.cve,
      cpe: nvd.cpe,
      hasKnownCVE,
    });

    if (hasKnownCVE) {
      for (const cve of nvd.cve) {
        const severity = normalizeSeverity(cve.severity);
        pushFinding({
          id: `tech:${name}:${version || 'unknown'}:${cve.id}`,
          source: 'techstack',
          kind: 'TechnologyCVE',
          rule: 'nvd_cve_match',
          severity,
          score: typeof cve.score === 'number' ? cve.score : null,
          category: 'TechnologyVulnerability',
          message: `Technology ${name}${version ? ' ' + version : ''} has known vulnerability ${
            cve.id
          } (${severity}${cve.score != null ? ', score ' + cve.score : ''}).`,
          evidence: {
            type: 'Technology',
            name,
            version: version || null,
            cpe: nvd.cpe,
          },
        });
      }
    }
  }

  // === WAF analysis → NVD → Findings ===
  const analyzedWaf = await analyzeWaf(waf, pushFinding);

  // === Header classification → Findings ===
  const headerFindings = classifyHeaders(secureHeaders);
  for (const hf of headerFindings) {
    const severity = normalizeSeverity(hf.severity || hf.risk);
    pushFinding({
      id: `header:${String(hf.header || '').toLowerCase()}:${hf.rule || 'generic'}`,
      source: 'techstack',
      kind: 'HeaderIssue',
      rule: hf.rule || 'generic',
      severity,
      category: hf.category || 'HeaderSecurity',
      message: hf.description || `Header ${hf.header} has a security recommendation.`,
      evidence: {
        type: 'Header',
        header: hf.header,
        urls: hf.urls || [],
      },
      remediation: hf.remediation || null,
    });
  }

  // === Cookie analysis → Findings ===
  const cookieFindings = analyzeCookies(cookies, mainDomain);
  for (const cf of cookieFindings) {
    for (const issue of cf.issues) {
      const severity = normalizeSeverity(issue.severity || issue.risk);
      pushFinding({
        id: `cookie:${cf.domain || 'unknown'}:${cf.name}:${issue.rule}`,
        source: 'techstack',
        kind: 'CookieIssue',
        rule: issue.rule,
        severity,
        category: issue.category || 'CookieSecurity',
        message: issue.description || `Cookie ${cf.name} has issue ${issue.rule}.`,
        evidence: {
          type: 'Cookie',
          name: cf.name,
          domain: cf.domain,
          path: cf.path || null,
          flags: {
            secure: cf.secure,
            httpOnly: cf.httpOnly,
            sameSite: cf.sameSite,
          },
          expirationDate: cf.expirationDate || null,
        },
        remediation: issue.remediation || null,
      });
    }
  }

  /** @type {import('../../_types/resolvers/techstack/types').TechstackSummary} */
  const summary = {
    totalTechnologies: analyzedTech.length,
    technologiesWithKnownCVE: analyzedTech.filter((t) => t.hasKnownCVE).length,
    totalWaf: analyzedWaf.length,
    wafWithKnownCVE: analyzedWaf.filter((w) => w.hasKnownCVE).length,
    totalHeaderFindings: headerFindings.length,
    totalCookieFindings: cookieFindings.reduce((acc, cf) => acc + cf.issues.length, 0),
    totalFindings,
  };

  /** @type {TechstackResolveResult} */
  const result = {
    ok: true,
    resolver: {
      id: 'resolver:techstack',
      type: 'TechstackResolver',
      version: '1.0.0',
      ontologyVersion: '1.1.0',
    },
    analyzedAt,
    summary,
    stats,
    findings,
    // These fields are kept for backwards compatibility and also
    // serve as Evidence aggregates that can be mapped in RDF.
    technologies: analyzedTech,
    waf: analyzedWaf,
    secureHeaders: headerFindings,
    cookies: cookieFindings,
  };

  log.info('Techstack resolver completed', {
    totalFindings: result.summary.totalFindings,
    stats: result.stats,
  });

  return result;
}

module.exports = { resolveTechstack };
