// @ts-check

const { sastEngine } = require('../analyzer/sast/sastEngine');
const { makeLogger } = require('../../logs/logger');
const log = makeLogger('resolver:analyzer');

/** @typedef {import('../../_types/resolvers/analyzer/types').AnalyzerResolveInput} AnalyzerResolveInput */
/** @typedef {import('../../_types/resolvers/analyzer/types').AnalyzerResolveResult} AnalyzerResolveResult */
/** @typedef {import('../../_types/resolvers/analyzer/types').AnalyzerFinding} AnalyzerFinding */

/**
 * Analyzer resolver (SAST) entrypoint.
 *
 * Responsibilities:
 * - Instantiate the SAST engine with the requested options.
 * - Run the analysis over HTML, scripts, forms and iframes.
 * - Aggregate statistics by severity and context (scripts/forms/iframes/html).
 * - Log a compact summary and return a normalized result payload.
 *
 * Input:
 *  - url:        full page URL
 *  - scripts:    [{ code?: string, src?: string }, ...]
 *  - html:       full HTML string
 *  - mainDomain: main domain (fallback when url is missing)
 *  - forms:      structured forms array
 *  - iframes:    structured iframes array
 *  - includeSnippets: if true, include JS/HTML snippets in findings
 *
 * Output (success):
 *  {
 *    ok: true,
 *    pageUrl: string,
 *    totalFindings: number,
 *    stats: { high, medium, low },
 *    summary: { scripts, forms, iframes, html },
 *    findings: AnalyzerFinding[]
 *  }
 *
 * Output (failure):
 *  { ok: false, error: string }
 *
 * @param {AnalyzerResolveInput} param0
 * @returns {Promise<AnalyzerResolveResult>}
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

    // pageUrl is used to link HTML / Request / Finding in the ontology
    const pageUrl = url || mainDomain || '';

    /** @type {AnalyzerFinding[]} */
    const findings = await engine.scanCode(scripts, html, pageUrl, forms, iframes);

    const stats = { high: 0, medium: 0, low: 0 };
    for (const f of findings) {
      if (f.severity && stats[/** @type {'high'|'medium'|'low'} */ (f.severity)] !== undefined) {
        // @ts-ignore - runtime guard above
        stats[f.severity]++;
      }
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
    const msg = /** @type {any} */ (err)?.message || String(err);
    log.error('Analyzer failed', msg);
    return {
      ok: false,
      error: msg || 'Analyzer execution failed',
    };
  }
}

module.exports = { resolveAnalyzer };
