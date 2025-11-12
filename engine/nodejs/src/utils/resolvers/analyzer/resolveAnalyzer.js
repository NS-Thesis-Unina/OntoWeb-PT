const { sastEngine } = require('../analyzer/sast/sastEngine');
const { makeLogger } = require('../../logs/logger');
const log = makeLogger('resolver:analyzer');

async function resolveAnalyzer({ scripts = [], html = '', mainDomain = null, includeSnippets = false }) {
  try {

    const engine = new sastEngine({ includeSnippets });


    const findings = await engine.scanCode(scripts, html, mainDomain || '');

   
    const stats = { high: 0, medium: 0, low: 0 };
    for (const f of findings) {
      if (f.severity && stats[f.severity] !== undefined) stats[f.severity]++;
    }

    log.info('Analyzer completed', {
      findings: findings.length,
      high: stats.high,
      medium: stats.medium,
      low: stats.low,
      snippets: includeSnippets ? 'included' : 'disabled',
    });

    return {
      ok: true,
      totalFindings: findings.length,
      stats,
      findings,
    };
  } catch (err) {
    log.error('Analyzer failed', err?.message || err);
    return {
      ok: false,
      error: err?.message || 'Analyzer execution failed',
    };
  }
}

module.exports = { resolveAnalyzer };
