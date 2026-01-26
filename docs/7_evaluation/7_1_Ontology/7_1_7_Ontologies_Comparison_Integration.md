# HTTP Interaction Ontologies: Comparison and Integration in OntoWeb-PT

## Purpose

This document compares three ontologies used to represent HTTP interactions and explains how the first two models are conceptually incorporated and extended inside **OntoWeb-PT**.

**Ontologies under comparison**

1. **W3C HTTP Vocabulary in RDF 1.0**  
   Source: https://www.w3.org/TR/HTTP-in-RDF10/

2. **HTTP Ontology (http-onto, Nereide Labs)**  
   Paper: https://hal.science/hal-02901879v1/file/http-onto.pdf  
   TTL: https://labs.nereide.fr/mthl/http/-/raw/master/http.ttl

3. **OntoWeb-PT**  
   Local ontology file: `ontology.rdf`  
   Base namespace: `http://localhost/onto/ontowebpt#`

---
## High-level positioning

### W3C HTTP Vocabulary in RDF 1.0

The W3C vocabulary is designed to **record HTTP exchanges** in RDF, with emphasis on traceability and reproducibility of client–server interactions. The model is pragmatic and vocabulary-driven, and it is often referenced alongside evaluation reporting workflows.

### HTTP Ontology (http-onto)

The http-onto model refines the same core ideas but pushes further into **OWL-oriented modeling**. It adds stronger structure and semantics, such as functional properties, class partitioning, and a richer URI model with query parameters. It also provides convenience semantics for specific headers through property chains.

### OntoWeb-PT

OntoWeb-PT uses an HTTP interaction model as the evidence layer for a security workflow. It adds a dedicated semantic layer for:

- security findings and resolvers
- vulnerability typing and metadata
- web content and DOM features linked to findings
- evidence preservation choices tuned for penetration testing

OntoWeb-PT is not a direct import of the W3C or http-onto vocabularies. Instead, it implements a closely aligned core model and extends it with security-oriented concepts.

---
## Comparison by modeling dimension

### 1. Core HTTP exchange model

**W3C HTTP-in-RDF**
- Provides `http:Message` with specialized message types for requests and responses.
- Links a request to the corresponding response using `http:resp`.
- Links a response to status information using `http:sc`.

**http-onto**
- Defines `:Message` as a disjoint union of `:Request` and `:Response`.
- Defines `:Response` as a disjoint union of `:InterimResponse` and `:FinalResponse`.
- Uses `:resp` (request → response) and `:sc` (response → status), with `:sc` declared functional.

**OntoWeb-PT**
- Defines `ontowebpt:Message`, `ontowebpt:Request`, `ontowebpt:Response`.
- Uses `ontowebpt:resp` with domain `Request` and range `Response`.
- Uses `ontowebpt:sc` with domain `Response` and range `StatusCodes`.

OntoWeb-PT keeps the core exchange pattern stable and uses it as the anchor for all subsequent enrichment steps.


### 2. HTTP methods

**W3C HTTP-in-RDF**
- Supports method representation through a dedicated property pointing to a method resource and through a literal method name.
- References method registries published as RDF resources.

**http-onto**
- Introduces a `:Method` class and a functional object property `:mthd`.
- Declares a functional `:mthdName` for the method token.
- Provides individuals for standard methods such as GET, POST, PUT.

**OntoWeb-PT**
- Uses a `ontowebpt:Methods` class and `ontowebpt:mthd` (domain `Request`, range `Methods`).
- Includes individuals for standard methods:
  `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`, `HEAD`, `TRACE`, `CONNECT`.
- Also defines `ontowebpt:methodName` as a datatype property on a method resource.

The resulting method layer is close to http-onto in structure, while maintaining compatibility with the W3C vocabulary style.


### 3. Status codes and response status

**W3C HTTP-in-RDF**
- Associates a response with a `http:StatusCode` resource and supports a numeric status code value.

**http-onto**
- Models status as a `:Status` class with a functional numeric code.
- Adds status families such as Informational, Successful, Redirection, Client Error, Server Error through datatype range constraints.
- Uses response partitioning into interim and final responses.

**OntoWeb-PT**
- Models status via `ontowebpt:StatusCodes` and links it from `Response` with `ontowebpt:sc`.
- Provides numeric and textual properties on the status resource:
  `ontowebpt:statusCodeNumber` and `ontowebpt:reasonPhrase`.

OntoWeb-PT captures the same operational status details needed for evidence and security analytics. It does not rely on the richer OWL partitions found in http-onto, which can be added later as an optional reasoning layer.


### 4. URI representation and query parameters

**W3C HTTP-in-RDF**
- Supports request URI logging mainly as literals, with additional properties for absolute URI and key parts.

**http-onto**
- Treats URI as a first-class resource with explicit components:
  scheme, authority, path, query, fragment.
- Adds query parameter resources (`:QueryParam`) linked from a URI via `:queryParams`.
- Uses a functional `:uri` property from request to URI.

**OntoWeb-PT**
- Treats URI as a first-class resource and links it from a request using `ontowebpt:uriRequest` (domain `Request`, range `URI`).
- Captures URI components using datatype properties:
  `scheme`, `authority`, `path`, `query`, `fragment`, plus a full `uri` string.
- Models query parameters as resources:
  `ontowebpt:param` links `URI` to `Parameter`, with `nameParameter` and `valueParameter`.

The URI and parameter layer in OntoWeb-PT is clearly aligned with the structural approach of http-onto while remaining compatible with the W3C goal of replayable evidence capture.


### 5. Headers: storage strategy and classification

**W3C HTTP-in-RDF**
- Represents headers as resources, enabling name–value capture and structured linking.
- Encourages reuse of header registries published as RDF resources.

**http-onto**
- Defines a general `:Header` class with functional `:hdrName` and `:hdrValue`.
- Adds specialized semantics through header classes and property chains, such as a `Location` header leading to a derived `location` property on responses.
- Requires the Host header for requests through a class restriction.

**OntoWeb-PT**
- Represents headers through `ontowebpt:MessageHeader` with:
  `fieldName` and `fieldValue`.
- Adds header categorization to support security analyses:
  `RequestHeader`, `ResponseHeader`, `RepresentationHeaders`, `PayloadHeaders`.
- Links headers to messages through dedicated properties:
  `reqHeader` (Request → RequestHeader),
  `resHeader` (Response → ResponseHeader),
  `repHeader` (Message → RepresentationHeaders),
  `payHeader` (Message → PayloadHeaders).
- Adds cookie-related specializations:
  `Cookie` as a `RequestHeader` subtype and `Set-Cookie` as a `ResponseHeader` subtype.

This design keeps a simple, log-friendly name–value representation while also enabling security-specific filtering and rules over header families.


### 6. Message body and evidence preservation

**W3C HTTP-in-RDF**
- Links the body to content modeled via the W3C Content-in-RDF vocabulary.

**http-onto**
- Uses `cnt:Content` for message bodies.
- Supports RDF content embedded in a body through `cnt:ContentAsRDF` and `sd:Graph`.

**OntoWeb-PT**
- Associates `ontowebpt:body` with `Message`.
- Declares the range as `content:ContentAsBase64`, preserving payload bytes safely across encodings and binary content.

The base64 strategy is well suited for penetration testing pipelines that need stable, replayable evidence and must preserve raw payloads without loss.

---
## How OntoWeb-PT integrates and extends the first two ontologies

### Integration approach

OntoWeb-PT integrates the W3C vocabulary and http-onto through a **conceptual alignment** rather than an explicit import. Names and structures are intentionally close to the two upstream models, which simplifies mapping and interoperability at the data layer.

Key shared patterns:

- **Request–Response linkage**  
  W3C `http:resp`  
  http-onto `:resp`  
  OntoWeb-PT `ontowebpt:resp`

- **Status association**  
  W3C `http:sc`  
  http-onto `:sc`  
  OntoWeb-PT `ontowebpt:sc`

- **Method as a resource**  
  W3C supports a method registry and method name logging  
  http-onto models `:Method` plus `:mthd` and `:mthdName`  
  OntoWeb-PT models `Methods` plus `mthd` and `methodName`

- **URI as a structured node**  
  W3C can store URI parts  
  http-onto makes URI a central class with query parameters  
  OntoWeb-PT uses `URI` plus `Parameter` resources with explicit name and value fields

---
### Enrichment layers added by OntoWeb-PT

OntoWeb-PT extends the HTTP evidence layer with concepts required to support automated web security analysis.

#### 1. Findings and resolvers

OntoWeb-PT introduces a workflow-centric model:

- `Finding` as the main result entity.
- `Resolver` as the component responsible for detection.

Specializations include:

- `HttpFinding` and `HttpResolver`
- `TechstackFinding` and `TechstackResolver`
- `AnalyzerFinding` and `AnalyzerResolver`

The relationship `detectedByResolver` links each finding to its detection component. Findings can also link to the evidence they depend on through:

- `relatedToHTTP` and `relatedToHTML`
- `hasHttpFinding` and `httpFindingOfRequest`

This structure supports a reproducible pipeline where evidence and detection outcomes remain connected.


#### 2. Vulnerability typing and security metadata

OntoWeb-PT models vulnerability categories through `Vulnerabilities` and subclasses:

- `XSS` with `Stored_XSS`, `Reflected_XSS`, `DOM-based_XSS`
- `SQLi`
- `PathTraversal`
- `OpenRedirect`

Findings link to vulnerability classes using `aboutVulnerabilityType`. Additional metadata is captured through datatype properties such as:

- `severity`
- `owaspCategory`
- `remediation`
- `codeSnippet`

This layer has no analogue in W3C HTTP-in-RDF or http-onto, since both focus on HTTP semantics rather than security outcomes.


#### 3. Headers and cookies as analysis targets

OntoWeb-PT makes header families explicit to support security checks such as missing or weak headers, insecure cookies, and misconfigurations.

- `HeaderFinding` refers to headers through `refersToHeader`.
- Cookie-specific structures exist through `CookieFinding` and the specialized header classes `Cookie` and `Set-Cookie`.

http-onto supports header specialization via reasoning patterns. OntoWeb-PT supports security operations through explicit header categories and dedicated finding classes.


#### 4. HTML and DOM evidence

OntoWeb-PT adds an HTML layer to link findings to page structure:

- `HTML` as a container for web content structures
- `Tag` and `Field` to represent DOM elements and attributes
- `tagHasChildTag`, `tagHasProperties`, and `htmlChild` to represent containment

This enables analyzer-driven findings to point to precise web page artifacts.


#### 5. Vulnerability knowledge bases

OntoWeb-PT includes entities to connect findings to known vulnerability identifiers:

- `CVE`, `CWE`, `CPE`

A direct linkage exists at the platform layer:

- `platformHasVulnerability` links `CPE` to `CVE`
- CVSS metadata appears as datatype properties such as `cvssScore` and `cvssSeverity`

This adds a knowledge graph dimension that goes beyond transport-level HTTP semantics.

---
## Practical guidance for formal interoperability

OntoWeb-PT can remain lightweight and still offer a clear interoperability path.

Recommended options:

- Add `owl:imports` for the W3C vocabulary and the http-onto TTL, then use `owl:equivalentClass` and `owl:equivalentProperty` to align core terms.
- Keep OntoWeb-PT as the operational namespace but publish a separate mapping ontology that declares equivalences for:
  `Request`, `Response`, `Message`, `resp`, `sc`, `mthd`, and URI parts.

A mapping layer allows data produced in OntoWeb-PT to be queried through W3C or http-onto terms, improving reuse and long-term maintainability without changing the existing pipeline.

---
## Summary

- W3C HTTP-in-RDF provides a stable, vocabulary-driven foundation for recording HTTP exchanges.
- http-onto adds OWL-centric structure with functional properties, URI decomposition, and reasoning-friendly header semantics.
- OntoWeb-PT reuses the core exchange pattern and enriches it for penetration testing, connecting HTTP evidence to findings, vulnerability typing, HTML artifacts, and vulnerability knowledge bases.

The result is a layered model: HTTP evidence stays close to established representations, while security intelligence is expressed in dedicated classes and relations tailored to automated analysis.

---