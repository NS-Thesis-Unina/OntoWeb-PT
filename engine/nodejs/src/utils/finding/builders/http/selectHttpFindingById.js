// @ts-check

const { EX, G_FINDINGS } = require('../../../constants');
const { escapeStr } = require('../../../strings/escape');
const { normalizeFindingIri } = require('../helpers/normalizeFindingIri');

/** @typedef {import('../../../_types/finding/builders/http/types').HttpFindingByIdParams} HttpFindingByIdParams */

/**
 * Build a SPARQL SELECT query that returns all relevant details for a single
 * HttpFinding identified by its IRI/URN.
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
    BIND(IRI("${iri}") AS ?finding)
    ?finding a ex:HttpFinding .
    BIND(STR(?finding) AS ?id)

    OPTIONAL { ?finding ex:detectedByResolver     ?resolver . }
    OPTIONAL { ?finding ex:aboutVulnerabilityType ?vulnType . }
    OPTIONAL { ?finding ex:severity               ?severity . }
    OPTIONAL { ?finding ex:findingCategory        ?findingCategory . }
    OPTIONAL { ?finding ex:owaspCategory          ?owaspCategory . }
    OPTIONAL { ?finding ex:findingRuleId          ?ruleId . }
    OPTIONAL { ?finding ex:findingDescription     ?description . }
    OPTIONAL { ?finding ex:remediation            ?remediation . }
    OPTIONAL { ?finding ex:httpMethod             ?httpMethod . }
    OPTIONAL { ?finding ex:requestUrl             ?requestUrl . }
    OPTIONAL { ?finding ex:responseStatus         ?responseStatus . }

    # Linked HTTP entities (Request, Response, headers, URI, etc.)
    OPTIONAL { ?finding ex:relatedToHTTP ?relatedHttp . }
  }
}
`.trim();
}

module.exports = buildSelectHttpFindingById;
