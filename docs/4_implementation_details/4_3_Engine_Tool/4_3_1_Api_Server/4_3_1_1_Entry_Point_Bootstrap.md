# Entry point e bootstrap
---

Questa sezione descrive come il **Tool API Server** viene inizializzato a runtime: caricamento configurazione, creazione server HTTP/Express, aggancio WebSocket, registrazione dei monitor di salute (Redis/GraphDB) e hardening del processo.

L’entry point applicativo è `server.js`. Il layer BullMQ/Redis è centralizzato in `queue.js`. La parte WebSocket (Socket.IO + BullMQ QueueEvents + streaming log) è in `sockets.js`.

---

## File coinvolti

- `server.js`
  - crea l’istanza Express e l’HTTP server
  - monta route REST (sparql/http-requests/techstack/analyzer/pcap)
  - espone `/health`
  - serve il bundle statico della dashboard
  - aggancia Socket.IO
  - avvia i monitor di salute (Redis + GraphDB)
  - gestisce errori di processo e SIGTERM

- `queue.js`
  - definisce la connessione Redis condivisa
  - istanzia le queue BullMQ (HTTP, SPARQL, Techstack, Analyzer)
  - definisce retry/backoff e retention per job completi/falliti
  - applica un handler comune per errori rumorosi (opzionale)

- `sockets.js`
  - monta Socket.IO sul server HTTP
  - namespace `/logs` (stream log real-time)
  - namespace default (subscribe/unsubscribe a job BullMQ tramite rooms)
  - crea `QueueEvents` per ogni queue e inoltra eventi `completed`/`failed`

---

## Sequenza di bootstrap

### 1) Config e dipendenze base

Nel bootstrap vengono importati i moduli principali:

- `dotenv.config()` carica variabili da `.env`.
- `express` + `cors` + `http` inizializzano lo stack HTTP.
- `celebrateErrors()` registra l’handler degli errori di validazione Celebrate.
- `makeLogger(...)` produce logger con namespace (es. `api`, `ws`, `bull`).
- `./utils/monitors` fornisce il registro di salute (health registry) e i probe (Redis/GraphDB).

**Variabili d’ambiente principali (entry point):**
- `SERVER_PORT` (default `8081`)
- `SERVER_HOST` (default `localhost`, usato solo per logging)
- `SOCKETS_CORS_ORIGIN` (default `*`)
- `GRAPHDB_HEALTH_INTERVAL_MS` (default `5000`)
- Redis/BullMQ: `REDIS_HOST`, `REDIS_PORT`, più le variabili di tuning job/backoff (vedi `queue.js`)

---

### 2) Middleware core Express

Nel file `server.js` vengono installati:

- `cors()`  
  abilita richieste cross-origin. La configurazione è permissiva lato API (nessun origin specifico qui); tipicamente l’hardening avviene a livello reverse proxy o configurazione di deployment.

- `express.json({ limit: '15mb' })`  
  abilita parsing JSON fino a **15 MB**. Questo limite è significativo perché alcuni endpoint (es. ingestion batch HTTP o payload analisi) possono essere voluminosi.

**Impatto architetturale:** il server è predisposto a ricevere payload “grandi” lato REST senza dover ricorrere a multipart, eccetto per l’upload PCAP.

---

### 3) Health endpoint: readiness reale

`GET /health` risponde con:
- `200` solo quando `getHealth().ok === true`
- `503` quando `ok === false`

Viene impostato `Cache-Control: no-store` per evitare caching.

**Composizione dello stato**:
- lo stato del processo API (“server”) viene marcato `up` solo dopo `server.listen(...)`
- Redis e GraphDB vengono aggiornati da monitor periodici che scrivono nel registro con `setState(component, state)`

**Scopo operativo:** orchestratori o reverse proxy possono rimuovere l’istanza dal traffico quando Redis o GraphDB non sono disponibili (readiness, non solo liveness).

---

### 4) Mounting delle route REST

In `server.js` le route sono montate per dominio:

- `/sparql` → `routes/sparql.js`
- `/http-requests` → `routes/httpRequests.js`
- `/techstack` → `routes/techstack.js`
- `/analyzer` → `routes/analyzer.js`
- `/pcap` → `routes/pcap.js`

**Pattern consistente dei router:**
- validazione input tramite `celebrate` (schema per body/query/params)
- operazioni sincrone verso GraphDB: `runSelect(...)`
- operazioni asincrone: enqueue BullMQ con `queueX.add(...)` e risposta `202 Accepted`
- endpoint di polling risultati: `GET /<domain>/results/:jobId` con `queueX.getJob(jobId)` + `job.getState()` + `job.returnvalue`

---

### 5) Serving della dashboard (static hosting)

Dopo le API, il server monta:

- `express.static(path.join(__dirname, 'dashboard'))`
- `app.get('*', ...)` fallback a `dashboard/index.html`

**Effetto:** l’API Server funge anche da host per la UI della dashboard in modalità SPA (routing lato client).

---

### 6) Error handler Celebrate

`app.use(celebrateErrors())` è registrato **dopo** routes e static server.

**Effetto:** qualsiasi errore di validazione schema viene convertito in risposta `400` coerente (senza dover replicare logica per endpoint).

---

### 7) Creazione server HTTP e aggancio WebSocket

- viene creato `const server = http.createServer(app)`
- viene chiamato `attachSockets(server)` (asincrono)

In `sockets.js`:
- Socket.IO viene istanziato con CORS configurabile (`SOCKETS_CORS_ORIGIN`, default `*`)
- vengono creati `QueueEvents` per ciascuna coda BullMQ:
  - http (`queueNameHttpRequestsWrites`)
  - sparql (`queueNameSparqlWrites`)
  - techstack (`queueNameTechstackWrites`)
  - analyzer (`queueNameAnalyzerWrites`)
- prima di servire eventi ai client, `waitUntilReady()` viene atteso per tutte le `QueueEvents`

**Namespace:**
- `/logs`
  - i client possono inviare `log` e il server fa broadcast a tutti
  - il processo API inoltra i propri log con `onLog(...)`
- namespace default
  - `subscribe-job(jobId)` → join room `job:<jobId>`
  - `unsubscribe-job(jobId)` → leave room
  - eventi BullMQ `completed/failed` vengono inoltrati nella room corrispondente

**Nota:** l’implementazione inoltra esplicitamente `completed` e `failed`. Altri eventi (progress/active) non sono forwardati qui e, se necessari, vanno aggiunti in modo analogo.

---

### 8) Avvio listener HTTP e marking “server up”

Il server ascolta su:
- `PORT = SERVER_PORT || 8081`

Una volta in ascolto:
- logga `API listening on http://${HOST}:${PORT}`
- chiama `setState('server', 'up')` nel registro di salute

**Osservazione:** `SERVER_HOST` è usato nel messaggio di log, ma `server.listen` non specifica l’host; quindi l’effettivo bind dipende dal default Node (tutte le interfacce) o da config esterna. Se serve bind esplicito, va passato anche `HOST` a `listen(PORT, HOST, ...)`.

---

### 9) Monitor di salute: Redis e GraphDB

#### Redis monitor

`startRedisMonitor(connection, 'redis:api', callback)` aggiorna:
- `redis = up` se st === 'up'
- `redis = down` se st === 'down'
- altrimenti `redis = connecting`

La connessione Redis usata è quella definita in `queue.js` (con retryStrategy e `enableReadyCheck`).

#### GraphDB probe

`startGraphDBHealthProbe(runSelect, 'graphdb:api', intervalMs, callback)`:
- esegue periodicamente una query (o una chiamata “light”) attraverso `runSelect`
- aggiorna `graphdb` nello stato condiviso

**Effetto:** `/health` rappresenta lo stato reale delle dipendenze esterne su cui si appoggiano endpoint e worker.

---

### 10) Hardening del processo: errori fatali e SIGTERM

In `server.js` sono definiti handler per:

- `unhandledRejection`  
  logga la rejection non gestita.

- `uncaughtException`  
  logga l’eccezione non catturata.

- `SIGTERM`  
  - logga “Shutting down…”
  - setta `server = shutting_down`
  - `process.exit(0)`

**Limite noto:** non viene implementato shutdown “graceful” (chiusura server, wait in-flight requests, drain job, ecc.). In contesti production questo può essere esteso.

---

## Bootstrap BullMQ: code path e policy di retry

Le queue vengono istanziate in `queue.js`, condividendo:

- `connection` Redis con:
  - `enableReadyCheck: true`
  - `retryStrategy(times)` con exponential backoff fino a 30s
  - logging dei retry disabilitabile con `QUIET_REDIS_ERRORS=1`

Ciascuna queue definisce opzioni di default:
- `attempts`
- `backoff` (tipo e delay base)
- retention `removeOnComplete` / `removeOnFail`

E viene applicato un handler comune `q.on('error', ...)` per loggare errori BullMQ, sopprimendo quelli rumorosi (ECONNREFUSED/ETIMEDOUT/...) quando `QUIET_REDIS_ERRORS=1`.

---

## Riepilogo: cosa garantisce il bootstrap

1. **Express** pronto con CORS + parsing JSON (15MB)
2. **Routing REST** montato per domini funzionali
3. **Dashboard SPA** servita dallo stesso processo
4. **/health** come readiness basata su registry interno + probe Redis/GraphDB
5. **WebSocket** integrato:
   - streaming log via `/logs`
   - events job via subscribe a room `job:<jobId>`
6. **BullMQ** configurato con retry/backoff robusto
7. **Process hardening** minimo (log + SIGTERM)

---
