# CQ-based TBox Coverage Evaluation (HTTP Modeling)
---
## Goal and scope

This section documents an **automated, CQ-driven evaluation** to assess how well three HTTP-focused ontologies support a shared set of **TBox-level competency questions (CQs)**.

**Ontologies under comparison**

- **W3C HTTP-in-RDF** ontology (reconstructed and normalized as `w3c.rdf`).
- **HTTP-Onto** ontology extracted from the reference PDF (reconstructed and normalized as `http-onto.rdf`).
- **OntoWeb-PT** (v1.0.4), restricted here to the **HTTP modeling slice** (classes/properties related to requests, responses, headers, URIs, content, etc.).

**Scope boundary**

- The evaluation is **TBox-oriented**: it checks whether the ontology vocabulary (classes/properties and basic schema links) supports the features required by each CQ.
- Vulnerability, finding, and higher-level security modeling in OntoWeb-PT is **out of scope** for this step.

---

## Step 1 — Manual reconstruction and normalization of external ontologies

To make the comparison reproducible and tool-friendly, the two reference ontologies were **reconstructed manually** (starting from their original sources) and normalized into consistent RDF serializations:

1. **W3C HTTP-in-RDF**
   - Goal: obtain a clean OWL/RDFS representation suitable for loading in GraphDB.
   - Normalization actions:
     - consistent namespaces and prefixes
     - explicit `owl:Class`, `owl:ObjectProperty`, `owl:DatatypeProperty` declarations (where needed)
     - cleanup of formatting inconsistencies that may arise from copy/paste or partial exports

2. **HTTP-Onto (from PDF)**
   - Goal: reconstruct the intended schema from the published document.
   - Normalization actions:
     - explicit schema declarations (classes/properties)
     - coherent naming of URI-related components
     - validation that the ontology is parseable and loadable in GraphDB

**Outcome**

- Each ontology can be loaded into an independent GraphDB repository and queried with SPARQL to check **feature presence**.

---

## Step 2 — Generate generic HTTP competency questions (AI-assisted)

A set of generic, HTTP-focused CQs was generated using AI, with the explicit constraint that:

- The questions must be **domain-generic** (no mention of specific ontologies).
- The questions must focus on **HTTP modeling** (requests, responses, headers, methods, URIs, content).
- The final set must be **strongly covered by OntoWeb-PT**, so that OntoWeb-PT is expected to satisfy **most** of them.
- Each CQ includes a list of `required_features` that map to vocabulary elements expected to exist in the ontology.

**Output**

- `1_competency_questions.csv`  
  Format aligned with the example template, with at least the following columns:
  `cq_id;use_case;scenario_step;dimension;question;required_features`

### Prompt used to generate `1_competency_questions.csv`

Use the following prompt to regenerate the file deterministically.

```text
You are helping me generate competency questions for evaluating the TBox coverage of an HTTP ontology.

Goal:
- Produce a CSV (semicolon-separated) containing competency questions about modeling HTTP requests/responses.
- Questions must be generic and MUST NOT mention any ontology name.
- Focus ONLY on HTTP modeling concepts (request, response, method, status code, headers, header name/value, URI parts, media type, body/content, content length, query parameters, etc.).
- Do NOT include security/vulnerability concepts.

Constraints:
- The questions must be written in English.
- The resulting CQ set should be mostly satisfiable by a rich HTTP ontology (think “superset”), so avoid overly narrow or exotic features.
- For each CQ, list the minimum required vocabulary features in `required_features` as a comma-separated list of stable feature keys (e.g., request, response, method, status_code, header, header_name, header_value, uri, uri_authority, uri_path, uri_query, media_type, content, body, content_length).

CSV schema (semicolon-separated; one header row):
cq_id;use_case;scenario_step;dimension;question;required_features

Formatting rules:
- cq_id must be like CQ-001, CQ-002, ...
- use_case must be like UC-HTTP-1, UC-HTTP-2, ...
- scenario_step can be empty if not applicable.
- dimension must be one of: Retrieval; Validation; Modeling; Linking.
- question must be a single sentence ending with a question mark.
- required_features must be a comma-separated list with no spaces after commas.

Now output ONLY the CSV content (no explanation text).
Generate at least 50 CQs.
```

---

## Step 3 — Associate SPARQL checks and pass rules (AI-assisted)

Once the CQs are available, each CQ is associated with:

- a **SPARQL query** that checks whether all required features are available in the ontology schema
- a **pass rule** describing how to interpret the query result

This step produces an input file for automated evaluation across repositories.

**Output**

- `2_competency_questions_with_sparql_rules.csv`  
  Expected columns:
  `cq_id;use_case;scenario_step;dimension;question;sparql;required_features;pass_rule`

### Rule semantics (AND strict)

This evaluation uses **AND strict** semantics:

- A CQ is **PASS** only if **all** `required_features` are present in the ontology.
- A CQ is **FAIL** if **any** required feature is missing.
- The evaluation must report **which features are missing**.

To make the rule machine-checkable, the SPARQL query is designed to return:

- **0 rows** when all features are present (PASS)
- **≥ 1 row** listing missing features (FAIL)

### Prompt used to generate `2_competency_questions_with_sparql_rules.csv`

```text
I have a semicolon-separated CSV of HTTP competency questions with these columns:
cq_id;use_case;scenario_step;dimension;question;required_features

I want a new semicolon-separated CSV with these columns:
cq_id;use_case;scenario_step;dimension;question;sparql;required_features;pass_rule

Task:
- For each row, generate a SPARQL query that checks whether ALL required_features are present in the ontology TBox.
- Use AND strict semantics: PASS only if all required_features are present.
- The SPARQL query must return 0 rows when all required_features are present. If something is missing, it must return one row per missing feature with a variable ?feature (literal string equal to the missing feature key).

Feature detection rules:
- A required feature represents either a class or a property.
- Consider a feature "present" if the IRI is declared as owl:Class/rdfs:Class OR participates in rdfs:subClassOf;
  and for properties, if declared as owl:ObjectProperty/owl:DatatypeProperty/rdf:Property OR participates in rdfs:subPropertyOf OR has rdfs:domain/rdfs:range.
- The query must be robust across three ontologies that use different namespaces. Therefore, for each feature key, include multiple candidate IRIs (one per ontology) and treat the feature as present if ANY candidate is present.
- Use only standard prefixes: rdf, rdfs, owl.

Output rules:
- Keep SPARQL in a single CSV cell (use proper quoting).
- Do not add any extra columns.
- pass_rule must be exactly: "AND(strict): PASS if the query returns 0 rows (no missing required_features)."

Now output ONLY the new CSV content.
```

---

## Step 4 — Execute the evaluation on GraphDB (3 repositories)

### Repository setup

Create three repositories in GraphDB and load one ontology per repository:

- `w3c` → contains `w3c.rdf`
- `http-onto` → contains `http-onto.rdf`
- `ontowebpt` → contains `ontowebpt_1.0.4.rdf` (HTTP slice)

### Evaluation script

Run the evaluation using the provided script:

- `evaluate_cqs_graphdb.py`

The script:

1. reads the input CSV (`2_competency_questions_with_sparql_rules.csv`)
2. executes the `sparql` query for each CQ against each repository
3. writes `3_competency_questions_results.csv` by appending one PASS/FAIL column per ontology,
   including a failure reason with the missing features when applicable

> Note: if your CSV files are semicolon-separated, ensure the script reads them with `sep=";"` (or provide an equivalent option if your local script supports it).

Example execution (adapt base URL and repository IDs):

```bash
python evaluate_cqs_graphdb.py --graphdb http://localhost:7200 --repos w3c http-onto ontowebpt --input 2_competency_questions_with_sparql_rules.csv --output 3_competency_questions_results.csv
```

---

## Step 5 — Interpret the results (`3_competency_questions_results.csv`)

### Row-level interpretation

For each CQ:

- **PASS** means the ontology vocabulary contains all required schema elements needed to express (or answer) that CQ at TBox level.
- **FAIL** means at least one required feature key is missing.
  - The failure reason should list the missing feature keys (e.g., `missing: method,uri_authority`).

### Dataset-level interpretation

To interpret the full result set:

1. **Coverage comparison**
   - Count PASS/FAIL per ontology.
   - Expectation: **OntoWeb-PT** should show the **highest PASS rate**, because it integrates concepts from both reference ontologies and extends the HTTP model.

2. **Gap analysis**
   - For each ontology, aggregate missing features to identify the most frequent gaps.
   - This highlights which HTTP concepts are not explicitly represented (or are represented with a different modeling choice).

3. **Explainable failures**
   - Some FAIL outcomes may reflect **modeling style differences**, not necessarily “lack of meaning”.
     - Example: a feature key expects a `Method` **class**, but the ontology models methods as individuals or as a datatype value.
   - In such cases, either:
     - update the `required_features` definition to match the intended modeling pattern, or
     - introduce explicit schema aliases (e.g., `owl:equivalentClass`, `rdfs:subClassOf`, `rdfs:subPropertyOf`) to support cross-ontology feature detection.

### Recommended summary table

In the evaluation report, summarize results with:

- PASS count and PASS rate per ontology
- top missing features per ontology
- a short qualitative explanation of major gaps

This makes the comparison between W3C, HTTP-Onto, and OntoWeb-PT explicit and reproducible.

---

## Conclusion

This automated CQ-based TBox evaluation complements the ontology validation work already documented in Chapter 7 by:

- providing **repeatable evidence** of schema coverage
- making the comparison across multiple HTTP ontologies **quantitative**
- supporting a clear claim that OntoWeb-PT provides **broader HTTP modeling coverage** than the individual reference ontologies when evaluated against a shared CQ set
