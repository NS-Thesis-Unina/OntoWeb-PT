// @ts-check

const { EX, G_FINDINGS } = require('../../../constants');
const { escapeStr } = require('../../../strings/escape');
const { normalizeFindingIri } = require('../helpers/normalizeFindingIri');

/** @typedef {import('../../../_types/finding/builders/http/types').HttpFindingByIdParams} HttpFindingByIdParams */

/**
 * Build a SPARQL SELECT query that returns all relevant details for a single
 * HttpScan finding identified by its IRI/URN.
 *
 * Output variables:
 *  - ?id                 → string form of the finding IRI
 *  - ?resolver           → resolver instance IRI
 *  - ?vulnType           → vulnerability type IRI (ex:aboutVulnerabilityType)
 *  - ?severity           → ex:severity
 *  - ?findingCategory    → ex:findingCategory
 *  - ?owaspCategory      → ex:owaspCategory
 *  - ?ruleId             → ex:findingRuleId
 *  - ?description        → ex:findingDescription
 *  - ?remediation        → ex:remediation
 *  - ?httpMethod         → ex:httpMethod
 *  - ?requestUrl         → ex:requestUrl
 *  - ?responseStatus     → ex:responseStatus
 *  - ?relatedHttp        → ex:relatedToHTTP (HTTP-related entities: Request, URI, headers, etc.)
 *
 * @param {HttpFindingByIdParams} params - Builder parameters.
 * @returns {string} A SPARQL SELECT query ready to be executed on GraphDB.
 */
function buildSelectHttpFindingById({ id }) {
  // Normalize the IRI so it matches the storage format in GraphDB
  const normalized = normalizeFindingIri(String(id));
  const iri = escapeStr(normalized);

  return `
PREFIX ex: <${EX}>

SELECT
  ?id
  ?resolver
  ?vulnType
  ?severity
  ?findingCategory
  ?owaspCategory
  ?ruleId
  ?description
  ?remediation
  ?httpMethod
  ?requestUrl
  ?responseStatus
  ?relatedHttp
WHERE {
  GRAPH <${G_FINDINGS}> {
    BIND(IRI("${iri}") AS ?scan)
    ?scan a ex:HttpScan .
    BIND(STR(?scan) AS ?id)

    OPTIONAL { ?scan ex:detectedByResolver     ?resolver . }
    OPTIONAL { ?scan ex:aboutVulnerabilityType ?vulnType . }
    OPTIONAL { ?scan ex:severity               ?severity . }
    OPTIONAL { ?scan ex:findingCategory        ?findingCategory . }
    OPTIONAL { ?scan ex:owaspCategory          ?owaspCategory . }
    OPTIONAL { ?scan ex:findingRuleId          ?ruleId . }
    OPTIONAL { ?scan ex:findingDescription     ?description . }
    OPTIONAL { ?scan ex:remediation            ?remediation . }
    OPTIONAL { ?scan ex:httpMethod             ?httpMethod . }
    OPTIONAL { ?scan ex:requestUrl             ?requestUrl . }
    OPTIONAL { ?scan ex:responseStatus         ?responseStatus . }

    # Linked HTTP entities (Request, Response, headers, URI, etc.)
    OPTIONAL { ?scan ex:relatedToHTTP ?relatedHttp . }
  }
}
`.trim();
}

module.exports = buildSelectHttpFindingById;
