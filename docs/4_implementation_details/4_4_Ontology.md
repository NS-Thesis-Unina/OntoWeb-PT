# Ontologia OntoWebPT
---

Questa sezione descrive in modo dettagliato l’ontologia **OntoWebPT (v1.0.3)** utilizzata dall’Engine/Tool come modello semantico unificato per rappresentare:
- traffico HTTP (request/response, URI, header, status code, body),
- contenuti HTML (tag/field e relazioni parent-child),
- risultati dei resolver (Finding) e loro metadati,
- concetti di vulnerabilità (tipologie astratte e CVE/CWE),
- tracciabilità dell’origine dei finding (resolver che li ha prodotti).

L’ontologia è importata in **GraphDB** all’avvio tramite il container `graphdb-init` (vedi sezione 4.3.3.3) e costituisce la base per tutte le triple generate dai job di analisi.

---

## Identità, versione e namespace

### Ontology IRI e versione
L’ontologia è dichiarata con:

- **Ontology IRI**: `http://localhost/onto/ontowebpt`
- **versionIRI**: `http://localhost/onto/ontowebpt/1.0.3`
- **label**: `OntoWebPT`
- **comment**: `OntoWebPT 1.0.3`

Questo permette:
- versionamento esplicito del modello,
- evoluzioni future mantenendo tracciabilità dell’IRI di versione,
- compatibilità con triple store e strumenti OWL/RDF.

### Namespace principali
Nel file RDF/XML compaiono i seguenti prefissi:

- `ontowebpt:` → `http://localhost/onto/ontowebpt#` (namespace principale)
- `owl:` → `http://www.w3.org/2002/07/owl#`
- `rdf:` → `http://www.w3.org/1999/02/22-rdf-syntax-ns#`
- `rdfs:` → `http://www.w3.org/2000/01/rdf-schema#`
- `xsd:` → `http://www.w3.org/2001/XMLSchema#`
- `content:` → `http://www.w3.org/2008/content#` (usato per datatype del body)

Nel progetto Node.js, questi IRI sono tipicamente parametrizzati tramite variabili:
- `ONT_EX=http://localhost/onto/ontowebpt`
- `ONT_CONTENT=http://www.w3.org/2008/content`

---

## Scopo del modello e separazione in domini concettuali

OntoWebPT struttura la conoscenza in quattro macro-domini fortemente connessi:

1. **Dominio HTTP**
   - classi: `HTTP`, `Message`, `Request`, `Response`, `URI`, `MessageHeader`, `StatusCodes`, `Methods`, `Parameter`, `Cookie`
   - proprietà: collegamenti tra request/response/URI/header e dettagli (method, status, body, ecc.)

2. **Dominio HTML**
   - classi: `HTML`, `Tag`, `Field`
   - proprietà: struttura “DOM-like” (`htmlChild`, `tagHasChildTag`, `tagHasProperties`)

3. **Dominio Findings**
   - classi: `Finding`, `AnalyzerFinding`, `TechstackFinding`, `HttpFinding`
   - proprietà: metadati (severità, descrizione, OWASP, remediation) e link verso HTTP/HTML
   - tracciabilità: `detectedByResolver`, `aboutVulnerabilityType`

4. **Dominio Vulnerabilities**
   - classi: `Vulnerabilities` (radice), specializzazioni (XSS, SQLi, ecc.), entità concrete (CVE), classificazioni (CWE), mapping piattaforme (CPE)

Questa separazione consente:
- query SPARQL leggibili e modulari,
- correlazioni tra livello “evidenza” (HTTP/HTML) e livello “risultato” (Finding),
- estendibilità: nuove vulnerabilità, nuove tipologie di finding, nuove entità HTTP.

---

## Datatypes

### `content:ContentAsBase64`
È definito un datatype RDF per rappresentare body binari o non testuali:

- **IRI**: `http://www.w3.org/2008/content#ContentAsBase64`
- **uso**: range della data property `ontowebpt:body`

Motivazione:
- i body HTTP possono contenere contenuti binari o encoding non UTF-8,
- la serializzazione in Base64 rende la persistenza robusta e coerente con RDF.

---

## Classi e gerarchie

Di seguito le classi principali e le relazioni `rdfs:subClassOf` esplicitate nell’ontologia.

### 1) Classe radice HTTP e derivazioni

- `HTTP`  
  Classe top-level per tutte le entità HTTP.

Sottoclassi rilevanti:
- `Message` ⊑ `HTTP`  
  Base per messaggi HTTP.
  - `Request` ⊑ `Message` (disjoint con `Response`)
  - `Response` ⊑ `Message`
- `MessageHeader` ⊑ `HTTP`
  - `RequestHeader` ⊑ `MessageHeader`
    - `Cookie` ⊑ `RequestHeader`
  - `ResponseHeader` ⊑ `MessageHeader`
    - `Set-Cookie` ⊑ `ResponseHeader`
  - `PayloadHeaders` ⊑ `MessageHeader`
  - `RepresentationHeaders` ⊑ `MessageHeader`
- `URI` ⊑ `HTTP`
- `Parameter` ⊑ `HTTP`
- `Methods` ⊑ `HTTP`
- `StatusCodes` ⊑ `HTTP`
- `HeaderType` ⊑ `HTTP` (classe astratta di classificazione)
- `Connection` ⊑ `HTTP` (indicata come “work in progress”)

### 2) Dominio HTML

- `HTML`  
  rappresenta contenuti HTML associati a messaggi HTTP.

Sottoclassi:
- `Tag` ⊑ `HTML` (nodi “tag”)
- `Field` ⊑ `HTML` (campi/attributi o proprietà di tag)

### 3) Dominio Findings

- `Finding`  
  classe generica per qualsiasi risultato di sicurezza.

Sottoclassi:
- `AnalyzerFinding` ⊑ `Finding`  
  finding derivati da analisi statica su HTML/JS.
- `TechstackFinding` ⊑ `Finding`  
  finding relativi a stack tecnologico, WAF, cookie/header.
  - `HeaderFinding` ⊑ `TechstackFinding`
  - `CookieFinding` ⊑ `TechstackFinding`
  - `SoftwareFinding` ⊑ `TechstackFinding`
- `HttpFinding` ⊑ `Finding`  
  finding derivati da analisi su flussi HTTP (parametri, status, redirect, ecc.)

### 4) Dominio Vulnerabilities

- `Vulnerabilities`  
  radice astratta per tipologie di vulnerabilità.

Sottoclassi:
- `XSS` ⊑ `Vulnerabilities`
  - `Reflected_XSS` ⊑ `XSS`
  - `Stored_XSS` ⊑ `XSS`
  - `DOM-based_XSS` ⊑ `XSS`
- `SQLi` ⊑ `Vulnerabilities`
- `OpenRedirect` ⊑ `Vulnerabilities`
- `PathTraversal` ⊑ `Vulnerabilities`
- `CWE` ⊑ `Vulnerabilities` (classificazione)
- `CVE` ⊑ `Vulnerabilities` (entità concreta con score)

Altre classi:
- `CPE` (piattaforme/componenti software, usata per link a CVE)

---

## Object properties

Le **object properties** collegano entità tra loro (Finding ↔ Resolver, Request ↔ Response, URI ↔ Parameter, ecc.).

### Proprietà di tracciabilità e classificazione finding

- `detectedByResolver`
  - **domain**: `Finding`
  - **range**: `Resolver`
  - scopo: dichiarare quale resolver ha prodotto il finding (Analyzer/Techstack/HTTP).

- `aboutVulnerabilityType`
  - **domain**: `Finding`
  - **range**: `Vulnerabilities`
  - scopo: collegare un finding a una tipologia astratta (es. `SQLi`, `Reflected_XSS`, `OpenRedirect`).

### Proprietà di collegamento finding ↔ evidenze (HTTP/HTML)

- `relatedToHTTP`
  - **domain**: `Finding`
  - **range**: `HTTP`
  - scopo: ancorare un finding a request/response/header/URI/parameter.

- `relatedToHTML`
  - **domain**: `Finding`
  - **range**: `HTML`
  - scopo: ancorare (soprattutto per Analyzer) un finding a un tag/field specifico.

### Proprietà per request/response e componenti HTTP

- `resp`
  - **domain**: `Request`
  - **range**: `Response`
  - scopo: associare la response corrispondente alla request.

- `sc`
  - **domain**: `Response`
  - **range**: `StatusCodes`
  - scopo: associare status code come entità ontologica.

- `mthd`
  - **domain**: `Request`
  - **range**: `Methods`
  - scopo: associare il metodo HTTP come individuo (`GET`, `POST`, ecc.).

- `uriRequest`
  - **domain**: `Request`
  - **range**: `URI`
  - scopo: associare URI/URL target della request.

- `param`
  - **domain**: `URI`
  - **range**: `Parameter`
  - scopo: associare parametri query/URI ad una URI.

### Proprietà per header

- `reqHeader`
  - **domain**: `Request`
  - **range**: `RequestHeader`

- `resHeader`
  - **domain**: `Response`
  - **range**: `ResponseHeader`

- `repHeader`
  - **domain**: `Message`
  - **range**: `RepresentationHeaders`

- `payHeader`
  - **domain**: `Message`
  - **range**: `PayloadHeaders`

Questa distinzione abilita query mirate, ad esempio:
- “tutti gli header di risposta di sicurezza”,
- “tutti gli header payload per richieste POST”.

### Proprietà per findings specifici (cookie/header)

- `refersToHeader`
  - **domain**: `HeaderFinding`
  - **range**: `MessageHeader`
  - scopo: il finding punta all’header coinvolto.

- `refersToCookie`
  - **domain**: `CookieFinding`
  - (range non esplicitato nel file, ma semanticamente riferisce a una cookie/header entity)
  - scopo: collegare finding cookie al cookie specifico.

### Proprietà per findings HTTP (request ↔ http finding)

- `hasHttpFinding`
  - **domain**: `Request`
  - **range**: `HttpFinding`
  - **inverseOf**: `httpFindingOfRequest`

- `httpFindingOfRequest`
  - **domain**: `HttpFinding`
  - **range**: `Request`

Consente query bidirezionali:
- da request a finding,
- da finding alla request sorgente.

### Proprietà per HTML (struttura DOM-like)

- `htmlChild`
  - **domain**: `HTML`
  - **range**: `HTML`
  - scopo: relazione padre/figlio generica.

- `tagHasChildTag`
  - **subPropertyOf**: `htmlChild`
  - **domain**: `Tag`
  - **range**: `Tag`
  - scopo: specializzazione per tag annidati.

- `tagHasProperties`
  - **domain**: `Tag`
  - **range**: `Field`
  - scopo: collegare un tag alle sue proprietà/campi (es. attributi, input field).

### Proprietà per vulnerabilità software (CPE ↔ CVE)

- `platformHasVulnerability`
  - **domain**: `CPE`
  - **range**: `CVE`

È il perno per modellare:
- componenti rilevati (CPE),
- vulnerabilità note correlate (CVE).

---

## Datatype properties

Le **datatype properties** modellano attributi letterali (stringhe, int, float, xml literal, ecc.).

### Attributi principali di Finding

- `severity` (string)  
  severità logica (es. `high`, `medium`, `low`, `info`).

- `findingCategory` (string)  
  categoria (es. “Injection”, “Transport Security”, “DOM XSS”).

- `owaspCategory` (string)  
  mapping verso OWASP Top 10.

- `findingRuleId` (string)  
  identificativo della regola che ha generato il finding.

- `findingDescription` (string)  
  descrizione testuale.

- `remediation` (string)  
  suggerimento di mitigazione.

- `sourceFile` (string), `sourceName` (string), `sinkName` (string)  
  campi utili in finding di analisi statica (sorgente/sink/posizione).

- `sourceLocation` (string)  
  posizione della evidenza (line/column, snippet, outerHTML, ecc.).
  Ha domain union: `Finding ∪ HTML` (riutilizzabile anche su nodi HTML).

### Attributi specializzati di AnalyzerFinding

- `codeSnippet` (string)  
  snippet estratto.

- `contextIndex` (int)  
  indice dell’elemento analizzato (es. script #n).

- `contextOrigin` (string)  
  origine del codice: markup, inline script, external script.

- `contextSrc` (string)  
  URL associato (src di script/iframe).

- `contextType` (string)  
  tipologia contesto: script, form, iframe, html, ecc.

- `formAction` (string), `formMethod` (string)  
  dettagli per finding legati a form.

- `mainDomain` (string)  
  domain union: `AnalyzerFinding ∪ TechstackFinding`  
  dominio “target” dell’analisi.

### Attributi del dominio HTTP

#### Request / Message / Response

- `id` (string)  
  identificatore della Request.

- `httpVersion` (literal)  
  versione HTTP.

- `body` (`content:ContentAsBase64`)  
  body base64 di Message.

#### URI

- `uri` (string)  
  URI completa.

- `scheme` (string), `authority` (literal), `path` (string), `fragment` (string)

- `query` (XMLLiteral)  
  scelta utile per preservare struttura e encoding della query string.

#### Parameter

- `nameParameter` (string)
- `valueParameter` (literal)

#### Header

- `fieldName` (string)
- `fieldValue` (literal)

#### HttpFinding

- `requestUrl` (string)
- `httpMethod` (string)
- `responseStatus` (int)

#### StatusCodes

- `statusCodeNumber` (int)
- `reasonPhrase` (string)

### Attributi CVE

- `cveId` (string)
- `cvssScore` (float)
- `cvssSeverity` (string)

### Attributi cookie

- `cookieName` (string)
- `cookieDomain` (string)

### Connection

- `connectionAuthority` (literal)

---

## Classe Resolver e istanze

### Classe `Resolver`
È una classe astratta per rappresentare il “motore” che produce finding.

Sottoclassi:
- `AnalyzerResolver` ⊑ `Resolver`
- `TechstackResolver` ⊑ `Resolver`
- `HttpResolver` ⊑ `Resolver`

### Named Individuals dei resolver
Sono definiti individui (istanze) per rappresentare i resolver “concreti”:

- `AnalyzerResolverInstance` a `AnalyzerResolver`
- `TechstackResolverInstance` a `TechstackResolver`
- `HttpResolverInstance` a `HttpResolver`

Uso tipico:
- ogni `Finding` generato viene collegato all’istanza del resolver tramite `detectedByResolver`.

Questo abilita query del tipo:
- “tutti i finding prodotti da AnalyzerResolver”
- “distribuzione severità per resolver”

---

## Individuals per metodi HTTP

Sono definiti individui per `Methods`:
- `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`, `TRACE`, `CONNECT`

Questa scelta modella i metodi HTTP come risorse semantiche invece che stringhe, consentendo:
- vincoli e query più coerenti (join su risorse),
- estensioni future (metodi custom o proprietà aggiuntive).

Nota: oltre alla object property `mthd` (Request → Methods), esiste anche `httpMethod` come datatype su `HttpFinding` (string). In pratica:
- `mthd` è il canale ontologico “forte” per le Request,
- `httpMethod` è un attributo di comodo per finding HTTP (es. per export/reporting).

---

## Assiomi e vincoli logici

### Disjointness: Request vs Response
`Request` è dichiarata **disjointWith** `Response`.  
Questo evita inconsistenze (una risorsa non può essere contemporaneamente Request e Response).

### AllDisjointClasses sugli header
È definito un assioma `owl:AllDisjointClasses` tra:

- `PayloadHeaders`
- `RepresentationHeaders`
- `RequestHeader`
- `ResponseHeader`

Significato:
- un header entity non deve appartenere a più di una di queste categorie,
- migliora consistenza e qualità del reasoning.

---

## Pattern di modellazione adottati

### 1) Separazione “risultato” vs “evidenza”
- **Finding** descrive il risultato di sicurezza.
- **HTTP/HTML** descrivono l’evidenza su cui il finding si appoggia.

Collegamenti:
- `relatedToHTTP`
- `relatedToHTML`
- `httpFindingOfRequest` / `hasHttpFinding`

Questo consente:
- navigazione dal finding al contesto reale,
- spiegabilità (“perché è stato generato questo finding?”).

### 2) Tracciabilità del resolver
Ogni finding è tracciato tramite:
- `detectedByResolver` → `ResolverInstance`

Questo permette auditing e confronto tra resolver (precision/coverage).

### 3) Modellazione delle vulnerabilità su due livelli
- **Livello astratto**: `Vulnerabilities` e sue sottoclassi (XSS, SQLi, ecc.)
- **Livello concreto**: `CVE` con attributi CVSS e ID

Il collegamento finding → tipo vulnerabilità avviene via:
- `aboutVulnerabilityType`

Il collegamento software (CPE) → CVE avviene via:
- `platformHasVulnerability`

---

## Integrazione con GraphDB e grafi nominali

Nel sistema applicativo, le triple vengono organizzate tipicamente in **named graph** distinti (configurati via `.env`):

- `HTTP_REQUESTS_NAME_GRAPH=http://localhost/graphs/http-requests`
- `FINDINGS_NAME_GRAPH=http://localhost/graphs/findings`

Uso consigliato coerente con l’ontologia:
- nel grafo HTTP: entità `Request`, `Response`, `URI`, `MessageHeader`, `Parameter`, `StatusCodes`, ecc.
- nel grafo Findings: entità `Finding` e sottoclassi + link `relatedToHTTP/HTML` + metadati e vulnerabilità.

Vantaggi:
- query più efficienti (filtrando per grafo),
- manutenzione e cancellazioni selettive (es. reset solo findings),
- separazione semantica tra dataset “osservato” e dataset “inferito/derivato”.

---

## Esempi di modellazione in triple

### Esempio A: request con metodo e URI
- `:req123 a ontowebpt:Request`
- `:req123 ontowebpt:mthd ontowebpt:GET`
- `:req123 ontowebpt:uriRequest :uri123`
- `:uri123 a ontowebpt:URI`
- `:uri123 ontowebpt:uri "https://example.com/path?x=1"`

### Esempio B: response e status code
- `:res123 a ontowebpt:Response`
- `:req123 ontowebpt:resp :res123`
- `:res123 ontowebpt:sc :status200`
- `:status200 a ontowebpt:StatusCodes`
- `:status200 ontowebpt:statusCodeNumber 200`
- `:status200 ontowebpt:reasonPhrase "OK"`

### Esempio C: finding prodotto da resolver e ancorato a request
- `:f1 a ontowebpt:HttpFinding`
- `:f1 ontowebpt:detectedByResolver ontowebpt:HttpResolverInstance`
- `:f1 ontowebpt:severity "medium"`
- `:f1 ontowebpt:findingRuleId "HTTP-OPEN-REDIRECT-01"`
- `:f1 ontowebpt:aboutVulnerabilityType ontowebpt:OpenRedirect`
- `:f1 ontowebpt:relatedToHTTP :req123`
- `:req123 ontowebpt:hasHttpFinding :f1`

---

## Implicazioni pratiche per query SPARQL

Grazie alla struttura dell’ontologia, risultano naturali query come:

- Tutti i finding per severità e resolver:
  - selezione su `Finding`, join su `detectedByResolver`, filtro su `severity`.

- Tutti i finding relativi a XSS:
  - join su `aboutVulnerabilityType` con filtro su `XSS` o sue sottoclassi.

- Tutti gli header di risposta associati a finding di tipo header:
  - `HeaderFinding` → `refersToHeader` → `MessageHeader` con tipo `ResponseHeader`.

- Ricostruzione contesto:
  - `Finding` → `relatedToHTTP` → `Request` → `resp` → `Response` → `sc`.

---

## Estendibilità prevista

OntoWebPT è predisposta a estensioni senza rompere le query esistenti, seguendo pattern OWL/RDFS:

- aggiungere nuove vulnerabilità:
  - nuove sottoclassi di `Vulnerabilities` (es. `SSRF`, `CSRF`, ecc.)

- aggiungere nuove specializzazioni di finding:
  - nuove sottoclassi di `Finding` (es. `TlsFinding`) mantenendo `Finding` come radice.

- arricchire l’HTML model:
  - nuove proprietà tra `Tag` e `Field`, o nuovi tipi di nodo HTML (es. `ScriptTag`).

- migliorare il dominio software:
  - dettagliare `CPE`, collegare a componenti rilevati, versioning e vendor.

---

## Sintesi

L’ontologia OntoWebPT (1.0.3) realizza un modello semantico coerente per:
- rappresentare traffico HTTP e contesto HTML,
- descrivere finding multi-sorgente (Analyzer/Techstack/HTTP) con metadati uniformi,
- classificare i finding rispetto a tipologie di vulnerabilità e vulnerabilità note (CVE),
- garantire tracciabilità e interrogabilità tramite GraphDB e SPARQL,
- sostenere evoluzioni future tramite estensione di classi e proprietà.

Essa è il “contratto semantico” tra la pipeline di analisi (job/resolver) e la knowledge base persistente (GraphDB).
