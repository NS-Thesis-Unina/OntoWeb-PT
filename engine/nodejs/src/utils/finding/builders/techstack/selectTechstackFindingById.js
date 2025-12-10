// @ts-check

const { EX, G_FINDINGS } = require('../../../constants');
const { escapeStr } = require('../../../strings/escape');
const { normalizeFindingIri } = require('../helpers/normalizeFindingIri');

/** @typedef {import('../../../_types/finding/builders/techstack/types').TechstackFindingByIdParams} TechstackFindingByIdParams */

/**
 * Build a SPARQL SELECT query that returns all relevant details for a single
 * TechstackFinding finding identified by its IRI/URN, including:
 *
 *  - Generic finding metadata (severity, category, rule, description, remediation)
 *  - Evidence type (Technology/WAF/Header/Cookie)
 *  - Technology/WAF data (name, version, CPE, CVE)
 *  - Header evidence (header name and URLs)
 *  - Cookie evidence (cookie individual and properties)
 *
 * @param {TechstackFindingByIdParams} params - Builder parameters.
 * @returns {string} A SPARQL SELECT query ready to be executed on GraphDB.
 */
function buildSelectTechstackFindingById({ id }) {
  // Normalize the IRI so it matches the storage format in GraphDB
  const normalized = normalizeFindingIri(String(id));
  const iri = escapeStr(normalized);

  return `
PREFIX ex: <${EX}>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT
  ?id
  ?resolver
  ?vulnType
  ?severity
  ?findingCategory
  ?mainDomain
  ?owaspCategory
  ?ruleId
  ?description
  ?remediation
  ?evidenceType
  ?technologyName
  ?technologyVersion
  ?cpeLiteral
  ?cveIri
  ?cveId
  ?cvssScore
  ?cvssSeverity
  ?cpeIri
  ?cpeLabel
  ?headerIri
  ?headerFieldName
  ?headerName
  ?headerUrl
  ?cookieIri
  ?cookieName
  ?cookieDomain
  ?cookiePath
  ?cookieSecure
  ?cookieHttpOnly
  ?cookieSameSite
  ?cookieExpiration
WHERE {
  GRAPH <${G_FINDINGS}> {
    BIND(IRI("${iri}") AS ?finding)
    ?finding a ex:TechstackFinding .
    BIND(STR(?finding) AS ?id)

    OPTIONAL { ?finding ex:detectedByResolver     ?resolver . }
    OPTIONAL { ?finding ex:aboutVulnerabilityType ?vulnType . }

    OPTIONAL { ?finding ex:severity           ?severity . }
    OPTIONAL { ?finding ex:findingCategory    ?findingCategory . }
    OPTIONAL { ?finding ex:mainDomain         ?mainDomain . }
    OPTIONAL { ?finding ex:owaspCategory      ?owaspCategory . }
    OPTIONAL { ?finding ex:findingRuleId      ?ruleId . }
    OPTIONAL { ?finding ex:findingDescription ?description . }
    OPTIONAL { ?finding ex:remediation        ?remediation . }
    OPTIONAL { ?finding ex:evidenceType       ?evidenceType . }

    # Technology / WAF evidence on the finding
    OPTIONAL { ?finding ex:technologyName    ?technologyName . }
    OPTIONAL { ?finding ex:technologyVersion ?technologyVersion . }
    OPTIONAL { ?finding ex:cpe               ?cpeLiteral . }

    # CVE individual as vulnerability type
    OPTIONAL {
      ?finding ex:aboutVulnerabilityType ?cveIri .
      OPTIONAL { ?cveIri ex:cveId        ?cveId . }
      OPTIONAL { ?cveIri ex:cvssScore    ?cvssScore . }
      OPTIONAL { ?cveIri ex:cvssSeverity ?cvssSeverity . }

      # CPE individuals linked via platformHasVulnerability
      OPTIONAL {
        ?cpeIri ex:platformHasVulnerability ?cveIri .
        OPTIONAL { ?cpeIri rdfs:label ?cpeLabel . }
      }
    }

    # Header evidence
    OPTIONAL {
      ?finding ex:refersToHeader ?headerIri .
      OPTIONAL { ?headerIri ex:fieldName ?headerFieldName . }
      OPTIONAL { ?finding     ex:headerName ?headerName . }
      OPTIONAL { ?finding     ex:headerUrl  ?headerUrl . }
    }

    # Cookie evidence
    OPTIONAL {
      ?finding ex:refersToCookie ?cookieIri .
      OPTIONAL { ?cookieIri ex:cookieName      ?cookieName . }
      OPTIONAL { ?cookieIri ex:cookieDomain    ?cookieDomain . }
      OPTIONAL { ?cookieIri ex:cookiePath      ?cookiePath . }
      OPTIONAL { ?cookieIri ex:cookieSecure    ?cookieSecure . }
      OPTIONAL { ?cookieIri ex:cookieHttpOnly  ?cookieHttpOnly . }
      OPTIONAL { ?cookieIri ex:cookieSameSite  ?cookieSameSite . }
      OPTIONAL { ?cookieIri ex:cookieExpiration ?cookieExpiration . }
    }
  }
}
`.trim();
}

module.exports = buildSelectTechstackFindingById;
