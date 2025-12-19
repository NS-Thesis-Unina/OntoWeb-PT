# HTTP Interception Flow
---

Questo documento descrive il **flusso end-to-end di intercettazione e ingestione del traffico HTTP** avviato dall’estensione browser (Interceptor) e finalizzato a:
- raccogliere richieste/risposte osservate durante la navigazione;
- inviarle al backend in modalità **batch**;
- persisterle in GraphDB come base dati interrogabile (HTTP Requests);
- opzionalmente eseguire analisi aggiuntive (**HttpResolver**) per produrre **HttpFinding**.

Il flusso combina:
- un comportamento **continuo lato client** (intercettazione),
- un **Asynchronous Flow (Queue + Worker)** per ingestion/processing,
- **Streaming Feedback** (job events / logs) e aggiornamenti quasi real-time verso Dashboard/Extension.

---

![SD](../../../images/5_end_to_end_system_flows/5_2_Extension_Flows/5_2_3_HTTP_Interception_Flow/5_2_3_HTTP_Interception_Flow_SD.png)

---

## Continuous interception (Client Action)

Il flusso è attivo quando l’utente abilita la modalità **Interceptor** nell’estensione.

L’estensione opera in modo continuo (event-driven) intercettando traffico HTTP osservabile dal contesto browser, tipicamente:
- request URL, method, headers;
- response status, headers;
- (quando disponibile) body o metadati di payload;
- timestamp e contesto del tab/origin.

Caratteristiche chiave:
- l’intercettazione è **incrementale** e non blocca la navigazione;
- l’estensione accumula eventi localmente in una coda/buffer;
- la dimensione del buffer e la frequenza di flush sono governate da policy client-side (batching).

---

## Batch ingestion (Ingress Layer)

Periodicamente (o al raggiungimento di soglie: numero eventi, size, tempo), l’estensione invia un batch al backend via REST:

`Extension → Nginx → API Server`

Responsabilità dell’Ingress Layer:
- Nginx: reverse proxy e buffering della richiesta in ingresso;
- API Server:
    - validazione schema del batch;
    - normalizzazione dei record (header canonicalization, campi opzionali, encoding);
    - deduplicazione/guard-rail basilari (se applicabile);
    - creazione di job asincroni per ingestion e/o analisi.

L’API risponde rapidamente con un acknowledgment, evitando di effettuare parsing e persistenza completa in linea (specialmente per batch grandi).

---

## http-ingest job (Processing Layer – enqueue)

Dopo la validazione, l’API Server crea uno o più job dedicati all’ingestione, ad esempio:
- **http-ingest** (persistenza delle Request/Response in GraphDB),
- eventuali job collegati (scritture SPARQL, correlazioni, enrichment).

Schema:

`API Server → Redis Queue (http-requests-writes / sparql-writes)`

Il job contiene tipicamente:
- lista di transazioni HTTP (request/response);
- metadati (mainDomain, sessione/tab, timestamp);
- opzioni per la persistenza (graph target, idempotency keys, ecc.).

---

## Optional http-resolver (Processing Layer – execution)

Un worker preleva il job e può eseguire due macro-azioni, in base alla configurazione/pipeline:

1. **Ingestion-only**
    - normalizza e persiste Request/Response;
    - non genera finding.
2. **Ingestion + Analysis (HttpResolver)**  
    Oltre alla persistenza, esegue regole di analisi sul traffico, ad esempio:
    - rilevazione pattern di open redirect;
    - path traversal su path/parametri;
    - controlli su method/status anomali;
    - controlli su header/cookie osservati (se delegati all’HttpResolver);
    - correlazioni request↔response.

Durante l’esecuzione:

- il worker emette log ed eventi;
- eventuali record problematici possono essere scartati/isolati senza invalidare l’intero batch (best-effort), a seconda delle policy.

---

## GraphDB persistence (Persistence Layer)

Il worker persiste in GraphDB:
- **Request** e **Response** (come entità HTTP),
- header come **MessageHeader** (RequestHeader/ResponseHeader),
- **URI** e parametri (**Parameter**),
- relazione request↔response (`resp`),
- eventuali finding prodotti (**HttpFinding**) e relativi link.

Linking semantico tipico (coerente con l’ontologia):
- `Request → uriRequest → URI`
- `Request → mthd → Methods`
- `Request → resp → Response`
- `Response → sc → StatusCodes`
- `Request → hasHttpFinding → HttpFinding` (se presenti)
- `HttpFinding → httpFindingOfRequest → Request`
- `Finding → detectedByResolver → HttpResolverInstance` (se HttpResolver attivo)
- proprietà utili per query lato dashboard:
    - request id (`id`), `authority`, `path`, `scheme`, `query`
    - status code (`statusCodeNumber`), `reasonPhrase`
    - header fields (`fieldName`, `fieldValue`)
    - finding fields (`severity`, `findingCategory`, `findingDescription`, `remediation`)

Schema:

`Worker → GraphDB`

Questa persistenza è:
- **write-heavy** e potenzialmente ad alto volume;
- tipicamente organizzata su named graph dedicati (es. HTTP requests graph), per facilitare query e isolamento dei dati;
- progettata per essere quanto più possibile idempotente (o almeno “append-safe”) tramite identificatori/chiavi coerenti.

---

## Live dashboard updates (Feedback Channel)

Il feedback verso i client avviene con due meccanismi complementari.

### Streaming (WebSocket)

Durante ingestion/analysis:
- eventi job lifecycle (queued/active/completed/failed);
- log di worker (utile per osservabilità, debug, progress).

Schema:

`Worker / API → WebSocket → Dashboard / Extension`

Questo canale è cruciale perché il flusso è continuo: consente percezione “live” dell’arrivo dei dati e dello stato del backend.

---