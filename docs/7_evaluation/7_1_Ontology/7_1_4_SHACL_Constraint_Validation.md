# SHACL-Based Constraint Validation

SHACL-based constraint validation formalize the most impactful ingestion obligations as standard SHACL shapes executed directly within GraphDB.
## SHACL Shapes Mapping (.ttl)

```turtle
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix onto: <http://localhost/onto/ontowebpt#> .
@prefix exsh: <http://localhost/onto/ontowebpt/shapes#> .

#######################################################################
# OntoWeb-PT — SHACL Shapes for Evaluation
# Scope: C3, C4, C7, C9–C10, C11–C12, C13
# Notes:
# - Shapes are designed to mirror the SPARQL baseline checks.
# - Import this file into GraphDB’s SHACL Shapes Graph (reserved graph).
#######################################################################

onto:RequestShape
  a sh:NodeShape ;
  sh:targetClass onto:Request ;

  # C3 — Request must have resp
  sh:property [
    sh:path onto:resp ;
    sh:minCount 1 ;
    sh:maxCount 1 ;               
    sh:severity sh:Violation ;
    sh:message "C3: Each Request must be linked to exactly one Response via onto:resp." ;
  ] .

exsh:ResponseShape
    a sh:NodeShape ;
    rdfs:label "Response conformance (C4)"@en ;
    sh:targetClass onto:Response ;
    sh:property [
        sh:path onto:sc ;
        sh:minCount 1 ;
        sh:severity sh:Violation ;
        sh:message "C4: Each Response must be linked to a StatusCodes node via onto:sc."@en ;
    ] .

exsh:URIShape
    a sh:NodeShape ;
    rdfs:label "URI conformance (C7)"@en ;
    sh:targetClass onto:URI ;
    sh:property [
        sh:path onto:uri ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
        sh:severity sh:Violation ;
        sh:message "C7: Each URI node must provide the full URI string via onto:uri."@en ;
    ] .

exsh:MessageHeaderShape
    a sh:NodeShape ;
    rdfs:label "MessageHeader conformance (C9–C10)"@en ;
    sh:targetClass onto:MessageHeader ;

    sh:property [
        sh:path onto:fieldName ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
        sh:severity sh:Violation ;
        sh:message "C9: Each MessageHeader must provide a header name via onto:fieldName."@en ;
    ] ;

    sh:property [
        sh:path onto:fieldValue ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
        sh:severity sh:Violation ;
        sh:message "C10: Each MessageHeader must provide a header value via onto:fieldValue."@en ;
    ] .

exsh:FindingShape
    a sh:NodeShape ;
    rdfs:label "Finding conformance (C11–C13)"@en ;
    sh:targetClass onto:Finding ;

    sh:property [
        sh:path onto:detectedByResolver ;
        sh:minCount 1 ;
        sh:severity sh:Violation ;
        sh:message "C11: Each Finding must include resolver attribution via onto:detectedByResolver."@en ;
    ] ;

    sh:property [
        sh:path onto:findingRuleId ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
        sh:severity sh:Violation ;
        sh:message "C12: Each Finding must provide a rule identifier via onto:findingRuleId."@en ;
    ] ;

    sh:property [
        sh:path onto:findingDescription ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
        sh:severity sh:Violation ;
        sh:message "C12: Each Finding must provide rule metadata via onto:findingDescription."@en ;
    ] ;

    sh:property [
      sh:path onto:aboutVulnerabilityType ;
      sh:minCount 1 ;
      sh:severity sh:Violation ;
      sh:message "C13: Each Finding must be associated with a vulnerability type via onto:aboutVulnerabilityType." ;
    ] .
```

## SHACL validation steps executed (GraphDB)

### Step 1 — Prepare the repository for SHACL

1. Ensure the GraphDB repository is configured to support SHACL validation (RDF4J SHACL Sail enabled).
2. Set validation as enabled in the repository configuration (e.g., `shacl:validationEnabled "true"`).
3. Ensure the repository uses the **reserved SHACL shapes context**:
    - `http://rdf4j.org/schema/rdf4j#SHACLShapeGraph`

---

### Step 2 — Define the SHACL shapes set (derived from SPARQL baseline checks)

1. Start from the SPARQL conformance checks and select the constraints to enforce as SHACL (the “high-impact” ones for navigation/traceability).
2. Build a compact shapes file (Turtle) targeting the core ontology classes:
    - `onto:Request`
    - `onto:Response`
    - `onto:URI`
    - `onto:MessageHeader`
    - `onto:Finding`
3. Encode each constraint using `sh:minCount` (and where needed `sh:maxCount`) on the corresponding property path.
4. Add an explicit `sh:message` for each constraint embedding the original check ID to keep traceability (e.g., “C3: …”, “C13: …”).

Shapes implemented:

- C3: Request → must have exactly one `onto:resp`
- C4: Response → must have `onto:sc`
- C7: URI → must have `onto:uri`
- C9–C10: MessageHeader → must have `onto:fieldName` and `onto:fieldValue`
- C11: Finding → must have `onto:detectedByResolver`
- C12: Finding → must have `onto:findingRuleId` and `onto:findingDescription`
- C13: Finding → must have `onto:aboutVulnerabilityType`

---

### Step 3 — Import shapes into the SHACL shapes graph

1. Open **GraphDB Workbench**.
2. Import the shapes file (Turtle) into the reserved shapes graph:
    - `http://rdf4j.org/schema/rdf4j#SHACLShapeGraph`
3. Verify that the import succeeds (no parsing errors, shapes are stored in the shapes graph).

---

### Step 4 — Enforce dataset isolation before each validation run

1. Ensure **only one dataset is present at a time** in the two named graphs:
    - `http://localhost/graphs/http-requests`
    - `http://localhost/graphs/findings`
2. Before loading the next dataset, clear both graphs:

`CLEAR GRAPH <http://localhost/graphs/http-requests> ; CLEAR GRAPH <http://localhost/graphs/findings> ;`

---

### Step 5 — Load DSE1 and validate it

1. Load DSE1 into GraphDB:
    - HTTP evidence goes into `http://localhost/graphs/http-requests`
    - findings go into `http://localhost/graphs/findings`
2. If SHACL is enabled as ingestion-time enforcement, confirm ingestion completes without SHACL errors (no blocked commits).
3. Run explicit validation to produce a standard SHACL report.

---

### Step 6 — Export the SHACL Validation Report for DSE1

Execute validation via the repository endpoint and save the output as Turtle:

```
curl -X POST \   
-H "Content-Type: text/turtle" \   
-H "Accept: text/turtle" \   
--data-binary "@ontowebpt-shapes.ttl" \   "http://localhost:7200/rest/repositories/ontowebpt/validate/text" \   
-o "dse1-shacl-report.ttl"
```

Then read these report indicators:

- `sh:conforms`
- `rdf4j:truncated`
- number of `sh:result` entries (violations)

Observed result for DSE1:
- `sh:conforms true`
- `rdf4j:truncated false`
- `sh:result` count = 0 (no violations)

---

### Step 7 — Clear graphs and load DS2

1. Clear both graphs (same as Step 4).
2. Load other dataset into GraphDB using the same graph IRIs as DSE1.

---

### Step 8 — Validate DS2 and export the report

Run the same validation request and export by CURL.
Observe result for other datasets.

---

### Step 9 — Summarize SHACL outcomes (final indicators)

For each dataset, record:
1. Conformance boolean (`sh:conforms`)
2. Truncation flag (`rdf4j:truncated`)
3. Total violations (number of `sh:result`)
4. (Optional) violations grouped by shape / severity

Final outcome:
- DSE1: conforms=true, truncated=false, violations=0
- DSE2: conforms=true, truncated=false, violations=0
- DSP1: conforms=true, truncated=false, violations=0
- DSP2: conforms=true, truncated=false, violations=0

---
## Report file content (for all datasets):

```turtle
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix rsx: <http://rdf4j.org/shacl-extensions#> .
@prefix dash: <http://datashapes.org/dash#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix rdf4j: <http://rdf4j.org/schema/rdf4j#> .

[] a sh:ValidationReport;
  sh:conforms true;
  rdf4j:truncated false .

```

---