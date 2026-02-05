# CQ-Based Evaluation (Competency Questions)

This document describes the Competency Questions (CQs) workflow adopted to evaluate OntoWeb-PT from the use-case perspective, and to assess whether the populated knowledge base can answer the intended questions through SPARQL queries executed in GraphDB.

## 1. Goal and scope

The CQ-based evaluation validates that the knowledge base can support question answering for the HTTP pipeline described in the thesis use cases, including:

- HTTP requests and responses (method, status, headers, body, URI).
- URI decomposition (scheme, authority, path, query parameters).
- Request–response linkage and traceability.
- HTTP findings derived from captured evidence, linked back to requests.
- Named-graph separation between evidence and findings.

This evaluation intentionally focuses on the HTTP dimension only (Interceptor + PCAP flows). Any CQ involving TechStack detection, DOM/HTML artifacts, or Analyzer-only outputs is excluded.

## 2. Artifacts (CSV pipeline)

The CQ workflow is captured as a sequence of CSV artifacts:

- `1_competency_questions_usecases_scenarios.csv`  
  AI-generated CQs from thesis Use Cases and Use Case Scenarios.  
  Initial set size: 1820 CQs.

- `2_competency_questions_http_only.csv`  
  Filtered CQs retained only for HTTP evidence and HTTP findings (extension Interceptor + PCAP).  
  Filtered set size: 1084 CQs.

- `3_competency_questions_interceptor_with_sparql.csv`  
  Each CQ mapped to a SPARQL query plus an evaluation rule (`pass_rule`) to automatically decide PASS/FAIL.

- `cq_results.csv` / `4_cq_results.csv`  
  Execution outcomes produced by the Python runner for each CQ (PASS/FAIL + error, if any).

**Data saved in:**
./assets/4_CQ_Based_Evaluation (directory)

### Excerpts

Insert here short excerpts from your CSVs (for example: 5 lines each from Step 1, Step 2, and the results file).

**CSV - Step 1**

| cq_id   | use_case | scenario_step | dimension      | question                                                                        |
| ------- | -------- | ------------- | -------------- | ------------------------------------------------------------------------------- |
| CQ00001 | UC-1     |               | Retrieval      | List HTTP requests associated with UC-1 filtered by presence of a payload body. |
| CQ00002 | UC-1     |               | Retrieval      | Enumerate HTTP requests associated with UC-1 filtered by status code.           |
| CQ00003 | UC-1     |               | Retrieval      | List HTTP requests associated with UC-1 filtered by job identifier.             |
| CQ00004 | UC-1     |               | Retrieval      | Enumerate HTTP requests associated with UC-1 filtered by method.                |
| CQ00005 | UC-1     |               | Quantification | Count HTTP requests for UC-1 filtered by presence of parameters.                |
| CQ00006 | UC-1     |               | Retrieval      | Enumerate HTTP responses associated with UC-1 filtered by scheme and authority. |
| CQ00007 | UC-1     |               | Retrieval      | Enumerate HTTP responses associated with UC-1 filtered by path.                 |
| CQ00008 | UC-1     |               | Retrieval      | List HTTP responses associated with UC-1 filtered by status code.               |
| CQ00009 | UC-1     |               | Retrieval      | Enumerate HTTP responses associated with UC-1 filtered by timestamp window.     |
| CQ00010 | UC-1     |               | Quantification | Summarize the count of HTTP responses for UC-1 filtered by status code.         |

**CSV - Results**

| cq_id   | use_case | scenario_step | dimension      | question                                                                        | sparql | pass_rule | notes                                                                                                                                    | result |
| ------- | -------- | ------------- | -------------- | ------------------------------------------------------------------------------- | ------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| CQ00001 | UC-1     |               | Retrieval      | List HTTP requests associated with UC-1 filtered by presence of a payload body. | SPARQL | non_empty |                                                                                                                                          | PASS   |
| CQ00002 | UC-1     |               | Retrieval      | Enumerate HTTP requests associated with UC-1 filtered by status code.           | SPARQL | non_empty |                                                                                                                                          | PASS   |
| CQ00003 | UC-1     |               | Retrieval      | List HTTP requests associated with UC-1 filtered by job identifier.             | SPARQL | non_empty | Job identifier not explicitly modeled; query uses Request id when available.                                                             | PASS   |
| CQ00004 | UC-1     |               | Retrieval      | Enumerate HTTP requests associated with UC-1 filtered by method.                | SPARQL | non_empty |                                                                                                                                          | PASS   |
| CQ00005 | UC-1     |               | Quantification | Count HTTP requests for UC-1 filtered by presence of parameters.                | SPARQL | count>=1  |                                                                                                                                          | PASS   |
| CQ00006 | UC-1     |               | Retrieval      | Enumerate HTTP responses associated with UC-1 filtered by scheme and authority. | SPARQL | non_empty |                                                                                                                                          | PASS   |
| CQ00007 | UC-1     |               | Retrieval      | Enumerate HTTP responses associated with UC-1 filtered by path.                 | SPARQL | non_empty |                                                                                                                                          | PASS   |
| CQ00008 | UC-1     |               | Retrieval      | List HTTP responses associated with UC-1 filtered by status code.               | SPARQL | non_empty |                                                                                                                                          | PASS   |
| CQ00009 | UC-1     |               | Retrieval      | Enumerate HTTP responses associated with UC-1 filtered by timestamp window.     | SPARQL | non_empty | Timestamp filter requested but no explicit timestamp datatype property was found in ontology TBox; query ignores time-window constraint. | PASS   |
| CQ00010 | UC-1     |               | Quantification | Summarize the count of HTTP responses for UC-1 filtered by status code.         | SPARQL | count>=1  |                                                                                                                                          | PASS   |

## 3. Step 1 — CQ generation from Use Cases and Use Case Scenarios

Competency Questions were generated using AI from the thesis chapters describing:
- Use Cases: expected system capabilities and workflows.
- Use Case Scenarios: scenario-level steps, runtime effects, and how evidence is acquired and persisted.

The output was intentionally broad to cover:
- validation questions (presence of required attributes),
- exploration questions (enumerations and filters),
- traceability questions (link evidence ↔ findings),
- data quality questions (missing fields, incomplete links),
- named-graph isolation and provenance.


### AI Prompt (Step 1 – Generate CQs from Use Cases and Scenarios)

Use the following prompt to generate **`1_competency_questions_usecases_scenarios.csv`** starting from the text of the Use Cases and Use Case Scenarios (copied from the thesis).

```text
You are an ontology engineer helping me design a CQ-based evaluation for a knowledge-graph platform about web penetration testing evidence.

I will paste:
1) A set of Use Cases (UC-1, UC-2, ...) and
2) Their Use Case Scenarios (steps).

TASK
- Generate as many competency questions as reasonably possible (aim for 150–300) that are answerable *in principle* by a knowledge graph representing the system evidence, workflows, and results described by the use cases.
- Questions must be in ENGLISH.
- Questions must be generic (do not mention “this ontology”, “GraphDB”, “OntoWeb-PT”, or implementation details).
- Each CQ must be linked to:
  - use_case: one of the UC identifiers I provide (e.g., UC-1)
  - scenario_step: the relevant scenario step (short label or step number); if not applicable, leave it blank
  - dimension: choose one value from: Retrieval | Consistency | Completeness | Provenance | Validation

OUTPUT FORMAT (IMPORTANT)
Return ONLY a semicolon-separated CSV (no commentary, no markdown), with this header and columns exactly:

cq_id;use_case;scenario_step;dimension;question

ID RULES
- cq_id must be sequential and zero-padded with 5 digits, starting from CQ00001 (e.g., CQ00001, CQ00002, ...).
- Keep IDs unique.

QUALITY RULES
- Avoid near-duplicates. If two questions are similar, merge them into one stronger question.
- Mix granular questions (single aspect) and higher-level questions (combining multiple aspects).
- Prefer questions that stress the ability to link evidence to derived results and to preserve provenance across steps.

Now wait for my pasted Use Cases and Scenarios, then produce the CSV.
```

## 4. Step 2 — HTTP-only filtering (Interceptor + PCAP)

The initial set (1820) was filtered to keep only questions related to HTTP evidence and HTTP findings, for both acquisition paths:
- Live browsing via extension Interceptor.
- Offline reconstruction via PCAP parsing.

### Filtering criteria applied

**Kept** if the CQ primarily concerns:
- Request: method, id, URI, headers, body, parameters.
- Response: status code, reason phrase, headers, body.
- URI modeling: scheme/authority/path/query/fragment and param nodes.
- Evidence-to-finding linkage and finding metadata (rule id, severity, resolver attribution)    
- Named-graph separation for HTTP evidence vs findings.

**Removed** if the CQ primarily concerns:
- TechStack detection or technology fingerprinting.
- DOM/HTML structure, page elements, scripts, client-side artifacts.
- Analyzer-only outputs unrelated to HTTP request/response evidence.
- Any question whose answer requires DOM-based context rather than HTTP artifacts.

The filtered set resulted in 1084 HTTP-only CQs.


### AI Prompt (Step 2 – Filter to HTTP-only scope)

Use the following prompt to derive **`2_competency_questions_http_only.csv`** by filtering the broader CQ set to only the HTTP-representation scope (requests, responses, headers, URIs, methods, status codes, bodies, connections, and closely related metadata). This keeps the same schema as Step 1.

```text
You are helping me refine a CQ list to a narrower scope.

INPUT
I will paste a semicolon-separated CSV with header:
cq_id;use_case;scenario_step;dimension;question

TASK
- Keep ONLY the competency questions that are clearly related to HTTP message representation and navigation, including:
  - requests and responses
  - HTTP methods
  - URIs and their components (scheme, authority/host, path, query, fragment)
  - headers (names, values, header elements/parameters where applicable)
  - status codes / reason phrases
  - message bodies / content representations (text/base64/RDF content) when tied to HTTP messages
  - connection / exchanges (request-response linkage)
  - any minimal capture metadata that is strictly necessary to interpret HTTP evidence
- Remove everything that is about:
  - vulnerabilities, findings, OWASP categories, attacks, mitigations
  - scanning, exploitation logic, or security results not strictly tied to HTTP representation
  - non-HTTP entities (users, assets, organization, risk, etc.)

OUTPUT FORMAT (IMPORTANT)
Return ONLY a semicolon-separated CSV (no commentary, no markdown), with the SAME header and columns exactly:

cq_id;use_case;scenario_step;dimension;question

RULES
- Preserve the original cq_id values for the rows you keep.
- Do NOT renumber IDs.
- Do NOT rewrite the questions unless needed to remove non-HTTP references; if you rewrite, keep the original intent.
- Ensure the result is still diverse (methods, URIs, headers, bodies, status codes, linkage, provenance).
```

## 5. Step 3 — SPARQL mapping for each CQ

Each CQ was associated with a SPARQL query to verify that the ontology, when populated, can answer the question. The mapping follows a template-based approach depending on the CQ intent:
- Existence checks → `ASK` queries.
- Enumerations → `SELECT DISTINCT ... LIMIT ...`.
- Minimum coverage checks → `SELECT (COUNT(...) AS ?count)` with `pass_rule = count>=1`.
- Data-quality checks → queries returning violations with `pass_rule = empty_ok`.
- “Can be queried” checks → `pass_rule = query_ok`.

Each CQ row includes:
- `sparql_kind`: ASK or SELECT.
- `pass_rule`: the decision rule used by the script.


### AI Prompt (Step 3 – Attach SPARQL queries and PASS/FAIL rules)

Use the following prompt to generate **`3_competency_questions_interceptor_with_sparql.csv`** by attaching SPARQL query templates and evaluation rules to each HTTP-only CQ.

```text
You are an RDF/SPARQL engineer.

CONTEXT
- I have a GraphDB repository containing an RDF dataset produced by an HTTP “Interceptor” evidence producer.
- The dataset uses an ontology to represent HTTP requests, responses, headers, URIs, methods, status codes, and bodies.
- I will provide a CSV of HTTP-only competency questions.

INPUT
I will paste a semicolon-separated CSV with header:
cq_id;use_case;scenario_step;dimension;question

TASK
For EACH CQ, produce:
- sparql_kind: SELECT or ASK
- sparql: a SPARQL 1.1 query template that answers the CQ (or checks a constraint relevant to the CQ)
- pass_rule: choose one value from this controlled vocabulary:
  - non_empty   (PASS if SELECT returns at least 1 row)
  - count>=1    (PASS if a SELECT COUNT returns a count >= 1)
  - ask=true    (PASS if ASK returns true)
  - empty_ok    (PASS if query executes successfully even if empty; use when CQ is exploratory)
  - query_ok    (PASS if the query executes successfully; use only when result set may vary)
- notes: short text explaining assumptions (e.g., which classes/properties are expected) and any placeholders

OUTPUT FORMAT (IMPORTANT)
Return ONLY a semicolon-separated CSV (no commentary, no markdown), with this header and columns exactly:

cq_id;use_case;scenario_step;dimension;question;sparql_kind;sparql;pass_rule;notes

RULES
- Preserve cq_id and the original columns verbatim.
- Use PREFIX declarations when helpful.
- Keep queries robust: avoid relying on a specific named graph unless explicitly required.
- When a CQ mentions a “specific host/path/header”, treat it as a template by using a placeholder variable or a FILTER with an obvious placeholder (e.g., "example.com", "/login", "Content-Type").
- Prefer simple and executable queries over perfect semantic coverage.
```

## 6. Step 4 — Automated execution on GraphDB

All SPARQL queries are executed through the GraphDB repository endpoint:
- Endpoint: `http://localhost:7200/repositories/ontowebpt`
- Method: POST
- Headers:
    - `Accept: application/sparql-results+json`
    - `Content-Type: application/sparql-query; charset=utf-8`

The runner produces a final CSV with the following columns:  
`cq_id, use_case, scenario_step, dimension, question, sparql, pass_rule, notes, result, error`

## 7. Python runner (automation)

A Python script was implemented to execute all CQ queries and decide PASS/FAIL automatically, with real-time logs.

### Responsibilities

- Read the input CSV containing CQs and SPARQL queries.
- Execute SPARQL by HTTP POST to GraphDB.
- Normalize results:
    - ASK → boolean
    - SELECT → number of bindings
- Apply `pass_rule` to decide PASS/FAIL.
- Write a single summary CSV (no heavy per-query dump, unless desired).
- Provide progress logs, counters, and ETA.

### Runner excerpt (≤ 15 lines)

```python
def normalize_result(data: Dict[str, Any], kind: str) -> Dict[str, Any]:
    kind_u = (kind or "SELECT").strip().upper()
    if kind_u == "ASK":
        return {"kind": "ASK", "boolean": bool(data.get("boolean", False))}
    bindings = data.get("results", {}).get("bindings", [])
    return {"kind": "SELECT", "row_count": len(bindings), "bindings": bindings}

def eval_pass(pass_rule: str, normalized: Dict[str, Any]) -> bool:
    rule = (pass_rule or "").strip().lower()
    if rule == "ask=true":
        return normalized.get("kind") == "ASK" and normalized.get("boolean") is True
    if rule == "non_empty":
        return normalized.get("kind") == "SELECT" and normalized.get("row_count", 0) > 0

```

### Example invocation

```powershell
python run_cq_sparql_graphdb_summary.py `
  --endpoint "http://localhost:7200/repositories/ontowebpt" `
  --in_csv "3_competency_questions_interceptor_with_sparql.csv" `
  --out_csv "cq_results.csv" `
  --optimize_limit1 `
  --log_every 25
```

## 8. Failure analysis and refinement

The first automated execution produced 35 failures. These failures were manually verified by:
- re-running the same SPARQL in GraphDB Workbench,
- executing ASK queries directly via REST (to compare boolean outputs),
- checking named-graph placement assumptions for evidence and findings.

### Root causes identified

1. **SPARQL malformations**
    - Aggregation/projection errors (for example: selecting a variable without `GROUP BY`).
    - Filters referencing unbound variables.
    - Missing named-graph constraints (queries accidentally targeting the wrong graph).
    - Representation mismatches (for example: method stored as an IRI, but queried as a literal).
2. **Script evaluation mismatches**
    - False negatives when the query type (ASK) was not handled consistently with the rule `ask=true`.
    - Edge cases where CSV metadata (`sparql_kind`) caused the response to be interpreted as SELECT instead of ASK.

### Corrections applied

- Malformed queries were corrected and rewritten using robust named-graph patterns.
- Query templates were aligned with actual modeling decisions:
    - method extracted from IRI when stored as an IRI,
    - evidence and findings queried from their respective named graphs,
    - request–finding linkage checked with the correct predicates.
- The script was updated to reduce evaluation errors and improve robustness.

After these corrections, the evaluation converged and the final run confirmed that the CQ suite is satisfiable for the evaluated datasets.

## 9. Results and observations (what this evaluation demonstrates)

- **Functional coverage**: The CQ suite provides evidence that the HTTP-centric use-case requirements can be expressed and verified via SPARQL.
- **Traceability**: Questions about linking findings to their originating requests can be systematically validated.
- **Dataset repeatability**: The same CQ suite can be re-run across different datasets (Interceptor vs PCAP) to compare ingestion completeness.
- **Tooling sensitivity**: CQ-based evaluation is sensitive to query quality and automation details; a refinement loop is essential to avoid interpreting tooling artifacts as ontology/data limitations.
- **Complementarity with SHACL**: SHACL validates structural obligations, while CQs validate the ability to answer use-case-driven questions.

## 10. How to reproduce

1. Generate CQs from Use Cases/Scenarios → produce Step 1 CSV.
2. Filter to HTTP-only (Interceptor + PCAP), remove TechStack/DOM/Analyzer → Step 2 CSV.
3. Map each CQ to SPARQL + `pass_rule` → Step 3 CSV.
4. Run the Python runner against GraphDB → results CSV.
5. Inspect failures, fix malformed SPARQL and script edge cases, rerun until stable.
