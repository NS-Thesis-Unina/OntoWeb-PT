// @ts-check

/** @typedef {import('../../../_types/graphdb/types').SparqlBindingCell} SparqlBindingCell */
/** @typedef {import('../../../_types/finding/bindings/types').SparqlBindingRow} SparqlBindingRow */
/** @typedef {import('../../../_types/finding/bindings/http/types').HttpFindingDetail} HttpFindingDetail */

/**
 * Extract raw value from a SPARQL binding cell.
 *
 * @param {SparqlBindingCell | undefined} cell
 * @returns {string | undefined}
 */
function valueOf(cell) {
  if (!cell) return undefined;
  if (Object.prototype.hasOwnProperty.call(cell, 'value')) return String(cell.value);
  return undefined;
}

/**
 * Transform SPARQL JSON bindings into a single detailed HttpScan finding object.
 *
 * The query is expected to return multiple rows for the same finding (one per
 * related HTTP entity), so this function aggregates them:
 *
 *  - Scalar fields (severity, description, etc.) are taken from the first
 *    row where they appear.
 *  - `relatedHttp` is accumulated as an array of distinct IRIs.
 *
 * @param {SparqlBindingRow[]} bindings - SPARQL JSON `results.bindings` array.
 * @returns {HttpFindingDetail | null} The normalized finding object, or null if not found.
 */
function bindingsToHttpFindingDetail(bindings) {
  if (!bindings || bindings.length === 0) return null;

  /** @type {HttpFindingDetail} */
  const result = {
    id: '',
    relatedHttp: [],
  };

  const relatedSet = new Set();

  for (const row of bindings) {
    const id = valueOf(row.id);
    if (!id) continue;

    if (!result.id) {
      result.id = id;
    }

    const resolver = valueOf(row.resolver);
    const vulnType = valueOf(row.vulnType);
    const severity = valueOf(row.severity);
    const category = valueOf(row.findingCategory);
    const owasp = valueOf(row.owaspCategory);
    const ruleId = valueOf(row.ruleId);
    const description = valueOf(row.description);
    const remediation = valueOf(row.remediation);
    const httpMethod = valueOf(row.httpMethod);
    const requestUrl = valueOf(row.requestUrl);
    const responseStatus = valueOf(row.responseStatus);
    const relatedHttp = valueOf(row.relatedHttp);

    if (resolver && !result.resolver) result.resolver = resolver;
    if (vulnType && !result.vulnerabilityType) result.vulnerabilityType = vulnType;
    if (severity && !result.severity) result.severity = severity;
    if (category && !result.findingCategory) result.findingCategory = category;
    if (owasp && !result.owaspCategory) result.owaspCategory = owasp;
    if (ruleId && !result.ruleId) result.ruleId = ruleId;
    if (description && !result.description) result.description = description;
    if (remediation && !result.remediation) result.remediation = remediation;

    if (httpMethod || requestUrl || responseStatus) {
      result.http ||= {};
      if (httpMethod && !result.http.method) result.http.method = httpMethod;
      if (requestUrl && !result.http.url) result.http.url = requestUrl;
      if (responseStatus !== undefined && result.http.status === undefined) {
        const n = Number(responseStatus);
        if (!Number.isNaN(n)) result.http.status = n;
      }
    }

    if (relatedHttp) {
      if (!relatedSet.has(relatedHttp)) {
        relatedSet.add(relatedHttp);
        result.relatedHttp.push(relatedHttp);
      }
    }
  }

  // Cleanup empty fields
  if (!result.resolver) delete result.resolver;
  if (!result.vulnerabilityType) delete result.vulnerabilityType;
  if (!result.severity) delete result.severity;
  if (!result.findingCategory) delete result.findingCategory;
  if (!result.owaspCategory) delete result.owaspCategory;
  if (!result.ruleId) delete result.ruleId;
  if (!result.description) delete result.description;
  if (!result.remediation) delete result.remediation;
  if (result.http) {
    if (!result.http.method) delete result.http.method;
    if (!result.http.url) delete result.http.url;
    if (result.http.status === undefined) delete result.http.status;
    if (Object.keys(result.http).length === 0) delete result.http;
  }
  if (!result.relatedHttp || result.relatedHttp.length === 0) {
    delete result.relatedHttp;
  }

  if (!result.id) return null;
  return result;
}

module.exports = bindingsToHttpFindingDetail;
