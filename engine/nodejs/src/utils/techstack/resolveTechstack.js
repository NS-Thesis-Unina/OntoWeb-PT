const axios = require('axios').default;
const { makeLogger } = require('../logs/logger');
const log = makeLogger('resolver:techstack');

const NVD_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0';


async function lookupNvd(product, version = '') {
  const keyword = encodeURIComponent(`${product}${version ? ' ' + version : ''}`);
  const url = `${NVD_BASE}?keywordSearch=${keyword}`;
  try {
    const res = await axios.get(url, { timeout: 15000 });
    const vulns = res.data?.vulnerabilities || [];

    const cves = [];
    const cpes = new Set();

    for (const v of vulns) {
      const id = v?.cve?.id;
      if (!id) continue;

 
      const metrics = v.cve?.metrics || {};
      const cvssV3 = metrics.cvssMetricV31?.[0]?.cvssData || metrics.cvssMetricV30?.[0]?.cvssData;
      const cvssV2 = metrics.cvssMetricV2?.[0]?.cvssData;
      const cvss = cvssV3 || cvssV2 || {};
      const score = cvss.baseScore || null;
      const severity = cvss.baseSeverity || 'UNKNOWN';

      cves.push({ id, severity, score });

      const configs = v?.cve?.configurations || [];
      for (const c of configs) {
        for (const node of c?.nodes || []) {
          for (const match of node?.cpeMatch || []) {
            if (match?.criteria) cpes.add(match.criteria);
          }
        }
      }
    }

    return { cve: cves.slice(0, 10), cpe: [...cpes].slice(0, 10) };
  } catch (err) {
    log.warn(`lookup failed for ${product} ${version}: ${err?.message}`);
    return { cve: [], cpe: [] };
  }
}


function classifyHeaders(headers = []) {
  const results = [];

  for (const h of headers) {
    const name = (h.header || '').toLowerCase();
    let risk = 'LOW';
    let remediation = '';

    switch (name) {
      case 'hsts':
      case 'strict-transport-security':
        risk = 'HIGH';
        remediation =
          "Add header: Strict-Transport-Security: max-age=31536000; includeSubDomains";
        break;

      case 'content-security-policy':
      case 'csp':
        risk = 'HIGH';
        remediation =
          "Add a strict CSP policy, e.g.: Content-Security-Policy: default-src 'self';";
        break;

      case 'x-frame-options':
        risk = 'MEDIUM';
        remediation =
          "Replace with Content-Security-Policy: frame-ancestors 'none' (X-Frame-Options is deprecated)";
        break;

      case 'x-content-type-options':
        risk = 'MEDIUM';
        remediation =
          "Add header: X-Content-Type-Options: nosniff to prevent MIME-type sniffing";
        break;

      case 'x-xss-protection':
        risk = 'LOW';
        remediation = 'Header obsolete: remove or replace with proper CSP configuration';
        break;

      default:
        risk = 'INFO';
        remediation = 'Review header policy manually';
    }

    results.push({
      header: h.header,
      description: h.description || '',
      urls: h.urls || [],
      risk,
      remediation,
    });
  }

  return results;
}

async function analyzeWaf(wafList = []) {
  const analyzed = [];
  for (const w of wafList) {
    const name = String(w.name || '').trim();
    if (!name) continue;
    const nvd = await lookupNvd(name);
    analyzed.push({
      name,
      hasKnownCVE: nvd.cve.length > 0,
      cve: nvd.cve,
      cpe: nvd.cpe,
    });
  }
  return analyzed;
}

async function resolveTechstack({ technologies = [], waf = [], secureHeaders = [], cookies = [] }) {
  log.info(`Techstack resolver start (${technologies.length} technologies)`);

  const analyzedTech = [];
  for (const t of technologies) {
    const name = String(t.name || '').trim();
    const version = String(t.version || '').trim();
    if (!name) continue;
    const nvd = await lookupNvd(name, version);
    analyzedTech.push({
      name,
      version: version || null,
      cve: nvd.cve,
      cpe: nvd.cpe,
      hasKnownCVE: nvd.cve.length > 0,
    });
  }

  const analyzedWaf = await analyzeWaf(waf);
  const headerFindings = classifyHeaders(secureHeaders);
  const cookieFindings = analyzeCookies(cookies);

  return {
    analyzedAt: new Date().toISOString(),
    technologies: analyzedTech,
    waf: analyzedWaf,
    secureHeaders: headerFindings,
    cookies: cookieFindings, 
  };
}

function analyzeCookies(cookies = [], mainDomain = '') {
  const now = Date.now() / 1000;
  const findings = [];

  for (const c of cookies) {
    const issues = [];

    if (!c.secure)
      issues.push({
        rule: 'missing_secure',
        risk: 'HIGH',
        category: 'SessionHijacking',
        description: 'Cookie not marked as Secure — can be sent over HTTP.',
        remediation: 'Set Secure flag.',
      });

    if (!c.httpOnly)
      issues.push({
        rule: 'missing_httponly',
        risk: 'HIGH',
        category: 'XSSDataTheft',
        description: 'Cookie accessible from JavaScript.',
        remediation: 'Set HttpOnly flag.',
      });

    if (!c.sameSite)
      issues.push({
        rule: 'missing_samesite',
        risk: 'MEDIUM',
        category: 'CSRF',
        description: 'Cookie lacks SameSite protection.',
        remediation: 'Set SameSite=Lax or Strict.',
      });

    if (c.sameSite === 'None' && !c.secure)
      issues.push({
        rule: 'invalid_samesite_none',
        risk: 'HIGH',
        category: 'CSRFSessionLeak',
        description: 'SameSite=None without Secure is insecure.',
        remediation: 'Always set Secure with SameSite=None.',
      });

    if (c.expirationDate && c.expirationDate - now > 31536000)
      issues.push({
        rule: 'long_expiry',
        risk: 'LOW',
        category: 'PrivacyPersistence',
        description: 'Cookie persists for over 1 year.',
        remediation: 'Shorten cookie lifetime.',
      });

    if (mainDomain && c.domain && !c.domain.includes(mainDomain))
      issues.push({
        rule: 'third_party_cookie',
        risk: 'LOW',
        category: 'ThirdPartyTracking',
        description: `Cookie from third-party domain ${c.domain}.`,
        remediation: 'Check necessity and GDPR compliance.',
      });

    if (/session|token|id/i.test(c.name) && (!c.secure || !c.httpOnly))
      issues.push({
        rule: 'unprotected_session_cookie',
        risk: 'HIGH',
        category: 'SessionExposure',
        description: `Sensitive cookie (${c.name}) lacks proper flags.`,
        remediation: 'Ensure both Secure and HttpOnly are set.',
      });

    if (issues.length > 0) {
      findings.push({ name: c.name, domain: c.domain, issues });
    }
  }

  return findings;
}

module.exports = { resolveTechstack };
