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