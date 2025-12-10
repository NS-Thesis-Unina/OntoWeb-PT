// @ts-check

/** @typedef {import('../../../_types/graphdb/types').SparqlBindingCell} SparqlBindingCell */
/** @typedef {import('../../../_types/finding/bindings/types').SparqlBindingRow} SparqlBindingRow */
/** @typedef {import('../../../_types/finding/bindings/techstack/types').TechstackCveSummary} TechstackCveSummary */
/** @typedef {import('../../../_types/finding/bindings/techstack/types').TechstackSoftwareEvidence} TechstackSoftwareEvidence */
/** @typedef {import('../../../_types/finding/bindings/techstack/types').TechstackHeaderEvidence} TechstackHeaderEvidence */
/** @typedef {import('../../../_types/finding/bindings/techstack/types').TechstackCookieEvidence} TechstackCookieEvidence */
/** @typedef {import('../../../_types/finding/bindings/techstack/types').TechstackFindingDetail} TechstackFindingDetail */

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
 * Transform SPARQL JSON bindings into a single detailed TechstackFinding object.
 *
 * The query is expected to return multiple rows for the same finding (due to
 * software CVE/CPE, header URLs, cookies), so this function aggregates them:
 *
 *  - Scalar fields (severity, description, etc.) are taken from the first
 *    row where they appear.
 *  - Software evidence aggregates CPE and CVE information.
 *  - Header evidence aggregates all header URLs.
 *  - Cookie evidence is normalized into an array of cookie items.
 *
 * @param {SparqlBindingRow[]} bindings - SPARQL JSON `results.bindings` array.
 * @returns {TechstackFindingDetail | null} The normalized finding object, or null if not found.
 */
function bindingsToTechstackFindingDetail(bindings) {
  if (!bindings || bindings.length === 0) return null;

  /** @type {TechstackFindingDetail} */
  const result = {
    id: '',
  };

  /** @type {Set<string>} */
  const softwareCpeSet = new Set();

  /** @type {Map<string, TechstackCveSummary>} */
  const softwareCveMap = new Map();

  /** @type {Map<string, TechstackCookieEvidence>} */
  const cookieMap = new Map();

  for (const row of bindings) {
    const id = valueOf(row.id);
    if (!id) continue;

    if (!result.id) {
      result.id = id;
    }

    // === Scalar fields ===
    const resolver = valueOf(row.resolver);
    const vulnType = valueOf(row.vulnType);
    const severity = valueOf(row.severity);
    const findingCategory = valueOf(row.findingCategory);
    const mainDomain = valueOf(row.mainDomain);
    const owaspCategory = valueOf(row.owaspCategory);
    const ruleId = valueOf(row.ruleId);
    const description = valueOf(row.description);
    const remediation = valueOf(row.remediation);
    const evidenceType = valueOf(row.evidenceType);

    if (resolver && !result.resolver) result.resolver = resolver;
    if (vulnType && !result.vulnerabilityType) result.vulnerabilityType = vulnType;
    if (severity && !result.severity) result.severity = severity;
    if (findingCategory && !result.findingCategory) {
      result.findingCategory = findingCategory;
    }
    if (mainDomain && !result.mainDomain) {
      result.mainDomain = mainDomain;
    }
    if (owaspCategory && !result.owaspCategory) {
      result.owaspCategory = owaspCategory;
    }
    if (ruleId && !result.ruleId) result.ruleId = ruleId;
    if (description && !result.description) result.description = description;
    if (remediation && !result.remediation) result.remediation = remediation;
    if (evidenceType && !result.evidenceType) result.evidenceType = evidenceType;

    // === Software evidence (Technology / WAF) ===
    const technologyName = valueOf(row.technologyName);
    const technologyVersion = valueOf(row.technologyVersion);
    const cpeLiteral = valueOf(row.cpeLiteral);
    const cveIri = valueOf(row.cveIri);
    const cveId = valueOf(row.cveId);
    const cvssScore = valueOf(row.cvssScore);
    const cvssSeverity = valueOf(row.cvssSeverity);
    const cpeLabel = valueOf(row.cpeLabel);

    if (evidenceType === 'Technology' || evidenceType === 'WAF') {
      result.software ||= {};
      if (evidenceType && !result.software.type) {
        result.software.type = evidenceType;
      }
      if (technologyName && !result.software.name) {
        result.software.name = technologyName;
      }
      if (technologyVersion && !result.software.version) {
        result.software.version = technologyVersion;
      }

      if (cpeLiteral) softwareCpeSet.add(cpeLiteral);
      if (cpeLabel) softwareCpeSet.add(cpeLabel);

      if (cveIri) {
        let cve = softwareCveMap.get(cveIri);
        if (!cve) {
          cve = { iri: cveIri };
          softwareCveMap.set(cveIri, cve);
        }
        if (cveId && !cve.id) cve.id = cveId;
        if (cvssSeverity && !cve.severity) cve.severity = cvssSeverity;
        if (cvssScore !== undefined && cve.score === undefined) {
          const n = Number(cvssScore);
          if (!Number.isNaN(n)) cve.score = n;
        }
      }
    }

    // === Header evidence ===
    const headerName = valueOf(row.headerName);
    const headerFieldName = valueOf(row.headerFieldName);
    const headerUrl = valueOf(row.headerUrl);

    if (evidenceType === 'Header') {
      result.header ||= { urls: [] };

      const name = headerName || headerFieldName;
      if (name && !result.header.name) {
        result.header.name = name;
      }

      if (headerUrl && !result.header.urls.includes(headerUrl)) {
        result.header.urls.push(headerUrl);
      }
    }

    // === Cookie evidence ===
    const cookieIri = valueOf(row.cookieIri);
    const cookieName = valueOf(row.cookieName);
    const cookieDomain = valueOf(row.cookieDomain);
    const cookiePath = valueOf(row.cookiePath);
    const cookieSecure = valueOf(row.cookieSecure);
    const cookieHttpOnly = valueOf(row.cookieHttpOnly);
    const cookieSameSite = valueOf(row.cookieSameSite);
    const cookieExpiration = valueOf(row.cookieExpiration);

    if (evidenceType === 'Cookie' && cookieIri) {
      let cookie = cookieMap.get(cookieIri);
      if (!cookie) {
        cookie = { iri: cookieIri };
        cookieMap.set(cookieIri, cookie);
      }

      if (cookieName && !cookie.name) cookie.name = cookieName;
      if (cookieDomain && !cookie.domain) cookie.domain = cookieDomain;
      if (cookiePath && !cookie.path) cookie.path = cookiePath;

      if (cookieSecure && cookie.secure === undefined) {
        cookie.secure = cookieSecure === 'true' || cookieSecure === '1';
      }
      if (cookieHttpOnly && cookie.httpOnly === undefined) {
        cookie.httpOnly = cookieHttpOnly === 'true' || cookieHttpOnly === '1';
      }
      if (cookieSameSite && !cookie.sameSite) cookie.sameSite = cookieSameSite;

      if (cookieExpiration && cookie.expiration === undefined) {
        const n = Number(cookieExpiration);
        if (!Number.isNaN(n)) cookie.expiration = n;
      }
    }
  }

  // Finalize software evidence
  if (result.software) {
    const cpeArray = Array.from(softwareCpeSet);
    if (cpeArray.length > 0) {
      result.software.cpe = cpeArray;
    }

    const cveArray = Array.from(softwareCveMap.values());
    if (cveArray.length > 0) {
      cveArray.sort((a, b) => a.iri.localeCompare(b.iri));
      result.software.cve = cveArray;
    }

    // Remove empty software object
    if (
      !result.software.type &&
      !result.software.name &&
      !result.software.version &&
      (!result.software.cpe || result.software.cpe.length === 0) &&
      (!result.software.cve || result.software.cve.length === 0)
    ) {
      delete result.software;
    }
  }

  // Finalize cookies array
  const cookiesArray = Array.from(cookieMap.values());
  if (cookiesArray.length > 0) {
    cookiesArray.sort((a, b) => a.iri.localeCompare(b.iri));
    result.cookies = cookiesArray;
  }

  // Cleanup scalar fields with no value
  if (!result.resolver) delete result.resolver;
  if (!result.vulnerabilityType) delete result.vulnerabilityType;
  if (!result.severity) delete result.severity;
  if (!result.findingCategory) delete result.findingCategory;
  if (!result.mainDomain) delete result.mainDomain;
  if (!result.owaspCategory) delete result.owaspCategory;
  if (!result.ruleId) delete result.ruleId;
  if (!result.description) delete result.description;
  if (!result.remediation) delete result.remediation;
  if (!result.evidenceType) delete result.evidenceType;

  if (result.header) {
    if (!result.header.name) delete result.header.name;
    if (!result.header.urls || result.header.urls.length === 0) delete result.header.urls;
    if (Object.keys(result.header).length === 0) {
      delete result.header;
    }
  }

  if (!result.cookies || result.cookies.length === 0) {
    delete result.cookies;
  }

  if (!result.id) return null;
  return result;
}

module.exports = bindingsToTechstackFindingDetail;
