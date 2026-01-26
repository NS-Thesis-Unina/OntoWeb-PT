# OOPS! Evaluation Results

| Scan date (GMT)               | Tool     | Ontology   | Highest severity | Pitfalls detected (n) | Suggestions / warnings (n) |
| ----------------------------- | -------- | ---------- | ---------------- | --------------------- | -------------------------- |
| Sun, 25 Jan 2026 14:06:48 GMT | OOPS! V2 | OntoWeb-PT | Important        | 4                     | 1                          |

| ID  | Title                                              | Severity  | Cases | Affected elements (examples)                                                                                                                  |
| --- | -------------------------------------------------- | --------- | ----: | --------------------------------------------------------------------------------------------------------------------------------------------- |
| P08 | Missing annotations                                | Minor     |   106 | `ontowebpt:Request`, `ontowebpt:Response`, `ontowebpt:URI`, `ontowebpt:Finding`, `ontowebpt:Cookie`, `ontowebpt:tagHasProperties`             |
| P11 | Missing domain or range in properties              | Important |     3 | `ontowebpt:refersToCookie`, `ontowebpt:cookieDomain`, `ontowebpt:cookieName`                                                                  |
| P13 | Inverse relationships not explicitly declared      | Minor     |    19 | `ontowebpt:uriRequest`, `ontowebpt:resp`, `ontowebpt:reqHeader`, `ontowebpt:resHeader`, `ontowebpt:tagHasChildTag`, `ontowebpt:relatedToHTTP` |
| P22 | Using different naming conventions in the ontology | Minor     |     — | Ontology-wide (naming convention not consistent)                                                                                              |

| Type        | Message (summary)                                                                 | Cases | Elements |
|-------------|------------------------------------------------------------------------------------|------:|----------|
| Suggestion  | Same domain and range for some object properties; they might be symmetric/transitive | 2     | `ontowebpt:tagHasChildTag`, `ontowebpt:htmlChild` |

| Conformance badge suggested by OOPS! | Meaning |
|-------------------------------------|---------|
| Important pitfalls                  | At least one **Important** pitfall was detected in the ontology. |

---
## Pitfall importance levels

OOPS! classifies detected pitfalls into three importance levels:
- **Critical**: Crucial to correct; otherwise it can affect ontology consistency, reasoning, and applicability.
- **Important**: Not critical for basic operation, but recommended to correct.
- **Minor**: Not a functional problem, but correcting it improves ontology quality and readability.
---
## Pitfalls detected

### P08 — Missing annotations (**Minor**, 106 cases)

**Description**  

This pitfall occurs when an ontology element is created without human-readable annotations. Elements lack annotation properties that label them (such as `rdfs:label`, `skos:prefLabel`, `skos:altLabel`) or that define them (such as `rdfs:comment`, `dc:description`, `skos:definition`).
#### Elements with neither `rdfs:label` nor `rdfs:comment` (nor `skos:definition`)
- `http://localhost/onto/ontowebpt#Field`
- `http://localhost/onto/ontowebpt#Tag`
- `http://localhost/onto/ontowebpt#CWE`
- `http://localhost/onto/ontowebpt#Set-Cookie`
- `http://localhost/onto/ontowebpt#Cookie`
- `http://localhost/onto/ontowebpt#CPE`
- `http://localhost/onto/ontowebpt#tagHasProperties`
- `http://localhost/onto/ontowebpt#platformHasVulnerability`
#### Elements with no `rdfs:label` defined
- `http://localhost/onto/ontowebpt#Reflected_XSS`
- `http://localhost/onto/ontowebpt#Finding`
- `http://localhost/onto/ontowebpt#ResponseHeader`
- `http://localhost/onto/ontowebpt#Request`
- `http://localhost/onto/ontowebpt#PathTraversal`
- `http://localhost/onto/ontowebpt#Methods`
- `http://localhost/onto/ontowebpt#HeaderType`
- `http://localhost/onto/ontowebpt#XSS`
- `http://localhost/onto/ontowebpt#AnalyzerFinding`
- `http://localhost/onto/ontowebpt#Resolver`
- `http://localhost/onto/ontowebpt#RequestHeader`
- `http://localhost/onto/ontowebpt#HttpFinding`
- `http://localhost/onto/ontowebpt#OpenRedirect`
- `http://localhost/onto/ontowebpt#PayloadHeaders`
- `http://localhost/onto/ontowebpt#AnalyzerResolver`
- `http://localhost/onto/ontowebpt#CVE`
- `http://localhost/onto/ontowebpt#Connection`
- `http://localhost/onto/ontowebpt#TechstackFinding`
- `http://localhost/onto/ontowebpt#Message`
- `http://localhost/onto/ontowebpt#RepresentationHeaders`
- `http://localhost/onto/ontowebpt#Vulnerabilities`
- `http://localhost/onto/ontowebpt#CookieFinding`
- `http://localhost/onto/ontowebpt#Parameter`
- `http://localhost/onto/ontowebpt#MessageHeader`
- `http://localhost/onto/ontowebpt#HttpResolver`
- `http://localhost/onto/ontowebpt#Response`
- `http://localhost/onto/ontowebpt#Stored_XSS`
- `http://localhost/onto/ontowebpt#URI`
- `http://localhost/onto/ontowebpt#DOM-based_XSS`
- `http://localhost/onto/ontowebpt#TechstackResolver`
- `http://localhost/onto/ontowebpt#SQLi`
- `http://localhost/onto/ontowebpt#HeaderFinding`
- `http://localhost/onto/ontowebpt#HTML`
- `http://localhost/onto/ontowebpt#SoftwareFinding`
- `http://localhost/onto/ontowebpt#HTTP`
- `http://localhost/onto/ontowebpt#StatusCodes`
- `http://localhost/onto/ontowebpt#relatedToHTTP`
- `http://localhost/onto/ontowebpt#relatedToHTML`
- `http://localhost/onto/ontowebpt#refersToHeader`
- `http://localhost/onto/ontowebpt#sc`
- `http://localhost/onto/ontowebpt#hasHttpFinding`
- `http://localhost/onto/ontowebpt#uriRequest`
- `http://localhost/onto/ontowebpt#tagHasChildTag`
- `http://localhost/onto/ontowebpt#payHeader`
- `http://localhost/onto/ontowebpt#aboutVulnerabilityType`
- `http://localhost/onto/ontowebpt#reqHeader`
- `http://localhost/onto/ontowebpt#resp`
- `http://localhost/onto/ontowebpt#resHeader`
- `http://localhost/onto/ontowebpt#detectedByResolver`
- `http://localhost/onto/ontowebpt#mthd`
- `http://localhost/onto/ontowebpt#repHeader`
- `http://localhost/onto/ontowebpt#param`
- `http://localhost/onto/ontowebpt#htmlChild`
- `http://localhost/onto/ontowebpt#httpFindingOfRequest`
- `http://localhost/onto/ontowebpt#refersToCookie`
- `http://localhost/onto/ontowebpt#findingCategory`
- `http://localhost/onto/ontowebpt#cvssSeverity`
- `http://localhost/onto/ontowebpt#findingDescription`
- `http://localhost/onto/ontowebpt#body`
- `http://localhost/onto/ontowebpt#sourceName`
- `http://localhost/onto/ontowebpt#scheme`
- `http://localhost/onto/ontowebpt#valueParameter`
- `http://localhost/onto/ontowebpt#authority`
- `http://localhost/onto/ontowebpt#requestUrl`
- `http://localhost/onto/ontowebpt#sourceFile`
- `http://localhost/onto/ontowebpt#nameParameter`
- `http://localhost/onto/ontowebpt#id`
- `http://localhost/onto/ontowebpt#path`
- `http://localhost/onto/ontowebpt#severity`
- `http://localhost/onto/ontowebpt#remediation`
- `http://localhost/onto/ontowebpt#connectionAuthority`
- `http://localhost/onto/ontowebpt#mainDomain`
- `http://localhost/onto/ontowebpt#cveId`
- `http://localhost/onto/ontowebpt#reasonPhrase`
- `http://localhost/onto/ontowebpt#contextIndex`
- `http://localhost/onto/ontowebpt#formMethod`
- `http://localhost/onto/ontowebpt#contextOrigin`
- `http://localhost/onto/ontowebpt#methodName`
- `http://localhost/onto/ontowebpt#httpVersion`
- `http://localhost/onto/ontowebpt#cvssScore`
- `http://localhost/onto/ontowebpt#httpMethod`
- `http://localhost/onto/ontowebpt#statusCodeNumber`
- `http://localhost/onto/ontowebpt#formAction`
- `http://localhost/onto/ontowebpt#sourceLocation`
- `http://localhost/onto/ontowebpt#uri`
- `http://localhost/onto/ontowebpt#fieldValue`
- `http://localhost/onto/ontowebpt#cookieName`
- `http://localhost/onto/ontowebpt#contextType`
- `http://localhost/onto/ontowebpt#contextSrc`
- `http://localhost/onto/ontowebpt#owaspCategory`
- `http://localhost/onto/ontowebpt#fieldName`
- `http://localhost/onto/ontowebpt#query`
- `http://localhost/onto/ontowebpt#findingRuleId`
- `http://localhost/onto/ontowebpt#responseStatus`
- `http://localhost/onto/ontowebpt#cookieDomain`
- `http://localhost/onto/ontowebpt#sinkName`
- `http://localhost/onto/ontowebpt#codeSnippet`
- `http://localhost/onto/ontowebpt#fragment`
---
### P11 — Missing domain or range in properties (**Important**, 3 cases)

**Description**  

Object and/or datatype properties without domain or range axioms (or lacking one of them) are included in the ontology.

**Elements affected**
- `http://localhost/onto/ontowebpt#refersToCookie`
- `http://localhost/onto/ontowebpt#cookieDomain`
- `http://localhost/onto/ontowebpt#cookieName`
**Tip (from OOPS!)**  

Solving this pitfall may lead to new results for other pitfalls and suggestions. It is recommended to fix the relevant cases and re-run OOPS!.

---
### P13 — Inverse relationships not explicitly declared (**Minor**, 19 cases)

**Description**  

A relationship (except symmetric properties declared as `owl:SymmetricProperty`) has no explicit inverse relationship (`owl:inverseOf`) declared in the ontology.

**Elements affected**

- `http://localhost/onto/ontowebpt#relatedToHTTP`
- `http://localhost/onto/ontowebpt#tagHasProperties`
- `http://localhost/onto/ontowebpt#relatedToHTML`
- `http://localhost/onto/ontowebpt#refersToHeader`
- `http://localhost/onto/ontowebpt#sc`
- `http://localhost/onto/ontowebpt#platformHasVulnerability`
- `http://localhost/onto/ontowebpt#uriRequest`
- `http://localhost/onto/ontowebpt#tagHasChildTag`
- `http://localhost/onto/ontowebpt#payHeader`
- `http://localhost/onto/ontowebpt#aboutVulnerabilityType`
- `http://localhost/onto/ontowebpt#reqHeader`
- `http://localhost/onto/ontowebpt#resp`
- `http://localhost/onto/ontowebpt#resHeader`
- `http://localhost/onto/ontowebpt#detectedByResolver`
- `http://localhost/onto/ontowebpt#mthd`
- `http://localhost/onto/ontowebpt#repHeader`
- `http://localhost/onto/ontowebpt#param`
- `http://localhost/onto/ontowebpt#htmlChild`
- `http://localhost/onto/ontowebpt#refersToCookie`

---

### P22 — Using different naming conventions in the ontology (**Minor**, ontology-wide)

**Description**  

Ontology elements are not named following a consistent naming convention (for example CamelCase or use of delimiters such as `-` or `_`). This pitfall applies to the ontology in general (not to specific elements).

---
## Suggestions / warnings

### Suggestion — Symmetric or transitive object properties (2 cases)

**Message**  
The domain and range axioms are equal for each of the following object properties. They could be symmetric or transitive.

- `http://localhost/onto/ontowebpt#tagHasChildTag`
- `http://localhost/onto/ontowebpt#htmlChild`
---
