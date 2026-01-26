# Conformance Check

Ontology conformance checks evaluate ingestion correctness through schema level validation executed on the semantic persistence layer. The validation relies on a fixed set of SPARQL queries that count the materialized entities required by the model and detect missing mandatory relations that would compromise subsequent navigation and investigation tasks.

---
### Core Entity Counts (Q1 - Q5)

Compute the dataset-level counts used as the baseline for conformance and integrity validation.

|      | Requests (n) | Responses (n) | URIs (n) | StatusCodeNodes (n) | Findings (n) |
| ---- | ------------ | ------------- | -------- | ------------------- | ------------ |
| DSE1 | 44           | 44            | 44       | 44                  | 67           |
| DSE2 | 10           | 10            | 10       | 10                  | 20           |
| DSP1 | 44           | 44            | 44       | 44                  | 67           |
| DSP2 | 10           | 10            | 10       | 10                  | 20           |

---
### Conformance Queries Results (C1 - C13)

|   Check | Validated condition                                                                         |
| ------: | ------------------------------------------------------------------------------------------- |
|  **C1** | Each request has an associated HTTP method value.                                           |
|  **C2** | Each request is linked to a URI node through `onto:uriRequest`.                             |
|  **C3** | Each request is linked to a response resource through `onto:resp`.                          |
|  **C4** | Each response is linked to a status node through `onto:sc`.                                 |
|  **C5** | Each status node provides a numeric status code value.                                      |
|  **C6** | Each status node provides a textual reason phrase value.                                    |
|  **C7** | Each request URI node provides a full URI string value.                                     |
|  **C8** | Each request URI node provides scheme and path components.                                  |
|  **C9** | Each message header provides a header name value.                                           |
| **C10** | Each message header provides a header value.                                                |
| **C11** | Each finding includes resolver attribution through `onto:detectedByResolver`.               |
| **C12** | Each finding provides rule identifier and description metadata.                             |
| **C13** | Each finding is associated with a vulnerability type through `onto:aboutVulnerabilityType`. |


Execute the conformance queries and record violations as integer counts per check.

|      | C1  | C2  | C3  | C4  | C5  | C6  | C7  | C8  | C9  | C10 | C11 | C12 | C13 |
| ---- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DSE1 | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   |
| DSE2 | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   |
| DSP1 | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   |
| DSP2 | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   |

---
## Aggregate Violation Indicator

Compute an aggregate indicator for fast comparison between datasets:
- **Violations (n)** = sum of applicable violations across primary entities
- **Total entities (n)** = Requests + Responses + URIs + StatusCodeNodes + Findings
- **Violation rate (%)** = Violations / Total * 100

|      | Violations (n) | Violations (%) [violations / total * 100] |
| ---- | -------------- | ----------------------------------------- |
| DSE1 | 0              | 0%                                        |
| DSE2 | 0              | 0%                                        |
| DSP1 | 0              | 0%                                        |
| DSP2 | 0              | 0%                                        |

---
# Operational Queries
## Core Entity Counts (Q1 - Q5)

### (Q1) Requests (n)

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>
SELECT (COUNT(DISTINCT ?r) AS ?requests)
WHERE { 
    GRAPH 
    <http://localhost/graphs/http-requests> 
    { ?r a onto:Request . } 
}
```

### (Q2) Responses (n)

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>
SELECT (COUNT(DISTINCT ?u) AS ?uris)
WHERE {
  GRAPH <http://localhost/graphs/http-requests> {
    ?r a onto:Request ;
       onto:uriRequest ?u .
  }
}
```

### (Q3) URIs (n)

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>
SELECT (COUNT(DISTINCT ?sc) AS ?statusNodes)
WHERE {
  GRAPH <http://localhost/graphs/http-requests> {
    ?resp a onto:Response ;
          onto:sc ?sc .
  }
}
```

### (Q4) StatusCodeNodes (n)

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>
SELECT (COUNT(DISTINCT ?sc) AS ?statusNodes)
WHERE {
  GRAPH <http://localhost/graphs/http-requests> {
    ?resp a onto:Response ;
          onto:sc ?sc .
  }
}
```

### (Q5) Findings (n) by subclass

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?type (COUNT(DISTINCT ?f) AS ?n)
WHERE {
  GRAPH <http://localhost/graphs/findings> {
    ?f a ?type .
    ?type rdfs:subClassOf * onto:Finding .
  }
}
GROUP BY ?type
ORDER BY DESC(?n)
```

## Conformance Check (C1 - C13)
### Request Completeness

#### C1 — Request without method (`onto:mthd`)

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>
SELECT (COUNT(DISTINCT ?r) AS ?missing)
WHERE {
  GRAPH <http://localhost/graphs/http-requests> {
    ?r a onto:Request .
    FILTER NOT EXISTS { ?r onto:mthd ?m . }
  }
}
```

#### C2 — Request without URI (`onto:uriRequest`)

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>
SELECT (COUNT(DISTINCT ?r) AS ?missing)
WHERE {
  GRAPH <http://localhost/graphs/http-requests> {
    ?r a onto:Request .
    FILTER NOT EXISTS { ?r onto:uriRequest ?u . }
  }
}
```

#### C3 — Request without linked Response (`onto:resp`)

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>
SELECT (COUNT(DISTINCT ?r) AS ?missing)
WHERE {
  GRAPH <http://localhost/graphs/http-requests> {
    ?r a onto:Request .
    FILTER NOT EXISTS { ?r onto:resp ?resp . }
  }
}
```

### Response and StatusCodes Completeness

#### C4 — Response without Status node (`onto:sc`)

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>
SELECT (COUNT(DISTINCT ?resp) AS ?missing)
WHERE {
  GRAPH <http://localhost/graphs/http-requests> {
    ?resp a onto:Response .
    FILTER NOT EXISTS { ?resp onto:sc ?sc . }
  }
}
```

#### C5 — StatusCodes without numeric code (`onto:statusCodeNumber`)

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>
SELECT (COUNT(DISTINCT ?sc) AS ?missing)
WHERE {
  GRAPH <http://localhost/graphs/http-requests> {
    ?resp a onto:Response ; onto:sc ?sc .
    FILTER NOT EXISTS { ?sc onto:statusCodeNumber ?n . }
  }
}
```

#### C6 — StatusCodes without reason phrase (`onto:reasonPhrase`)

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>
SELECT (COUNT(DISTINCT ?sc) AS ?missing)
WHERE {
  GRAPH <http://localhost/graphs/http-requests> {
    ?resp a onto:Response ; onto:sc ?sc .
    FILTER NOT EXISTS { ?sc onto:reasonPhrase ?rp . }
  }
}
```

### URI Completeness

#### C7 — URI node without full string (`onto:uri`)

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>
SELECT (COUNT(DISTINCT ?u) AS ?missing)
WHERE {
  GRAPH <http://localhost/graphs/http-requests> {
    ?r a onto:Request ; onto:uriRequest ?u .
    FILTER NOT EXISTS { ?u onto:uri ?full . }
  }
}
```

#### C8 — URI node without scheme or path (`onto:scheme`, `onto:path`)

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>
SELECT
  (SUM(IF(!BOUND(?scheme), 1, 0)) AS ?missingScheme)
  (SUM(IF(!BOUND(?path),   1, 0)) AS ?missingPath)
WHERE {
  GRAPH <http://localhost/graphs/http-requests> {
    ?r a onto:Request ; onto:uriRequest ?u .
    OPTIONAL { ?u onto:scheme ?scheme . }
    OPTIONAL { ?u onto:path ?path . }
  }
}
```

### Header Completeness

#### C9 — Header without name (`onto:fieldName`)

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>
SELECT (COUNT(DISTINCT ?h) AS ?missing)
WHERE {
  GRAPH <http://localhost/graphs/http-requests> {
    ?h a onto:MessageHeader .
    FILTER NOT EXISTS { ?h onto:fieldName ?n . }
  }
}
```

#### C10 — Header without value (`onto:fieldValue`)

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>
SELECT (COUNT(DISTINCT ?h) AS ?missing)
WHERE {
  GRAPH <http://localhost/graphs/http-requests> {
    ?h a onto:MessageHeader .
    FILTER NOT EXISTS { ?h onto:fieldValue ?v . }
  }
}
```

### Findings Completeness

#### C11 — Finding without resolver attribution (`onto:detectedByResolver`)

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT (COUNT(DISTINCT ?f) AS ?missing)
WHERE {
  GRAPH <http://localhost/graphs/findings> {
    ?f a ?t .
    ?t rdfs:subClassOf* onto:Finding .
    FILTER NOT EXISTS { ?f onto:detectedByResolver ?r . }
  }
}
```

#### C12 — Finding without rule id or description (`onto:findingRuleId`, `onto:findingDescription`)

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT
  (SUM(IF(!BOUND(?rid), 1, 0)) AS ?missingRuleId)
  (SUM(IF(!BOUND(?desc),1, 0)) AS ?missingDescription)
WHERE {
  GRAPH <http://localhost/graphs/findings> {
    ?f a ?t .
    ?t rdfs:subClassOf* onto:Finding .
    OPTIONAL { ?f onto:findingRuleId ?rid . }
    OPTIONAL { ?f onto:findingDescription ?desc . }
  }
}
```

#### C13 — Finding without vulnerability type (`onto:aboutVulnerabilityType`)

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT (COUNT(DISTINCT ?f) AS ?missing)
WHERE {
  GRAPH <http://localhost/graphs/findings> {
    ?f a ?t .
    ?t rdfs:subClassOf* onto:Finding .
    FILTER NOT EXISTS { ?f onto:aboutVulnerabilityType ?v . }
  }
}
```

---

