# Dashboard
---

## Panoramica

La **Dashboard web** è una SPA React servita dal backend Node.js e rappresenta l’interfaccia principale per consultare ciò che l’Engine/Tool ha già analizzato e memorizzato nell’ontologia.

A differenza dell’estensione, la dashboard **non esegue scansioni**: lavora esclusivamente su dati già presenti nel backend (HTTP requests, risultati di Analyzer/Techstack/HTTP resolver, job BullMQ, stato dei servizi, ecc.) e offre un flusso guidato per importare traffico da file PCAP.

Dal punto di vista architetturale:
- viene inizializzata dal backend come applicazione React “classica”;
- comunica con il Tool tramite **REST API** e **WebSocket (Socket.IO)**;
- non mantiene stato persistente locale (a parte lo stato React in memoria);
- è organizzata per sezioni funzionali, ognuna mappata su una route.

---

## Architettura e componenti

### Struttura della SPA

L’entry point è `main.jsx`, che monta l’applicazione React e compone i provider globali:
- **`ThemeModeProvider`**  
  Gestisce il tema chiaro/scuro e rende disponibile il contesto di tema a tutta la UI (default: dark).
- **`SnackbarProvider`** (notistack)  
  Fornisce un canale globale per notifiche toast (success/error/warning) usate da tutte le pagine.
- **`BrowserRouter`**  
  Abilita il routing client-side basato sulla History API (`/home`, `/http-requests`, ecc.).
- **`Router`**  
  Definisce tutte le route e le pagine collegate (vedi sezione successiva).

Il layout principale è il componente **`App`**, che:
- incapsula la struttura di base della pagina (`<div className="app-div">`);
- include il **`NavigationWrapper`** (header/menu/side nav);
- espone un `<Outlet />` di React Router dove viene renderizzata la pagina figlia corrente.

In questo modo:
- nav e chrome restano fissi;
- cambia solo il contenuto centrale in base alla route.

---

### Routing e sezioni principali

Il router (`router.jsx`) definisce un **root layout** `/` con varie rotte nidificate:
- `/` e `/home` → **`Home`**  
  Pagina di benvenuto con descrizione del prodotto e card di accesso rapido alle altre sezioni:
  - Requests
  - Findings
  - Send PCAP
  - Tool Status
  - OpenAPI
  
- `/http-requests` → **`HttpRequests`**  
  Elenco paginato e filtrabile di tutte le HTTP Request presenti in GraphDB.

- `/findings` (sezione Findings, con sottoroute):
  - `/findings` (index) → **`HttpFindings`**  
    Findings generati dal resolver HTTP.
  - `/findings/analyzer` → **`AnalyzerFindings`**  
    Findings derivati dall’HTML Analyzer.
  - `/findings/techstack` → **`TechstackFindings`**  
    Findings derivati dal Techstack resolver.
  
- `/server-status` → **`ToolStatus`**  
  Vista di **stato operativo** del Tool (API, Redis, GraphDB, WebSocket + log in streaming).

- `/send-pcap` → **`SendPcap`**  
  Wizard a step per:
  1. caricare PCAP e TLS key log;
  2. estrarre le HTTP request;
  3. selezionare quali inviare all’ontologia;
  4. monitorare i job di ingest/resolver.

- `/openapi` → **`OpenAPI`**  
  Explorer dell’OpenAPI spec del backend, raggruppando gli endpoint per tag.

---

## Servizi di accesso al backend

Tutta la comunicazione col Tool è incapsulata in **service modules** che usano un `httpClient` Axios-like e, dove serve, Socket.IO.

### HTTP Requests Service — `httpRequestsService`

Responsabile di tutte le operazioni sul dominio **HTTP Requests**:

- `ingestHttpRequests(payload)`  
  POST `/http-requests/ingest-http`  
  Invia batch di richieste HTTP raw (di solito derivati da PCAP o da altre fonti) per l’ingest nel grafo.  
  Restituisce tipicamente:
  - metadati del job di ingest (`resRequest`);
  - facoltativamente un job per il resolver (`resResolver`).

- `getHttpIngestResult(jobId)`  
  GET `/http-requests/results/:jobId`  
  Recupera lo stato di un job di ingest (queue `http` su BullMQ).

- `listHttpRequests(params)`  
  GET `/http-requests/list`  
  Restituisce una lista paginata di richieste HTTP; supporta numerosi filtri (method, scheme, authority, path, headerName/value, testo full-text).

- `getHttpRequestById(id)`  
  GET `/http-requests/:id`  
  Recupera il dettaglio completo di una singola richiesta.

- `listHttpFindings(params)`  
  GET `/http-requests/finding/list`  
  Lista paginata di findings HTTP.

- `getHttpFindingById(id)`  
  GET `/http-requests/finding/:id`  
  Dettaglio di un singolo finding HTTP.

Queste API alimentano:
- la pagina **HttpRequests**;
- la sezione **HTTP Findings**;
- la parte finale del wizard **Send PCAP** (ingest e polling jobs).

---

### Analyzer Service — `analyzerService`

Gestisce le chiamate relative all’HTML Analyzer:

- `analyzeWithAnalyzer(body)`  
  POST `/analyzer/analyze`  
  Sottomette un job di analisi (usato più per integrazioni future che dalla UI attuale).

- `getAnalyzerResult(jobId)`  
  GET `/analyzer/results/:jobId`  
  Recupera il risultato di un job di Analyzer.

- `listAnalyzerFindings(params)`  
  GET `/analyzer/finding/list`  
  Restituisce solo gli **ID** delle finding, usati come righe nella griglia.

- `getAnalyzerFindingById(id)`  
  GET `/analyzer/finding/:id`  
  Dettaglio completo del singolo finding.

Usato principalmente dalla pagina **Analyzer Findings**.

---

### Techstack Service — `techstackService`

Wrapper degli endpoint Techstack:

- `analyzeTechstack(body)` → POST `/techstack/analyze`

- `getTechstackResult(jobId)` → GET `/techstack/results/:jobId`

- `listTechstackFindings(params)` → GET `/techstack/finding/list`

- `getTechstackFindingById(id)` → GET `/techstack/finding/:id`

La Dashboard, lato UI, utilizza in particolare gli endpoint di **listing e dettaglio findings** per la pagina **Techstack Findings**.

---

### PCAP Service — `pcapService`

Responsabile dell’upload dei file PCAP e TLS keys:

- `extractHttpRequestsFromPcap(pcapFile, sslKeysFile)`  
  POST `/pcap/pcap-http-requests` (multipart/form-data)  
  Invia:
  
  - `pcap` (.pcap/.pcapng)
  
  - `sslkeys` (.log/.txt)  
    Il backend restituisce un array di richieste HTTP/HTTP2 decodificate, che verranno poi mostrate nel wizard **Send PCAP**.

---

### Health Service — `healthService`

Gestisce lo stato globale del Tool:

- `getHealth()`  
  GET `/health` → `{ ok, components: { server, redis, graphdb }}`

- `deriveToolStatus(health)`  
  Funzione client che sintetizza un’etichetta:
  - `tool_on` → tutto ok e tutti i componenti `up`;
  - `checking` → stato intermedio / parzialmente disponibile;
  - `tool_off` → errore, API non raggiungibile o tutti i componenti down.

Utilizzato da:

- pagina **ToolStatus** (polling periodico ogni 5s);

- wizard **SendPcap**, come gate before-continue per garantire che il Tool sia “ON” prima di procedere con estrazione o ingest.

---

### Socket Service — `socketService`

Incapsula l’uso di **Socket.IO** per notifiche realtime relative ai job:

- risolve la base URL dei socket partendo da:
  1. variabile `VITE_SOCKETS_URL` (se presente);
  2. `httpClient.defaults.baseURL`;
  3. `window.location.origin`.

- `subscribeJob(jobId)`  
  Emissione evento `subscribe-job` verso il server per iscriversi agli eventi di un job BullMQ.

- `unsubscribeJob(jobId)`  
  Emissione evento `unsubscribe-job`.

- `onJobEvent(handler)`  
  Registra un handler per gli eventi:
  - `completed`
  - `failed`

  Normalizza il payload in `{ event: 'completed'|'failed', ... }` e restituisce una funzione di **unsubscribe**.

È usato principalmente da **SendPcap** per seguire lo stato:
- dei job di ingest HTTP;
- degli eventuali job di resolver associati.

La pagina **ToolStatus**, invece, usa direttamente `io(...)` per:
- monitorare la **connessione WebSocket principale**;
- connettersi al namespace `/logs` per lo streaming dei log.

---

### SPARQL Service — `sparqlService`

Offre un’API minimale per interagire con GraphDB tramite backend:

- `runSparqlQuery(sparql)`  
  POST `/sparql/query` → esecuzione sincrona di SELECT/ASK/DESCRIBE/CONSTRUCT.

- `enqueueSparqlUpdate(sparqlUpdate)`  
  POST `/sparql/update` → enqueue di UPDATE SPARQL, che il backend può gestire in modo asincrono.

La UI corrente non espone ancora una pagina dedicata, ma questi servizi costituiscono il punto di aggancio per future viste avanzate (console SPARQL, job SPARQL, ecc.).

---

## Flussi di dati principali

### Navigazione e layout

1. `main.jsx` monta l’app sotto `#root` con providers (tema, snackbars, router).
2. `App` rende il `NavigationWrapper` e l’`Outlet`.
3. Il `Router` sceglie la pagina in base alla path.
4. Ogni pagina utilizza i servizi appropriati per ottenere dati dal backend, gestire loading/error e renderizzare componenti MUI/DataGrid.

---

### Consultazione HTTP Requests

Coinvolge la pagina **`HttpRequests`**:

1. Stato locale:
   - `loading`
   - `params` (limit/offset)
   - `page` (metadati di paginazione ritornati dal backend)
   - `rows` (requests)
   - `filters` (metodo, scheme, authority, path, headerName/value, testo full-text).

2. Funzione `buildRequestParams()`:
   - combina offset/limit con i filtri;
   - normalizza stringhe e scarta valori vuoti.

3. `fetchRequests(offset, limit, overrideFilters?)`:
   - imposta `loading = true`;
   - invoca `httpRequestsService.listHttpRequests(params)`;
   - aggiorna `rows`, `page`, `params`, `filters`;
   - mostra snackbars di successo/errore.

4. Il **filtro** è orchestrato tramite componenti figli:
   - `HttpRequestsFilters` → aggiorna i filtri controllati e invoca `onApply` / `onReset`;
   - `HttpRequestsDataGrid` → presenta i risultati e gestisce cambio pagina (server-side pagination).

---

### Consultazione Findings (HTTP / Analyzer / Techstack)

Le pagine:
- **`HttpFindings`**
- **`AnalyzerFindings`**
- **`TechstackFindings`**

condividono un pattern comune:
1. Stato locale: `loading`, `params` (offset/limit), `page`, `rows`.
2. `useEffect` iniziale → fetch della prima pagina.
3. Funzione `fetchFindings(offset, limit)`:
   - chiama il service appropriato:
     - `httpRequestsService.listHttpFindings`
     - `analyzerService.listAnalyzerFindings`
     - `techstackService.listTechstackFindings`
   - adatta l’array di ID in forma `{ id }` per la DataGrid.
4. In caso di errori → snackbar.
5. Griglia specifica (`HttpFindingsDataGrid`, `AnalyzerFindingsDataGrid`, `TechstackFindingsDataGrid`) gestisce:
   - visualizzazione righe;
   - paginazione server-side;
   - apertura dei dettagli (via chiamata `get...FindingById` nella drawer/side panel).

Ogni pagina include inoltre un pannello introduttivo (`Paper + Zoom`) che spiega il tipo di finding visualizzato.

---

### Workflow “Send PCAP”

Il wizard **`SendPcap`** è la componente più ricca a livello di flusso.

#### Stepper e stato

- 6 step verticali:
  1. Upload PCAP
  2. Upload SSL keys
  3. Extract HTTP requests
  4. Preview extracted requests
  5. Select requests for ontology
  6. Confirm and send

- Stato principale:
  - `activeStep` (0..5)
  - file: `pcapFile`, `sslKeysFile`
  - richieste: `requests` (estratte), `selectedRequests` (selezionate)
  - flag async: `loadingExtract`, `loadingSend`
  - controllo health: `checkingTool`
  - opzione: `activateResolver` (boolean)
  - errori globali: `errorMessage`
  - job lifecycle: `jobEvents`, `subscribedJobIdsRef`, `openJobsDialog`.

#### Validazioni e health gate

- Ogni transizione col bottone **Continue** passa da `checkToolBeforeContinue()`:
  - chiama `healthService.getHealth()` + `deriveToolStatus`;
  - se lo stato è `tool_off` → errore bloccante (“abilita il tool prima di continuare”).

- Step 0/1 validano i tipi di file:
  - PCAP: `.pcap` / `.pcapng`;
  - TLS keys: `.log` / `.txt`.

#### Estrazione HTTP (Step 2–3)

- `extractRequests()`:
  - verifica la presenza dei due file;
  - usa `pcapService.extractHttpRequestsFromPcap(pcapFile, sslKeysFile)`;
  - salva il risultato in `requests` (array di entry HTTP);
  - azzera `selectedRequests`;
  - se l’array è vuoto → messaggio “No HTTP requests were extracted…”;
  - imposta `activeStep = 3` per mostrare la preview.

- Step 3:
  - mostra i risultati in sola lettura tramite `PcapRequestsDataGrid`.

#### Selezione richieste (Step 4)

- Step 4:
  - component `PcapRequestsDataGridSelectable` presenta le stesse richieste ma con possibilità di selezione multipla;
  - `onSelectionChange` aggiorna `selectedRequests`.

L’utente non può proseguire allo step 5 se non ha selezionato almeno una richiesta.

#### Invio all’ontologia (Step 5)

- `mapPcapItemsToRawItems()`:
  - converte le entry PCAP in “raw items” compatibili con `/http-requests/ingest-http`:
    - normalizza headers `name:value` in oggetti;
    - mantiene eventuale `response.body` (base64) e `bodyEncoding`.

- `makeBatchPayloads()`:
  - spezza le richieste selezionate in batch di dimensione massima (10MB meno margine di sicurezza);
  - allega le informazioni sul grafo target (`VITE_CONNECT_HTTP_REQUESTS_NAME_GRAPH` o default).

- `sendRequestsToOntology()`:
  1. valida che ci siano `selectedRequests`;
  2. mappa in raw items;
  3. genera i batch;
  4. per ogni batch:
     - chiama `httpRequestsService.ingestHttpRequests({ ...batch, activateResolver })`;
     - se il backend ritorna `resRequest.jobId` / `resResolver.jobId`, chiama `subscribeJob(jobId)` via `socketService`;
  5. calcola quanti job sono stati accettati e mostra una snackbar riepilogativa;
  6. apre la dialog **Job Summaries** (`openJobsDialog = true`).

#### Job monitoring: WebSocket + polling

- All’inizializzazione del componente, `useEffect` registra `socketService.onJobEvent`:
  - ogni evento `completed`/`failed` viene aggiunto a `jobEvents`.
- Una `useMemo` deriva da `jobEvents` una lista di **job summaries**:
  - `jobId`, `queue`, ultimo evento, flag `completed`/`failed`, trail `raw`.
- Quando la dialog è aperta (`openJobsDialog = true`), un altro `useEffect`:
  - effettua polling periodico (3s) di `httpRequestsService.getHttpIngestResult(id)` per ogni job ancora in corso;
  - sintetizza un finto evento (`completed` | `failed` | `update`) e lo aggiunge a `jobEvents`;
  - rimuove l’ID dal set quando lo stato passa a `completed` o `failed`.
- Alla chiusura della dialog (`handleCloseJobsDialog()`):
  - viene inviato `unsubscribeJob(id)` per tutti i job ancora sottoscritti;
  - si resetta lo stato del wizard, riportandolo allo step 0 e svuotando richieste/selezioni/errori.

---

### Monitoraggio Tool Status & Log Streaming

La pagina **`ToolStatus`** combina **REST polling** e **WebSocket**:

1. Stato:
   - `health` (payload `/health`);
   - `wsStatus` (`connected`/`disconnected`);
   - `toolStatus` (`tool_on`/`checking`/`tool_off`);
   - `logs` (buffer circolare degli ultimi ~80 eventi).

2. Polling `/health`:
   - `useEffect` chiama `getHealth()` all’avvio e ogni 5s;
   - calcola `toolStatus` con `deriveToolStatus()`;
   - se la chiamata fallisce → `health = null`, `toolStatus = 'tool_off'`.

3. WebSocket root:
   - un `useEffect` apre una connessione Socket.IO verso `VITE_LOGS_WS_URL` (default `http://localhost:8081`);
   - aggiorna `wsStatus` su `connect` / `disconnect`.

4. WebSocket namespace `/logs`:
   - altro `useEffect` apre una connessione a `VITE_LOGS_WS_URL_LOGS` o `http://localhost:8081/logs`;
   - ascolta l’evento `log` che contiene: 
     - timestamp (`ts`), livello (`level`), namespace (`ns`), messaggio (`msg`);
   - mantiene nel buffer solo la coda degli ultimi ~80 log.
   
5. UI:
   - una **card principale** riassume `toolStatus` con progress bar colorata;
   - una griglia di `StatusCard` mostra:
     - API Server, Redis, GraphDB, WebSocket;
   - un pannello di log in tempo reale visualizza gli eventi così come arrivano.

---

### OpenAPI Explorer

La pagina **`OpenAPI`**:
1. Carica dinamicamente il file `openapi.json` dal bundle.
2. Scorre `schema.paths` e per ogni path:
   - identifica le operation HTTP (`get`, `post`, `put`, `delete`, `patch`, `options`, `head`);
   - costruisce un gruppo per `tag` (o `General` se assente);
   - unisce i parametri definiti a livello di path e quelli a livello di operation (`mergeParameters`).
3. Passa ogni gruppo a un componente `OpenAPIGroup` che renderizza:
   - metodo, path, summary, description;
   - parametri, requestBody, responses.

Serve come documentazione interattiva delle API a cui la dashboard stessa si appoggia.

---

## Tecnologie usate

- **React** per la UI.
- **React Router** per il routing SPA.
- **Material UI (MUI)** per componenti di interfaccia (Button, Paper, Card, Grid, Stepper, ecc.).
- **notistack** per le notifiche globali.
- **socket.io-client** per la comunicazione WebSocket (job events e log streaming).
- **Axios** (via `httpClient`) per le chiamate REST verso il backend.
- Variabili d’ambiente **Vite** (`import.meta.env.*`) per parametri come:
  - base URL HTTP;
  - endpoint WebSocket;
  - nome del grafo HTTP di destinazione.

---

## Interfacce con l’Engine/Tool

La Dashboard dialoga con il Tool esclusivamente tramite:
- **REST API**:
  - `/http-requests/*`
  - `/analyzer/*`
  - `/techstack/*`
  - `/pcap/pcap-http-requests`
  - `/sparql/query`, `/sparql/update`
  - `/health`

- **WebSocket / Socket.IO**:
  
  - namespace root:
    - gestione stato connessione;
    - eventi generici (“completed”/“failed”) per job;
  
  - namespace `/logs`:
    - stream dei log di API/worker.

Non esistono meccanismi di **lock** o concorrenza come nell’estensione: la Dashboard è **read-only** (salvo l’invio esplicito di PCAP/HTTP) e tutte le operazioni di analisi, ingestion e risoluzione risiedono interamente sul backend.

---