# Named Graph Integrity

Named graph integrity validation assesses the logical separation of persisted evidence across named graphs. The validation checks that HTTP evidence and derived findings are stored in the intended graphs and that cross graph references preserve traceability and reduce ambiguity during SPARQL navigation. 

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
### Named Graph Integrity (NG1 - NG8)

| Check | Validated condition |
|------:|----------------------|
| **NG1** | No finding resources are typed in the HTTP graph. |
| **NG2** | No request resources are typed in the findings graph. |
| **NG3** | No response resources are typed in the findings graph. |
| **NG4** | No URI resources are typed in the findings graph. |
| **NG5** | No status code resources are typed in the findings graph. |
| **NG6** | Each HTTP finding references a request that exists in the HTTP graph. |
| **NG7** | Each header finding references a header that exists in the HTTP graph. |
| **NG8** | Each cookie finding references a cookie that exists in the HTTP graph. |

Execute integrity checks ensuring that:
- HTTP evidence classes do not leak into `<FIND-G>`,
- findings do not leak into `<HTTP-G>`,
- cross-graph references point to existing targets.

|      | NG1 | NG2 | NG3 | NG4 | NG5 | NG6 | NG7 | NG8 |
| ---- | --- | --- | --- | --- | --- | --- | --- | --- |
| DSE1 | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   |
| DSE2 | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   |
| DSP1 | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   |
| DSP2 | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   |

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

---

## Integrity Checks (NG1 - NG8)

### NG1 — Findings typed in HTTP graph

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT (COUNT(DISTINCT ?f) AS ?violations)
WHERE {
  GRAPH <http://localhost/graphs/http-requests> {
    ?f a ?t .
    ?t rdfs:subClassOf* onto:Finding .
  }
}
```

### NG2 — Requests typed in findings graph

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>

SELECT (COUNT(DISTINCT ?r) AS ?violations)
WHERE {
  GRAPH <http://localhost/graphs/findings> { ?r a onto:Request . }
}
```

### NG3 — Responses typed in findings graph

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>

SELECT (COUNT(DISTINCT ?r) AS ?violations)
WHERE {
  GRAPH <http://localhost/graphs/findings> { ?r a onto:Response . }
}
```

### NG4 — URIs typed in findings graph

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>

SELECT (COUNT(DISTINCT ?u) AS ?violations)
WHERE {
  GRAPH <http://localhost/graphs/findings> { ?u a onto:URI . }
}
```

### NG5 — StatusCodes typed in findings graph

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>

SELECT (COUNT(DISTINCT ?sc) AS ?violations)
WHERE {
  GRAPH <http://localhost/graphs/findings> { ?sc a onto:StatusCodes . }
}
```

### NG6 — HttpFinding pointing to missing Request in HTTP graph

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>

SELECT (COUNT(DISTINCT ?f) AS ?violations)
WHERE {
  GRAPH <http://localhost/graphs/findings> {
    ?f a onto:HttpFinding ;
       onto:httpFindingOfRequest ?req .
  }
  FILTER NOT EXISTS {
    GRAPH <http://localhost/graphs/http-requests> { ?req a onto:Request . }
  }
}
```

### NG7 — HeaderFinding pointing to missing header in HTTP graph

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>

SELECT (COUNT(DISTINCT ?f) AS ?violations)
WHERE {
  GRAPH <http://localhost/graphs/findings> {
    ?f a onto:HeaderFinding ;
       onto:refersToHeader ?h .
  }
  FILTER NOT EXISTS {
    GRAPH <http://localhost/graphs/http-requests> { ?h a onto:MessageHeader . }
  }
}
```

### NG8 — CookieFinding pointing to missing cookie in HTTP graph

```sparql
PREFIX onto: <http://localhost/onto/ontowebpt#>

SELECT (COUNT(DISTINCT ?f) AS ?violations)
WHERE {
  GRAPH <http://localhost/graphs/findings> {
    ?f a onto:CookieFinding ;
       onto:refersToCookie ?c .
  }
  FILTER NOT EXISTS {
    GRAPH <http://localhost/graphs/http-requests> {
      ?c a ?t .
      VALUES ?t { onto:Cookie onto:Set-Cookie }
    }
  }
}
```

---
