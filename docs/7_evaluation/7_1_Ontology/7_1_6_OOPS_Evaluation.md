# OOPS!-Based Ontology Quality Evaluation (OntoWeb-PT)
---

- [OOPS Report (scan #1)](./assets/7_1_6_OOPS_Evaluation/1_OOPS_Report.md)
- [OOPS Report (scan #2)](./assets/7_1_6_OOPS_Evaluation/2_OOPS_Report.md)

---

This document describes how the **OOPS! (OntOlogy Pitfall Scanner)** tool was used to perform a lightweight quality assessment of the **OntoWeb-PT** ontology, and how the ontology was refined between versions **1.0.3** and **1.0.4**.

The goal of this evaluation is **ontology-quality improvement** (TBox hygiene and documentation), not functional testing of the ingestion pipeline or the Engine. Results are therefore interpreted as *quality signals* (annotations, modeling completeness, explicit inverses), and are complementary to CQ-based and dataset-based evaluations.

---
## 1. Tooling and execution workflow

### 1.1 Local OOPS! deployment (Docker)

OOPS! V2 was executed locally via Docker:

```bash
docker run -p 81:8080 mpovedavillalon/oops:v2
```

Then the Web UI was opened in a browser at:
- `http://localhost:81`
### 1.2 Scan procedure

For each ontology version:
1. Open the OOPS! Web UI.
2. Paste the RDF/XML content of the ontology file into the input area.
3. Run the scan and export/save the generated report.

The evaluated ontology files were:
- `ontowebpt_1.0.3.rdf` (baseline, original)
- `ontowebpt_1.0.4.rdf` (refined after corrections in Protégé)

Both OOPS! reports are stored in:
- `./assets/5_OOPS_Evaluation`
---
## 2. Scan #1 — OntoWeb-PT 1.0.3 (baseline)

**Scan date (GMT):** Sun, 25 Jan 2026 14:06:48 GMT  
**Highest severity:** Important  
**Pitfalls detected:** 4  
**Suggestions / warnings:** 1
### 2.1 Summary (essential)

|ID|Title|Severity|Cases|
|---|---|---|---|
|P08|Missing annotations|Minor|106|
|P11|Missing domain or range in properties|Important|3|
|P13|Inverse relationships not explicitly declared|Minor|19|
|P22|Using different naming conventions in the ontology|Minor|—|

**Suggestion:** symmetric or transitive object properties (2 cases)  
Elements: `tagHasChildTag`, `htmlChild`.
### 2.2 Interpretation

- **P08 (Missing annotations)** mainly affects *readability and maintainability*. It does not change ontology semantics, but it weakens documentation quality and human comprehension.
- **P11 (Missing domain or range)** may affect *reasoning and validation* because missing domain/range axioms reduce the amount of type information that can be inferred.
- **P13 (Missing inverse relationships)** affects *navigability* and may reduce inference capabilities when inverse traversal is needed.
- **P22 (Naming conventions)** is a *style-level* pitfall: it does not invalidate the ontology, but indicates inconsistent naming patterns across entities.

Regarding the **suggestion about symmetric/transitive properties**, the tool flags properties whose **domain and range are identical**. However, in OntoWeb-PT these properties represent **direct containment / parent-child relations** (DOM-like modeling), where declaring them symmetric or transitive can easily introduce unintended semantics.

---
## 3. Refinement applied (Protégé) → OntoWeb-PT 1.0.4

After the baseline report, the ontology was updated in **Protégé** and versioned to **1.0.4**.
### 3.1 What was changed

The refinement focused on removing the issues with the highest practical impact **without changing entity IRIs** (to avoid conflicts with the ingestion tools):

- **P08 fixed:** added missing `rdfs:label` and `rdfs:comment` annotations where needed.
- **P11 fixed:** added missing `rdfs:domain` / `rdfs:range` to the affected properties.
- **P13 fixed:** added explicit inverse relationships (`owl:inverseOf`) where appropriate.
- **P22 intentionally left unchanged:** naming was not normalized to avoid incompatibilities with the existing ingestion pipeline and the Engine.
### 3.2 Notes on the symmetric/transitive suggestion

The suggestion was **not** applied as a formal axiom, because:
- Declaring `htmlChild` / `tagHasChildTag` **symmetric** would collapse parent/child directionality.
- Declaring them **transitive** would imply “ancestor-of” semantics (child-of-child is also child), which is often incorrect for strict containment modeling and can produce large inferred graphs.

Instead, the safe modeling improvement is to keep directionality and (optionally) use explicit inverses:
- `tagHasChildTag` ↔ `tagHasParentTag`
- `htmlChild` ↔ `htmlParent`

This approach improves traversability without changing the intended meaning.

---
## 4. Scan #2 — OntoWeb-PT 1.0.4 (after fixes)

**Scan date (GMT):** Sun, 25 Jan 2026 15:00:52 GMT  
**Highest severity:** Minor  
**Pitfalls detected:** 1  
**Suggestions / warnings:** 1
### 4.1 Summary (essential)

|ID|Title|Severity|Cases|
|---|---|---|---|
|P22|Using different naming conventions in the ontology|Minor|—|

**Suggestion:** symmetric or transitive object properties (4 cases)  
Elements: `tagHasParentTag`, `htmlParent`, `tagHasChildTag`, `htmlChild`.
### 4.2 Interpretation

The second scan confirms that the structural and documentation-related issues (P08, P11, P13) were resolved. The only remaining pitfall is **P22**, which is intentionally tolerated for tool compatibility. The suggestion persists because those properties still share the same domain and range, which is expected for parent/child modeling patterns.

---
## 5. Impact on OntoWeb-PT behavior (Engine / ingestion safety)

### 5.1 Changes that do **not** affect runtime behavior

- **Annotations (P08 fix)**: adding `rdfs:label` / `rdfs:comment` affects only documentation and UI friendliness (Protégé, RDF browsers). It does **not** change triples used by the Engine.
- **Keeping all IRIs unchanged**: ensures the ingestion pipeline continues to generate the same predicates/classes and the Engine does not break due to renamed terms.
### 5.2 Changes that may affect reasoning (only if enabled)

- **Domain/range axioms (P11 fix)** and **inverseOf axioms (P13 fix)** can introduce **additional inferred triples** *if* reasoning is enabled in the triple store or in the application layer.
  - If your system uses GraphDB with **no inference/materialization**, these axioms remain metadata and do not change stored data.
  - If inference is enabled, the new axioms can **enrich type assertions** and allow inverse navigation. This typically improves queryability but may slightly change results for queries that rely on implicit typing.
### 5.3 Why symmetric/transitive axioms were avoided

Declaring parent/child relations symmetric or transitive can create incorrect inferences and graph blow-ups. Avoiding these axioms keeps the model aligned with the intended containment semantics, and avoids unexpected side effects on query results and reasoning.

---
## 6. Reproducibility checklist

1. Start OOPS! locally:

   ```bash
   docker run -p 81:8080 mpovedavillalon/oops:v2
   ```
2. Open `http://localhost:80`.
3. Paste RDF/XML from:
   - `ontowebpt_1.0.3.rdf` → export report
   - `ontowebpt_1.0.4.rdf` → export report

2. Store both reports under:
   - `./assets/5_OOPS_Evaluation`
---
## 7. Stored artifacts

The following artifacts are available for documentation and traceability:

- `./assets/5_OOPS_Evaluation`  
  - OOPS report for `ontowebpt_1.0.3.rdf` (scan 14:06:48 GMT)  
  - OOPS report for `ontowebpt_1.0.4.rdf` (scan 15:00:52 GMT)
---
