// @ts-check

const { EX, G_FINDINGS } = require('../../../constants');
const { escapeStr } = require('../../../strings/escape');
const { normalizeFindingIri } = require('../helpers/normalizeFindingIri');

/** @typedef {import('../../../_types/finding/builders/analyzer/types').AnalyzerFindingByIdParams} AnalyzerFindingByIdParams */

/**
 * Build a SPARQL SELECT query that returns all relevant details for a single
 * AnalyzerFinding identified by its IRI/URN, including related HTML
 * Tag / Field structure (root tag + nested tags).
 *
 * Output variables:
 *  - ?id              → string form of the finding IRI
 *  - ?resolver        → resolver instance IRI
 *  - ?vulnType        → vulnerability type IRI (ex:aboutVulnerabilityType)
 *  - ?severity        → ex:severity
 *  - ?findingCategory → ex:findingCategory
 *  - ?mainDomain      → ex:mainDomain
 *  - ?owaspCategory   → ex:owaspCategory
 *  - ?ruleId          → ex:findingRuleId
 *  - ?description     → ex:findingDescription
 *  - ?remediation     → ex:remediation
 *  - ?contextType     → ex:contextType
 *  - ?contextIndex    → ex:contextIndex
 *  - ?contextOrigin   → ex:contextOrigin
 *  - ?contextSrc      → ex:contextSrc
 *  - ?formAction      → ex:formAction
 *  - ?formMethod      → ex:formMethod
 *  - ?codeSnippet     → ex:codeSnippet
 *  - ?htmlTag         → root Tag IRI (ex:Tag / ex:HTML)
 *  - ?htmlTagSource   → ex:sourceLocation of root Tag (outer HTML)
 *  - ?htmlField       → root Field IRI (ex:Field / ex:HTML)
 *  - ?htmlFieldSource → ex:sourceLocation of root Field (attribute snippet)
 *  - ?childTag        → nested Tag IRI (child of root Tag)
 *  - ?childTagSource  → ex:sourceLocation of nested Tag (outer HTML)
 *  - ?childField      → nested Field IRI
 *  - ?childFieldSource→ ex:sourceLocation of nested Field
 *
 * @param {AnalyzerFindingByIdParams} params - Builder parameters.
 * @returns {string} A SPARQL SELECT query ready to be executed on GraphDB.
 */
function buildSelectAnalyzerFindingById({ id }) {
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
  ?mainDomain
  ?owaspCategory
  ?ruleId
  ?description
  ?remediation
  ?contextType
  ?contextIndex
  ?contextOrigin
  ?contextSrc
  ?formAction
  ?formMethod
  ?codeSnippet
  ?htmlTag
  ?htmlTagSource
  ?htmlField
  ?htmlFieldSource
  ?childTag
  ?childTagSource
  ?childField
  ?childFieldSource
WHERE {
  GRAPH <${G_FINDINGS}> {
    BIND(IRI("${iri}") AS ?finding)
    ?finding a ex:AnalyzerFinding .
    BIND(STR(?finding) AS ?id)

    OPTIONAL { ?finding ex:detectedByResolver     ?resolver . }
    OPTIONAL { ?finding ex:aboutVulnerabilityType ?vulnType . }
    OPTIONAL { ?finding ex:severity               ?severity . }
    OPTIONAL { ?finding ex:findingCategory        ?findingCategory . }
    OPTIONAL { ?finding ex:mainDomain             ?mainDomain . }
    OPTIONAL { ?finding ex:owaspCategory          ?owaspCategory . }
    OPTIONAL { ?finding ex:findingRuleId          ?ruleId . }
    OPTIONAL { ?finding ex:findingDescription     ?description . }
    OPTIONAL { ?finding ex:remediation            ?remediation . }

    OPTIONAL { ?finding ex:contextType   ?contextType . }
    OPTIONAL { ?finding ex:contextIndex  ?contextIndex . }
    OPTIONAL { ?finding ex:contextOrigin ?contextOrigin . }
    OPTIONAL { ?finding ex:contextSrc    ?contextSrc . }

    OPTIONAL { ?finding ex:formAction    ?formAction . }
    OPTIONAL { ?finding ex:formMethod    ?formMethod . }

    OPTIONAL { ?finding ex:codeSnippet   ?codeSnippet . }

    # HTML root Tag(s) and nested structure
    OPTIONAL {
      ?finding ex:relatedToHTML ?htmlTag .

      OPTIONAL { ?htmlTag ex:sourceLocation ?htmlTagSource . }

      OPTIONAL {
        ?htmlTag ex:tagHasProperties ?htmlField .
        OPTIONAL { ?htmlField ex:sourceLocation ?htmlFieldSource . }
      }

      OPTIONAL {
        ?htmlTag ex:tagHasChildTag ?childTag .

        OPTIONAL { ?childTag ex:sourceLocation ?childTagSource . }

        OPTIONAL {
          ?childTag ex:tagHasProperties ?childField .
          OPTIONAL { ?childField ex:sourceLocation ?childFieldSource . }
        }
      }
    }
  }
}
`.trim();
}

module.exports = buildSelectAnalyzerFindingById;
