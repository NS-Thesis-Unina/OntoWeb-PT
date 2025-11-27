// @ts-check

/**
 * Single script captured from the page (inline or external).
 *
 * @typedef {Object} AnalyzerScriptInput
 * @property {string} [code] - Inline script source code.
 * @property {string} [src] - External script URL.
 * @property {string} [type] - Optional type attribute.
 * @property {boolean} [async] - Whether the script is async.
 * @property {boolean} [defer] - Whether the script is deferred.
 */

/**
 * Single HTML form field description.
 *
 * @typedef {Object} AnalyzerFormFieldInput
 * @property {string} [name]
 * @property {string} [type]
 * @property {string} [id]
 * @property {string} [value]
 * @property {string} [tag]
 */

/**
 * Structured HTML form used by the analyzer.
 *
 * @typedef {Object} AnalyzerFormInput
 * @property {string} [action]
 * @property {string} [method]
 * @property {Array<string|AnalyzerFormFieldInput>} [inputs]
 */

/**
 * Structured iframe descriptor.
 *
 * @typedef {Object} AnalyzerIframeInput
 * @property {string} [src]
 * @property {string} [title]
 * @property {string} [sandbox]
 * @property {string} [allow]
 */

/**
 * Severity levels used by the analyzer findings.
 *
 * @typedef {'high'|'medium'|'low'|'info'|'unknown'} AnalyzerSeverity
 */

/**
 * Location expressed as character offsets in the HTML text.
 *
 * @typedef {Object} AnalyzerOffsetLocation
 * @property {number} start
 * @property {number} end
 */

/**
 * Location expressed as line/column ranges in JavaScript sources.
 *
 * @typedef {Object} AnalyzerLineColumnLocation
 * @property {{ line: number, column: number }} start
 * @property {{ line: number, column: number }} end
 */

/**
 * Union of all supported location shapes.
 *
 * @typedef {AnalyzerOffsetLocation | AnalyzerLineColumnLocation} AnalyzerLocation
 */

/**
 * High-level context of where a finding was detected.
 *
 * @typedef {Object} AnalyzerContextVector
 * @property {'script'|'iframe'|'form'|'html'|'html-inline-handler'|'unknown'} type
 * @property {number|null} [index]
 * @property {'external'|'inline'|'markup'|null} [origin]
 * @property {string|null} [src]
 * @property {string|null} [title]
 * @property {string|null} [action]
 * @property {string|null} [method]
 * @property {string[]} [inputs]
 */

/**
 * Simple name/value HTML attribute.
 *
 * @typedef {Object} AnalyzerHtmlAttribute
 * @property {string} name
 * @property {string} value
 */

/**
 * Structured reference to a single HTML field (input, textarea, etc.).
 *
 * @typedef {Object} AnalyzerHtmlFieldRef
 * @property {string} tag
 * @property {string|null} [name]
 * @property {string|null} [type]
 * @property {AnalyzerHtmlAttribute[]} [attributes]
 */

/**
 * Structured reference to an HTML tag and its relevant fields, aligned with the ontology
 * (HTML / Tag / Field).
 *
 * @typedef {Object} AnalyzerHtmlRef
 * @property {'form'|'iframe'|'script'|'html'|'html-inline-handler'|'unknown'} type
 * @property {string} tag
 * @property {number|null} [index]
 * @property {AnalyzerHtmlAttribute[]} [attributes]
 * @property {AnalyzerHtmlFieldRef[]} [fields]
 */

/**
 * Core analyzer finding structure produced by SAST rules.
 *
 * Note: this is intentionally flexible; additional properties from rules
 * (e.g. sourceFile, sourceLoc, sinkFile, sinkLoc, etc.) are allowed.
 *
 * @typedef {Object} AnalyzerFinding
 * @property {string} [ruleId]
 * @property {string} [description]
 * @property {AnalyzerSeverity|string} [severity]
 * @property {string} [category]
 * @property {string} [owasp]
 * @property {string|null} [pageUrl]
 * @property {AnalyzerLocation} [location]
 * @property {AnalyzerContextVector} [contextVector]
 * @property {AnalyzerHtmlRef|null} [htmlRef]
 * @property {string} [findingId]
 * @property {string} [snippet]
 * @property {string} [sourceSnippet]
 * @property {string} [sinkSnippet]
 * @property {string} [file]
 * @property {Object} [meta]
 */

/**
 * Input shape accepted by the Analyzer resolver.
 *
 * @typedef {Object} AnalyzerResolveInput
 * @property {string} [url]
 * @property {AnalyzerScriptInput[]} [scripts]
 * @property {string} [html]
 * @property {string|null} [mainDomain]
 * @property {AnalyzerFormInput[]} [forms]
 * @property {AnalyzerIframeInput[]} [iframes]
 * @property {boolean} [includeSnippets]
 */

/**
 * Per-severity statistics for analyzer findings.
 *
 * @typedef {{ high: number, medium: number, low: number }} AnalyzerStats
 */

/**
 * Summary of where findings were detected (scripts/forms/iframes/html).
 *
 * @typedef {{ scripts: number, forms: number, iframes: number, html: number }} AnalyzerSummary
 */

/**
 * Successful Analyzer resolver result.
 *
 * @typedef {Object} AnalyzerResolveOk
 * @property {true} ok
 * @property {string} pageUrl
 * @property {number} totalFindings
 * @property {AnalyzerStats} stats
 * @property {AnalyzerSummary} summary
 * @property {AnalyzerFinding[]} findings
 */

/**
 * Error result returned by the Analyzer resolver.
 *
 * @typedef {Object} AnalyzerResolveError
 * @property {false} ok
 * @property {string} error
 */

/**
 * Union of all possible results returned by the Analyzer resolver.
 *
 * @typedef {AnalyzerResolveOk | AnalyzerResolveError} AnalyzerResolveResult
 */

/**
 * Options accepted by the SAST engine constructor.
 *
 * @typedef {Object} SastEngineOptions
 * @property {number} [policy]
 * @property {boolean} [includeSnippets]
 */

module.exports = {};
