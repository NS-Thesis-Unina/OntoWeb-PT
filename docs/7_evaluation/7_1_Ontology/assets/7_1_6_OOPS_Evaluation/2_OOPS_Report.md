# OOPS! Evaluation Results

|Scan date (GMT)|Tool|Ontology|Highest severity|Pitfalls detected (n)|Suggestions / warnings (n)|
|---|---|---|---|---|---|
|Sun, 25 Jan 2026 15:00:52 GMT|OOPS! V2|OntoWeb-PT|Minor|1|1|

|ID|Title|Severity|Cases|Affected elements (examples)|
|---|---|---|---|---|
|P22|Using different naming conventions in the ontology|Minor|—|Ontology-wide (naming convention not consistent)|

|Type|Message (summary)|Cases|Elements|
|---|---|---|---|
|Suggestion|Same domain and range for some object properties; they might be symmetric or transitive|4|`ontowebpt:tagHasParentTag`, `ontowebpt:htmlParent`, `ontowebpt:tagHasChildTag`, `ontowebpt:htmlChild`

---

## Pitfall importance levels

OOPS! classifies detected pitfalls into three importance levels:
- **Critical**: Crucial to correct; otherwise it can affect ontology consistency, reasoning, and applicability.
- **Important**: Not critical for basic operation, but recommended to correct.
- **Minor**: Not a functional problem, but correcting it improves ontology quality and readability.

---

## Pitfalls detected

### P22 — Using different naming conventions in the ontology (**Minor**, ontology-wide)

**Description**

Ontology elements are not named following a consistent naming convention (for example CamelCase, or the use of delimiters such as `-` or `_`).  

This pitfall applies to the ontology in general rather than specific elements.

---

## Suggestions / warnings

### Suggestion — Symmetric or transitive object properties (4 cases)

**Message**  

The domain and range axioms are equal for each of the following object properties. They could be symmetric or transitive.

**Elements**
- `http://localhost/onto/ontowebpt#tagHasParentTag`
- `http://localhost/onto/ontowebpt#htmlParent`
- `http://localhost/onto/ontowebpt#tagHasChildTag`
- `http://localhost/onto/ontowebpt#htmlChild`
---
