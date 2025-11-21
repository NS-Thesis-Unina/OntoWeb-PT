// src/resolvers/analyzer/resolveAnalyzer.js
const { sastEngine } = require('../analyzer/sast/sastEngine');
const { makeLogger } = require('../../logs/logger');
const log = makeLogger('resolver:analyzer');

/**
 * Resolver per l'Analyzer (SAST).
 *
 * Input:
 *  - url:        URL completo della pagina analizzata
 *  - scripts:    [{ code?: string, src?: string }, ...]
 *  - html:       stringa HTML completa
 *  - mainDomain: dominio principale (fallback se manca url)
 *  - forms:      array di form strutturati
 *  - iframes:    array di iframe strutturati
 *  - includeSnippets: se true, include estratti di codice/HTML nei findings
 *
 * Output:
 *  {
 *    ok: true|false,
 *    pageUrl: string,
 *    totalFindings: number,
 *    stats: { high, medium, low },
 *    summary: { scripts, forms, iframes, html },
 *    findings: [ ... ]
 *  }
 */
async function resolveAnalyzer({
  url = '',
  scripts = [],
  html = '',
  mainDomain = null,
  forms = [],
  iframes = [],
  includeSnippets = false,
}) {
  try {
    const engine = new sastEngine({ includeSnippets });

    // pageUrl servirà per collegare HTML / Request / Finding nell'ontologia
    const pageUrl = url || mainDomain || '';

    const findings = await engine.scanCode(
      scripts,
      html,
      pageUrl,
      forms,
      iframes
    );

    const stats = { high: 0, medium: 0, low: 0 };
    for (const f of findings) {
      if (f.severity && stats[f.severity] !== undefined) stats[f.severity]++;
    }

    const summary = { scripts: 0, forms: 0, iframes: 0, html: 0 };
    for (const f of findings) {
      const type = f.contextVector?.type;
      if (type === 'script') summary.scripts++;
      else if (type === 'iframe') summary.iframes++;
      else if (type === 'form') summary.forms++;
      else if (type === 'html' || type === 'html-inline-handler') summary.html++;
    }

    log.info('Analyzer completed', {
      pageUrl,
      findings: findings.length,
      high: stats.high,
      medium: stats.medium,
      low: stats.low,
      summary,
      snippets: includeSnippets ? 'included' : 'disabled',
    });

    return {
      ok: true,
      pageUrl,
      totalFindings: findings.length,
      stats,
      summary,
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
