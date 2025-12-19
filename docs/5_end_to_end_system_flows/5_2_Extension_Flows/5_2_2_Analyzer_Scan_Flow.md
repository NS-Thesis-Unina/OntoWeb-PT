# Analyzer Scan Flow
---

Questo documento descrive il **flusso end-to-end di analisi Analyzer (SAST)**, avviato dall’estensione browser e finalizzato all’individuazione di vulnerabilità e pattern pericolosi in **HTML/JavaScript** (es. DOM XSS, sink/source tainting, uso insicuro di API, ecc.), con persistenza semantica dei risultati in GraphDB.
Il flusso è un esempio tipico di **Asynchronous Flow (Queue + Worker)** con **Streaming Feedback** verso il client.

---

![SD](../../../images/5_end_to_end_system_flows/5_2_Extension_Flows/5_2_2_Analyzer_Scan_Flow/5_2_2_Analyzer_Scan_Flow_SD.png)

---

## DOM capture / script extraction (Client Action)

Il flusso viene avviato quando l’utente, tramite l’estensione:
- apre il popup;
- seleziona la **Analyzer View**;
- avvia esplicitamente la scansione della pagina corrente.

L’estensione effettua una raccolta locale dei dati necessari all’analisi statica, tipicamente includendo:
- snapshot del DOM (o porzioni rilevanti);
- estrazione di script inline;
- lista di riferimenti a script esterni (src) e metadati associati;
- individuazione di contesti “sensibili” (form, iframe, event handler, ecc.).

Questa fase serve a produrre un payload coerente e riproducibile dell’asset analizzato, senza svolgere analisi di sicurezza completa lato client.

---

## Payload verso API (Ingress Layer)

Una volta raccolti i dati, l’estensione invia una richiesta REST verso il backend:

`Extension → Nginx → API Server`

Responsabilità dell’Ingress Layer:
- ricezione e routing tramite reverse proxy (Nginx);
- validazione del payload (dimensioni, formato, campi obbligatori);
- normalizzazione dei contenuti (encoding, trimming, campi opzionali);
- preparazione dei metadati di contesto (es. `mainDomain`, URL target, timestamp).

Se la richiesta è valida, l’API risponde rapidamente con un acknowledgment, evitando blocchi su un’operazione potenzialmente lunga.

---

## Job creation (sast-analyze)

Dopo la validazione, l’API Server:
- crea un job di tipo **sast-analyze**;
- assegna un `jobId`;
- inserisce il job nella coda Redis dedicata all’Analyzer.

Schema:

`API Server → Redis Queue (sast-analyze / analyzer-writes)`

Il job contiene:
- contenuti estratti (DOM, script, contesti);
- metadati (dominio, URL, riferimenti);
- opzioni di analisi (se presenti), in modo da rendere deterministico il processing.

---

## AnalyzerResolver (Processing Layer – execution)

Un worker disponibile preleva il job e avvia l’esecuzione del **AnalyzerResolver**.

Attività principali:
- parsing e normalizzazione dei contenuti HTML/JS;
- identificazione di pattern rischiosi (source/sink, API pericolose, DOM manipulation);
- classificazione del finding (categoria, severità, descrizione, remediation);
- produzione di evidenze contestuali:
    - snippet di codice (`codeSnippet`);
    - informazioni sul contesto (`contextType`, `contextOrigin`, `contextSrc`, `contextIndex`);
    - sorgenti e sink (se applicabile).

Durante l’esecuzione:
- il worker emette eventi di avanzamento e log;
- eventuali errori vengono gestiti tramite retry secondo policy.

---

## GraphDB linking (HTML, URI) (Persistence Layer)

Al termine dell’analisi, il worker persiste risultati e collegamenti in GraphDB.

### Entità principali persistite

- **AnalyzerFinding**: rappresenta il finding prodotto dall’AnalyzerResolver.
- **HTML / Tag / Field**: rappresentano i nodi HTML rilevanti (DOM-like), utili a collegare finding a elementi specifici.
- **URI**: rappresenta l’URL/risorsa analizzata (target della scansione).

### Linking semantico tipico

- `Finding → detectedByResolver → AnalyzerResolverInstance`
- `Finding → relatedToHTML → HTML/Tag/Field` (se identificabile il punto nel DOM)
- `Finding → relatedToHTTP → URI` (correlazione al target)
- proprietà descrittive del finding:
    - `findingCategory`, `severity`, `findingDescription`, `remediation`, `owaspCategory`
    - dettagli SAST: `codeSnippet`, `sourceName`, `sinkName`, `sourceLocation`, `sourceFile`
    - contesto: `contextType`, `contextOrigin`, `contextSrc`, `contextIndex`

Schema:

`Worker → GraphDB`

Questa persistenza è progettata per:
- abilitare query e correlazioni nel tempo;
- consentire esplorazione per pagina, dominio, severità, categoria;
- mantenere tracciabilità del resolver che ha prodotto il risultato.

---

## Feedback e visualizzazione (Feedback Channel)

Il feedback verso il client avviene tramite due canali complementari.

### Streaming (WebSocket)

Durante l’esecuzione del job:
- eventi di stato (queued → active → completed/failed);
- log diagnostici e progress.

Schema:

`Worker / API → WebSocket → Extension / Dashboard`

---