# PCAP Upload and Analysis Flow
---

Questo documento descrive il **flusso end-to-end della pagina Dashboard “Send PCAP”**, che consente di:
- caricare un file **PCAP/PCAPNG** e un file **SSL keys** (TLS key log);
- eseguire **decrittazione + estrazione** delle transazioni HTTP lato backend;
- **restituire al Dashboard** l’elenco delle richieste/risposte estratte per preview;
- permettere all’utente di **selezionare un sottoinsieme** da inviare all’ontologia;
- opzionalmente attivare un’analisi aggiuntiva (resolver) sui dati inviati;
- persistere i dati selezionati in **GraphDB** e renderli esplorabili.

Il flusso è **multi-fase** e combina:
- **Synchronous Flow (REST)** per upload + extraction (ritorno della lista richieste) e per l’ingestione dei batch selezionati (ack immediato);
- **Asynchronous Flow (Queue + Worker)** per la persistenza massiva in GraphDB e l’eventuale analisi (resolver);
- **Streaming Feedback (WebSocket)** per job events/log e dialog di riepilogo.

---

![SD](../../../images/5_end_to_end_system_flows/5_3_Dashboard_Flows/5_3_1_PCAP_Upload_Flow/5_3_1_PCAP_Upload_Flow_SD.png)

---

## File upload (Client Action)

Il flusso viene avviato quando l’utente, tramite la pagina **Send PCAP** del Dashboard, esegue un wizard a step:
1. Upload **PCAP/PCAPNG**
2. Upload file **SSL keys** (`.log` / `.txt`)
3. Avvio estrazione **HTTP requests**
4. Preview delle richieste estratte
5. Selezione delle richieste da inviare all’ontologia
6. Conferma invio + opzione **Enable resolver**

Nota: in questa pagina esistono due “azioni” principali lato utente:
- **Extract HTTP requests** (produce un dataset di preview, non scrive ancora in GraphDB);
- **Send requests** (ingestion verso ontologia + job system).

---

## Nginx buffering (Ingress Layer)

Le richieste REST della pagina attraversano lo strato di ingresso:
- **Estrazione**: `Dashboard → Nginx → API Server`
- **Invio selezionate**: `Dashboard → Nginx → API Server`

Responsabilità dell’Ingress Layer:
- **Nginx**
    - reverse proxy e routing;
    - buffering dell’upload multipart (PCAP + SSL keys);
    - applicazione di limiti (size/timeouts) e protezioni base.
- **API Server**
    - validazione preliminare dei file e del payload;
    - health gate (il wizard verifica che il tool sia ON prima di proseguire);
    - orchestrazione: extraction sincrona (risultato al dashboard) e ingestion asincrona (job system).

---

## API → Python script (Extraction phase)

Questa è la fase che **produce la preview**.
1. Il Dashboard invia i file (PCAP + SSL keys) all’API (tipicamente `multipart/form-data`).
2. L’API salva i file temporaneamente (staging).
3. L’API invoca lo script Python che usa `tshark` (configurato via `TSHARK_BIN`) e la TLS key log per:
	- decrittare (dove possibile) traffico HTTPS;   
	- ricostruire transazioni HTTP request/response;
	- serializzare i record estratti in una struttura restituita al client.

Esito:
- l’API **risponde sincronicamente** con un array di richieste/risposte estratte;
- il Dashboard le mostra (step “Preview extracted requests”).

Questa fase è quindi principalmente un **Synchronous Flow (REST)** con processing server-side, ma **senza** passare dalla coda e **senza** persistenza in GraphDB.

---

## Job enqueue (Ingestion phase)

Questa fase avviene **solo dopo** che l’utente seleziona le richieste e conferma l’invio.

Il Dashboard:
- prende `selectedRequests`;
- normalizza i record in un formato di ingestion (“raw items”);
- costruisce batch sicuri (`makeBatchPayloads`) rispettando limiti di size (es. 10MB con safety margin);
- invia uno o più batch via REST all’endpoint di ingestion, includendo il flag:
    - `activateResolver: true|false`.

L’API Server, per ciascun batch:
- valida payload e metadati (es. named graph target);
- crea un job di ingestion delle richieste HTTP (es. queue `http-requests-writes`);
- **se `activateResolver` è true**, crea anche un job separato per l’analisi (resolver) sul batch o sul risultato ingestito (a seconda della pipeline).

Schema di riferimento:
`API Server → Redis Queue (http-requests-writes [+ resolver queue])`

Il Dashboard riceve un acknowledgment con jobId(s) (es. `resRequest.jobId` e opzionale `resResolver.jobId`) e si sottoscrive agli eventi.

---

## Worker execution (Processing Layer – execution)

Un worker disponibile preleva i job dalla/e coda/e.

### Ingestion job (sempre)

- normalizza request/response;
- genera entità coerenti con ontologia (Request, Response, URI, Header, StatusCodes, Parameter…);
- prepara scritture RDF/SPARQL verso GraphDB.

### Resolver job (opzionale)

Se attivato dall’utente:
- esegue regole aggiuntive (es. `HttpResolver` o pipeline equivalente);
- produce eventuali **HttpFinding** collegati alle request persistite.

Durante l’esecuzione:
- il worker emette eventi di avanzamento e log;
- retry secondo policy BullMQ/Redis in caso di errori transitori.

---

## GraphDB persistence (Persistence Layer)

Il worker persiste in GraphDB **solo** le richieste selezionate (non l’intera preview) e le loro correlazioni.

Entità e link tipici:
- `Request → uriRequest → URI`
- `Request → mthd → Methods`
- `Request → resp → Response` (se la response è disponibile)
- `Response → sc → StatusCodes`
- header come `MessageHeader` con `fieldName` / `fieldValue`
- se resolver attivo:
    - `Request → hasHttpFinding → HttpFinding`
    - `Finding → detectedByResolver → HttpResolverInstance`

Questa fase è:
- write-heavy;
- organizzabile su named graph (es. `http://localhost/graphs/http-requests`);
- progettata per essere quanto più possibile idempotente/append-safe tramite id coerenti e deduplica dove applicabile.

---

## Findings visualization (Feedback Channel)

La pagina Send PCAP usa due canali di feedback.

### Streaming (WebSocket)

Dopo l’invio dei batch:
- il Dashboard si sottoscrive ai `jobId` accettati;
- riceve eventi di lifecycle (completed/failed) e progress;
- mostra un dialog “Job Summaries” che si aggiorna live.

Schema:
`Worker / API → WebSocket → Dashboard`

In aggiunta, la pagina implementa polling di fallback (`getHttpIngestResult`) per resilienza in caso di drop WebSocket.

### REST (Synchronous)

- **Preview**: la lista estratta arriva via REST nella fase extraction.
- **Esplorazione successiva**: a job completati, le altre pagine del Dashboard possono interrogare via REST i dati in GraphDB (HTTP Requests / Findings).

---