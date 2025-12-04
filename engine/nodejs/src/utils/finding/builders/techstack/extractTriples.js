// @ts-check

const { EX } = require('../../../constants');
const { escapeStringLiteral } = require('../../../strings/escape');
const {
  iriCve,
  iriCpe,
  iriHeader,
  iriCookie,
  extractCveIdFromFinding,
  normalizeSeverity,
} = require('../common');

/**
 * @typedef {import('../../../_types/finding/builders/techstack/types').TechstackFinding} TechstackFinding
 */

/**
 * Add Techstack-specific triples (Technology / WAF / Header / Cookie) to a finding.
 *
 * @param {string[]} triples
 * @param {string} findingIri
 * @param {TechstackFinding|any} f
 */
function addTechstackTriples(triples, findingIri, f) {
  const ev = f?.evidence || {};
  const kind = f?.kind || null;

  // Always type as TechstackScan (subclass of Scan)
  triples.push(`${findingIri} a <${EX}TechstackScan> .`);

  // More specific classes (all exist in the ontology)
  if (kind === 'TechnologyCVE' || kind === 'WafCVE') {
    triples.push(`${findingIri} a <${EX}SoftwareFinding> .`);
  } else if (kind === 'HeaderIssue') {
    triples.push(`${findingIri} a <${EX}HeaderFinding> .`);
  } else if (kind === 'CookieIssue') {
    triples.push(`${findingIri} a <${EX}CookieFinding> .`);
  }

  // ===========================================================================
  // Technology / WAF → CPE / CVE wiring
  // ===========================================================================

  if (ev.type === 'Technology' || ev.type === 'WAF') {
    if (ev.name) {
      triples.push(
        `${findingIri} <${EX}technologyName> "${escapeStringLiteral(String(ev.name))}" .`
      );
    }
    if (ev.version) {
      triples.push(
        `${findingIri} <${EX}technologyVersion> "${escapeStringLiteral(String(ev.version))}" .`
      );
    }

    // CPE as literal on the finding (backwards compatibility)
    if (Array.isArray(ev.cpe)) {
      ev.cpe.forEach((cpe) => {
        triples.push(`${findingIri} <${EX}cpe> "${escapeStringLiteral(String(cpe))}" .`);
      });
    }

    // If we can derive a CVE id, build CPE / CVE individuals
    const cveId = extractCveIdFromFinding(f);
    if (cveId) {
      const cveIri = `<${iriCve(cveId)}>`;
      const sevNorm = normalizeSeverity(f.severity);

      // CVE individual (CVE ⊑ Vulnerabilities)
      triples.push(
        `${cveIri} a <${EX}CVE> .`,
        `${cveIri} <${EX}cveId> "${escapeStringLiteral(cveId)}" .`
      );

      if (typeof f.score === 'number') {
        triples.push(
          `${cveIri} <${EX}cvssScore> "${f.score}"^^<http://www.w3.org/2001/XMLSchema#float> .`
        );
      }

      if (sevNorm && sevNorm !== 'UNKNOWN') {
        triples.push(`${cveIri} <${EX}cvssSeverity> "${escapeStringLiteral(sevNorm)}" .`);
      }

      // Finding → CVE as vulnerability type
      triples.push(`${findingIri} <${EX}aboutVulnerabilityType> ${cveIri} .`);

      // CPE individuals + platformHasVulnerability (CPE → CVE)
      if (Array.isArray(ev.cpe)) {
        ev.cpe.forEach((cpe) => {
          const cpeIri = `<${iriCpe(cpe)}>`;
          triples.push(
            `${cpeIri} a <${EX}CPE> .`,
            `${cpeIri} <http://www.w3.org/2000/01/rdf-schema#label> "${escapeStringLiteral(
              String(cpe)
            )}" .`,
            `${cpeIri} <${EX}platformHasVulnerability> ${cveIri} .`
          );
        });
      }
    }
  }

  // ===========================================================================
  // Header findings → HeaderFinding + refersToHeader
  // ===========================================================================

  if (ev.type === 'Header') {
    if (ev.header) {
      // Direct info on finding (backwards compat)
      triples.push(`${findingIri} <${EX}headerName> "${escapeStringLiteral(String(ev.header))}" .`);

      // MessageHeader individual + link refersToHeader
      const headerIri = `<${iriHeader(ev.header)}>`;
      triples.push(
        `${headerIri} a <${EX}MessageHeader> .`,
        `${headerIri} <${EX}fieldName> "${escapeStringLiteral(String(ev.header))}" .`,
        `${findingIri} <${EX}refersToHeader> ${headerIri} .`
      );
    }

    if (Array.isArray(ev.urls)) {
      ev.urls.forEach((u) => {
        triples.push(`${findingIri} <${EX}headerUrl> "${escapeStringLiteral(String(u))}" .`);
      });
    }
  }

  // ===========================================================================
  // Cookie findings → CookieFinding + refersToCookie
  // ===========================================================================

  if (ev.type === 'Cookie') {
    // Direct info on the finding (backwards compat)
    if (ev.name) {
      triples.push(`${findingIri} <${EX}cookieName> "${escapeStringLiteral(String(ev.name))}" .`);
    }
    if (ev.domain) {
      triples.push(
        `${findingIri} <${EX}cookieDomain> "${escapeStringLiteral(String(ev.domain))}" .`
      );
    }
    if (ev.path) {
      triples.push(`${findingIri} <${EX}cookiePath> "${escapeStringLiteral(String(ev.path))}" .`);
    }
    if (ev.flags) {
      if (typeof ev.flags.secure === 'boolean') {
        triples.push(
          `${findingIri} <${EX}cookieSecure> "${ev.flags.secure}"^^<http://www.w3.org/2001/XMLSchema#boolean> .`
        );
      }
      if (typeof ev.flags.httpOnly === 'boolean') {
        triples.push(
          `${findingIri} <${EX}cookieHttpOnly> "${ev.flags.httpOnly}"^^<http://www.w3.org/2001/XMLSchema#boolean> .`
        );
      }
      if (ev.flags.sameSite) {
        triples.push(
          `${findingIri} <${EX}cookieSameSite> "${escapeStringLiteral(
            String(ev.flags.sameSite)
          )}" .`
        );
      }
    }
    if (ev.expirationDate) {
      triples.push(
        `${findingIri} <${EX}cookieExpiration> "${ev.expirationDate}"^^<http://www.w3.org/2001/XMLSchema#double> .`
      );
    }

    // Cookie individual + refersToCookie
    const cookieIri = `<${iriCookie(ev.domain, ev.path, ev.name)}>`;
    triples.push(`${cookieIri} a <${EX}Cookie> .`);

    if (ev.name) {
      triples.push(`${cookieIri} <${EX}cookieName> "${escapeStringLiteral(String(ev.name))}" .`);
    }
    if (ev.domain) {
      triples.push(
        `${cookieIri} <${EX}cookieDomain> "${escapeStringLiteral(String(ev.domain))}" .`
      );
    }
    if (ev.path) {
      triples.push(`${cookieIri} <${EX}cookiePath> "${escapeStringLiteral(String(ev.path))}" .`);
    }
    if (ev.flags) {
      if (typeof ev.flags.secure === 'boolean') {
        triples.push(
          `${cookieIri} <${EX}cookieSecure> "${ev.flags.secure}"^^<http://www.w3.org/2001/XMLSchema#boolean> .`
        );
      }
      if (typeof ev.flags.httpOnly === 'boolean') {
        triples.push(
          `${cookieIri} <${EX}cookieHttpOnly> "${ev.flags.httpOnly}"^^<http://www.w3.org/2001/XMLSchema#boolean> .`
        );
      }
      if (ev.flags.sameSite) {
        triples.push(
          `${cookieIri} <${EX}cookieSameSite> "${escapeStringLiteral(String(ev.flags.sameSite))}" .`
        );
      }
    }
    if (ev.expirationDate) {
      triples.push(
        `${cookieIri} <${EX}cookieExpiration> "${ev.expirationDate}"^^<http://www.w3.org/2001/XMLSchema#double> .`
      );
    }

    triples.push(`${findingIri} <${EX}refersToCookie> ${cookieIri} .`);
  }

  // Generic evidence.type on the finding
  if (ev.type) {
    triples.push(`${findingIri} <${EX}evidenceType> "${escapeStringLiteral(String(ev.type))}" .`);
  }
}

module.exports = { addTechstackTriples };
