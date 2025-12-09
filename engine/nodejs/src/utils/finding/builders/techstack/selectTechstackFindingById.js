// @ts-check

const { EX, G_FINDINGS } = require('../../../constants');
const { escapeStr } = require('../../../strings/escape');
const { normalizeFindingIri } = require('../helpers/normalizeFindingIri');

/** @typedef {import('../../../_types/finding/builders/techstack/types').TechstackFindingByIdParams} TechstackFindingByIdParams */

/**
 * Build a SPARQL SELECT query that returns all relevant details for a single
 * TechstackScan finding identified by its IRI/URN, including:
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
    BIND(IRI("${iri}") AS ?scan)
    ?scan a ex:TechstackScan .
    BIND(STR(?scan) AS ?id)

    OPTIONAL { ?scan ex:detectedByResolver     ?resolver . }
    OPTIONAL { ?scan ex:aboutVulnerabilityType ?vulnType . }

    OPTIONAL { ?scan ex:severity           ?severity . }
    OPTIONAL { ?scan ex:findingCategory    ?findingCategory . }
    OPTIONAL { ?scan ex:mainDomain         ?mainDomain . }
    OPTIONAL { ?scan ex:owaspCategory      ?owaspCategory . }
    OPTIONAL { ?scan ex:findingRuleId      ?ruleId . }
    OPTIONAL { ?scan ex:findingDescription ?description . }
    OPTIONAL { ?scan ex:remediation        ?remediation . }
    OPTIONAL { ?scan ex:evidenceType       ?evidenceType . }

    # Technology / WAF evidence on the finding
    OPTIONAL { ?scan ex:technologyName    ?technologyName . }
    OPTIONAL { ?scan ex:technologyVersion ?technologyVersion . }
    OPTIONAL { ?scan ex:cpe               ?cpeLiteral . }

    # CVE individual as vulnerability type
    OPTIONAL {
      ?scan ex:aboutVulnerabilityType ?cveIri .
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
      ?scan ex:refersToHeader ?headerIri .
      OPTIONAL { ?headerIri ex:fieldName ?headerFieldName . }
      OPTIONAL { ?scan     ex:headerName ?headerName . }
      OPTIONAL { ?scan     ex:headerUrl  ?headerUrl . }
    }

    # Cookie evidence
    OPTIONAL {
      ?scan ex:refersToCookie ?cookieIri .
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
