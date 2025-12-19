# Tool Integration (REST / WS)
---

L’estensione integra un **Tool esterno** (server Node.js) che espone API **REST** e un canale **WebSocket (Socket.io)**. L’integrazione è pensata per supportare workflow asincroni basati su code (BullMQ/Redis) e per mantenere la UI reattiva anche in condizioni di rete non ideali.

Architettura di riferimento:
**React UI → ToolReactController → ToolBackgroundController → ToolEngine → Tool Server (REST + WS)**

---

### REST Integration

---

Le chiamate REST vengono gestite **solo** dal `ToolEngine` (background). I componenti React inviano comandi al background tramite `runtime.sendMessage`, evitando logica di networking nella UI.

#### Health check e stato Tool

Endpoint: `GET /health`

- `ToolEngine.checkHealth()` esegue la richiesta e aggiorna uno **stato cache** (`this.status`).
- In caso di errore, viene applicato un fallback “unreachable” con componenti marcati come `down`.
- `ToolReactController.getHealth()` gestisce un ulteriore fallback in caso di impossibilità a parlare con il background (es. service worker non disponibile), restituendo un payload coerente per la UI.

Polling:
- `ToolReactController.startPolling(intervalMs)` richiede al background di avviare un polling periodico.
- `ToolEngine.startPolling()` attiva un timer, esegue un controllo immediato e poi ripete la chiamata a intervallo.

Stati UI:
- **checking**: stato iniziale (UI in attesa della prima risposta).
- **ready**: `ok === true` e tutti i componenti risultano `up`.
- **unreachable / down**: `ok === false` o almeno un componente non è `up`.

Esempio d’uso in UI:
- La navbar mantiene un indicatore globale (“Tool Checking / Tool On / Tool Off”) basato sul payload /health.
- I wizard (Analyzer/Techstack/Interceptor) disabilitano azioni quando lo stato non è “ready”.

#### Enqueue job (submit)

La submission di operazioni asincrone avviene via POST; il backend risponde tipicamente con `{ accepted, jobId, ... }`.

Endpoint principali:
- `POST /http-requests/ingest-http`  
  usato per inviare batch di richieste catturate dall’Interceptor (`ToolEngine.ingestHttp(payload)`).
- `POST /techstack/analyze`  
  submission di snapshot Techstack (`ToolEngine.analyzeTechstack(payload)`).
- `POST /analyzer/analyze`  
  submission di snapshot Analyzer one-time / runtime (`ToolEngine.analyzeOneTimeScan(payload)`).

Caratteristiche comuni:
- uso di `AbortController` con timeout configurabile (`EXTENSION_PUBLIC_REQUESTS_ABORT_MS`, default 30s);
- errori HTTP trasformati in eccezioni con messaggi espliciti (status code incluso);
- payload sempre serializzato JSON con `Content-Type: application/json`.

Nei componenti UI:
- `accepted === true` produce una notifica positiva e avvia il tracking del job.
- `accepted === false` mostra un messaggio di warning (es. backend non ha accettato).

#### Polling risultati (REST fallback)

Quando un job viene creato, la UI prova a seguire la sua evoluzione via WS; se gli eventi non arrivano (o arrivano tardi), interviene un polling di “sicurezza”.

Endpoint: `GET /{queue}/results/:jobId`

In pratica il path viene normalizzato per coda:
- `http` → `/http-requests/results/:jobId`
- `analyzer` → `/analyzer/results/:jobId`
- `techstack` → `/techstack/results/:jobId`

Comportamento:
- `ToolReactController.getJobResult(queue, jobId)` inoltra la richiesta al background.
- `ToolBackgroundController` delega a `ToolEngine.fetchJobResult(queue, jobId)`.
- I wizard attivano un `setInterval` (tipicamente 3s) **solo** quando la finestra “Job Summaries” è aperta.
- Se la response indica `state === completed` oppure `state === failed`, la UI genera un “evento sintetico” (`completed`/`failed`) e rimuove il job dall’elenco da monitorare.

Questa strategia evita:
- dipendenza totale dagli eventi realtime;
- loop di polling permanenti (polling limitato alla durata della dialog).

---

### WebSocket Integration

---

Il canale WS è implementato tramite **socket.io-client** nel `ToolEngine`. La connessione è **lazy**: viene creata solo quando serve (es. subscribe a un job).

#### Connessione e gestione lifecycle

- `ToolEngine.ensureSocketConnected()` inizializza la socket al primo utilizzo (`_socketInitStarted`) e attende la connessione con timeout breve (`EXTENSION_PUBLIC_ENSURE_SOCKET_CONNECTED_TIMEOUT`, default ~1500ms).
- `_connectSocket()` crea il client:
  - trasporto: `websocket`
  - timeout configurabile: `EXTENSION_PUBLIC_CONNECT_SOCKET_TIMEOUT`

Eventi gestiti:
- `connect`: log e re-join automatico delle room già sottoscritte.
- `disconnect` / `connect_error`: logging best-effort (senza impattare la UI).

#### Subscribe / unsubscribe alle job room

Il tracking realtime è basato su “room per jobId”:

- `subscribeJob(jobId)`
  - aggiunge l’id a `_joinedJobs` (per rejoin post-reconnect)
  - invia `socket.emit('subscribe-job', jobId)`
- `unsubscribeJob(jobId)`
  - rimuove l’id da `_joinedJobs`
  - invia `socket.emit('unsubscribe-job', jobId)` (best-effort)

I componenti React evitano doppie sottoscrizioni mantenendo un set locale (`subscribedJobIdsRef`) e chiamando unsubscribe in `reset/back`.

#### Eventi di job lifecycle

Il backend emette eventi per stato job, inoltrati ai componenti UI:

- `completed` → `ToolEngine` notifica `jobSubscribers` con `{ event: 'completed', ...payload }`
- `failed` → notifica con `{ event: 'failed', ...payload }`

Il `ToolBackgroundController` riceve tali eventi tramite `engine.subscribeJobs()` e li broadcasta a tutte le view con:

- `browser.runtime.sendMessage({ type: 'tool_job_event', payload: evt })`

La UI aggancia un listener centralizzato con `toolReactController.onMessage()` e accumula gli eventi nel buffer locale, poi genera un riepilogo per jobId (queue, ultimo evento, completed/failed).

---

### Tool status (unreachable / checking / ready)

La UI utilizza uno stato semplificato derivato dal payload /health:

- **checking**
  - valore iniziale (prima risposta o durante la prima fase di bootstrap)
  - visualizzato con spinner (es. chip in navbar)
- **ready**
  - `payload.ok === true` e **tutti** i componenti risultano `up`
  - abilita submission e stepper “Continue”
- **unreachable / down**
  - errore di fetch, server non raggiungibile, oppure componenti non “up”
  - disabilita azioni critiche e mostra alert

Implementazione pratica:
- `ToolEngine.checkHealth()` aggiorna cache e notifica subscriber.
- `ToolBackgroundController` inoltra gli update con messaggi runtime.
- I componenti (Navbar e wizard) ricostruiscono lo stato con una funzione locale `computeStatus`.

---

### Differenze rispetto alla Dashboard

L’integrazione nel contesto estensione è simile a quella di una dashboard web, ma con vincoli e scelte conservative.

#### Contesto utente

- L’estensione opera nel contesto del browser dell’utente, con sessioni e dati locali (snapshot, run, selezioni).
- Le azioni verso il Tool non assumono una sessione applicativa “server-side” tipica di dashboard; il flusso è guidato da input raccolti nel client (HTML, request dataset, tecnologie, ecc.).
- La UI introduce un **scan lock globale** per evitare concurrency tra componenti (Analyzer/Interceptor/Techstack), bloccando submission quando un’altra attività è attiva.

#### Fallback UI

- Alert espliciti quando il Tool è offline.
- Disabilitazione proattiva dei pulsanti di avanzamento nel wizard (Continue/Send) se:
  - tool non ready,
  - scan lock attivo,
  - selezioni incomplete,
  - invio in corso.
- Dialog “Job Summaries” come punto unico di osservazione: mostra jobId, queue, completamento/errore.

#### Retry conservativi

- REST: timeout via AbortController e gestione errori best-effort (no retry aggressivi lato engine).
- WS: connessione lazy e rejoin automatico su reconnect, senza riconnessioni invasive lato UI.
- Polling fallback: attivato solo durante la visibilità della dialog e interrotto appena tutti i job risultano conclusi.

Obiettivo principale: preservare stabilità e UX anche con backend intermittente, riducendo richieste superflue e mantenendo l’estensione reattiva.

---