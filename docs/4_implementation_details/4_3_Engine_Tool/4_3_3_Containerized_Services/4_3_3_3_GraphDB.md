# GraphDB
---

GraphDB è utilizzato come **triple store RDF** e rappresenta il **sistema di persistenza principale** dell’Engine/Tool.  
Tutti i risultati prodotti dai resolver (Analyzer, Techstack, HTTP) vengono convertiti in triple RDF e salvati in GraphDB, rendendo possibile l’interrogazione tramite **SPARQL** e la correlazione semantica basata sull’ontologia OntoWebPT.

GraphDB è impiegato come **servizio infrastrutturale standard**, senza estensioni custom lato database: la logica di mapping e insert RDF è interamente gestita dal codice Node.js.

---

## 1) Definizione nel docker-compose

Il servizio GraphDB è definito come:
- **Image**: `ontotext/graphdb:10.8.11`
- **Container name**: `graphdb`
- **Port mapping**: `7200:7200`
- **Volume**: `graphdb_data:/opt/graphdb/home`
- **Environment**:
  - `JAVA_OPTS=-Xms1g -Xmx2g`
- **Restart policy**: `unless-stopped`
- **Network**: `backend`

Il volume `graphdb_data` garantisce la persistenza di:
- repository RDF,
- indici,
- configurazione runtime del database.

---

## 2) Repository e configurazione RDF4J

Il repository principale utilizzato dal sistema è:
- **Repository ID**: `ontowebpt`

La sua configurazione è definita nel file `repository.ttl`, montato nel container di inizializzazione (`graphdb-init`).  
I parametri più rilevanti sono:
- **Tipo repository**: `graphdb:SailRepository`
- **Ruleset**: `rdfsplus-optimized`
- **Inferenza**: abilitata (RDFS+)
- **sameAs**: disabilitato (`disable-sameAs=true`)
- **Context index**: disabilitato
- **FTS index**: disabilitato (nessuna full-text search custom)
- **Query timeout**: illimitato (`0`)
- **Storage**: file-based (`file-repository`)

Questa configurazione privilegia:
- consistenza semantica,
- inferenza leggera ma utile,
- prestazioni stabili su insert frequenti.

---

## 3) Ontologia OntoWebPT

L’ontologia (`ontology.rdf`) definisce il **modello concettuale** su cui si basa l’intero sistema.

Caratteristiche principali:
- **IRI base**: `http://localhost/onto/ontowebpt`
- **Versione**: `1.0.3`
- **Classi principali**:
  - `Finding`, `AnalyzerFinding`, `TechstackFinding`, `HttpFinding`
  - `Request`, `Response`, `URI`, `Header`, `Parameter`, `Cookie`
  - `Resolver`, `AnalyzerResolver`, `TechstackResolver`, `HttpResolver`
  - `Vulnerabilities` (XSS, SQLi, OpenRedirect, PathTraversal, ecc.)
- **Proprietà chiave**:
  - collegamento finding ↔ resolver (`detectedByResolver`)
  - collegamento finding ↔ HTTP/HTML (`relatedToHTTP`, `relatedToHTML`)
  - metadati di severità, categoria, OWASP, remediation

L’ontologia è progettata per:
- supportare correlazioni cross-resolver,
- mantenere IRIs stabili per deduplicazione,
- facilitare interrogazioni SPARQL complesse.

---

## 4) Container di bootstrap: graphdb-init

Il container `graphdb-init` è un **job di inizializzazione** che viene eseguito una sola volta.

Funzioni principali:
1. **Attesa readiness di GraphDB**
   - polling su `/rest/repositories` fino a HTTP 200.
2. **Creazione del repository**
   - verifica se `ontowebpt` esiste,
   - se assente, POST del file `repository.ttl`.
3. **Import ontologia**
   - esegue una query `ASK` per verificare la presenza di un’istanza `owl:Ontology`,
   - se assente, carica `ontology.rdf` via:
    ```
     POST /repositories/ontowebpt/statements
     Content-Type: application/rdf+xml
    ```
4. **Idempotenza**
   - se repository e ontologia sono già presenti, il container termina senza modifiche.

Il container non resta attivo dopo l’inizializzazione (`restart: "no"`).

---

## 5) Integrazione con Node API e Worker

I componenti applicativi comunicano con GraphDB tramite:
- **Base URL**: `http://graphdb:7200`
- **SPARQL endpoint**:
  - Query: `/repositories/ontowebpt`
  - Update: `/repositories/ontowebpt/statements`

Le operazioni principali sono:
- **INSERT DATA / INSERT WHERE**
  - persistenza di finding, richieste HTTP, HTML, CVE, ecc.
- **SELECT / ASK**
  - verifica esistenza entità,
  - deduplicazione IRIs,
  - controlli di stato.

GraphDB **non esegue logica applicativa**, ma funge da backend semantico interrogabile.

---

## 6) Persistenza e ciclo di vita dei dati

Tutti i dati persistiti in GraphDB sono:
- **durabili** (su volume Docker),
- **versionabili semanticamente** tramite ontologia,
- **indipendenti dal job system**.

Anche in caso di:
- crash del worker,
- restart dell’API,
- pulizia delle code Redis,

i dati RDF restano invariati e interrogabili.

---

## 7) Sicurezza e accesso

- GraphDB è esposto sulla porta **7200**, ma usato principalmente sulla rete `backend`.
- Non sono configurate credenziali o ACL custom (ambiente controllato).
- In un deployment avanzato, è possibile:
  - disabilitare l’esposizione diretta della porta,
  - aggiungere autenticazione,
  - isolare ulteriormente il servizio.

---

## 8) Limiti e non-obiettivi

- GraphDB **non** è utilizzato come:
  - cache,
  - message queue,
  - database transazionale classico.
- Non sono implementate:
  - stored procedure,
  - regole custom SPARQL,
  - reasoning OWL completo (solo RDFS+).

GraphDB è deliberatamente usato come **knowledge base semantica**, non come database general-purpose.

---

## 9) Ruolo complessivo nell’Engine/Tool

GraphDB costituisce il **livello di persistenza semantica** del sistema:

- Redis → stato transitorio dei job  
- GraphDB → conoscenza persistente e interrogabile  

Questa separazione consente:
- resilienza operativa,
- analisi post-scan,
- correlazione avanzata dei risultati di sicurezza.

---
