const { makeLogger } = require('../../logs/logger');
const { httpRules } = require('./httpRules');

const log = makeLogger('resolver:http');

async function analyzeHttpRequests(requests = [], verbose = false) {
  log.info(`Analyzing ${requests.length} HTTP requests with ${httpRules.length} rules...`);

  const findings = [];

  for (const req of requests) {
    for (const rule of httpRules) {
      try {
        if (rule.check(req)) {
          const finding = {
            ruleId: rule.id,
            severity: rule.severity,
            description: rule.description,
            category: rule.category,
            owasp: rule.owasp,
            url: req?.uri?.full,
            method: req?.method,
            responseStatus: req?.response?.status,
          };
          findings.push(finding);

          // se verbose, logga il dettaglio
          if (verbose) {
            log.info(`🧩 Rule matched: ${rule.id}`, {
              url: finding.url,
              method: finding.method,
              severity: finding.severity,
            });
          }
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
