# Error Handling e Logging
---

Questa sezione descrive come l’**API Server** gestisce:
- validazione e gestione errori HTTP;
- gestione errori infrastrutturali (GraphDB, Redis/BullMQ, Python script PCAP);
- logging applicativo (console + streaming realtime via WebSocket).

I riferimenti principali sono:
- `server.js` (bootstrap, middleware, handler globali di processo)
- `/routes/*.js` (pattern di error handling per endpoint)
- `utils/logs/logger.js` (logger custom + coalescing + listener realtime)
- `sockets.js` (forward dei log verso namespace `/logs`)

---

## 1) Error handling HTTP

### 1.1 Validazione input con Celebrate

Gli endpoint REST validano input (body/query/params) tramite `celebrate` (Joi), con schema specifici per dominio (httpRequests, analyzer, techstack, sparql), esportati da `utils.validators`.

Pattern tipico:
```js
router.post(
  '/analyze',
  celebrate({ [Segments.BODY]: analyzerBodySchema }, celebrateOptions),
  async (req, res) => { ... }
);
```

Se la validazione fallisce:
- l’handler finale `celebrateErrors()` (montato in `server.js` **dopo** tutte le route) intercetta l’errore
- viene restituito un **400 Bad Request** con struttura consistente (fornita da Celebrate)

```js
app.use(celebrateErrors());
```

**Responsabilità:** assicurare che le route ricevano payload coerenti, riducendo errori a runtime e semplificando la gestione dei casi di edge.

---

### 1.2 Pattern di gestione errori nelle route

Le route adottano un pattern uniforme:
- `try/catch` dentro l’handler async
- log dell’errore con namespace specifico (`api:http`, `api:analyzer`, …)
- risposta JSON con `error` + `detail`

Esempio (enqueue fallito):

```js
res.status(500).json({ error: 'Enqueue failed', detail: String(err?.message || err) });
```

Esempio (GraphDB query fallita):

```js
res.status(502).json({ error: 'GraphDB query failed', detail: String(err?.message || err) });
```

#### Mapping implicito degli errori per categoria

|Categoria|Dove|HTTP Status|Motivazione|
|---|---|---|---|
|Validation errors|celebrate|400|input non conforme allo schema|
|Job non trovato|`/results/:jobId`|404|jobId non presente in Redis/BullMQ|
|Enqueue fallito|`queue.add()`|500|errore interno API / Redis non disponibile|
|GraphDB query fallita|`runSelect`|502|dipendenza esterna (GraphDB) non raggiungibile / errore query|
|PCAP conversion fallita|`spawn python`|500|fallimento pipeline esterna (script / parsing)|
|Campo file mancante (PCAP)|`pcap.js`|400|richiesta multipart incompleta|

Nota: la scelta di `502` per GraphDB evidenzia che il problema è “upstream”, utile per diagnostica e per orchestratori/reverse proxy.

---

### 1.3 PCAP endpoint: gestione errori e cleanup

`POST /pcap/pcap-http-requests` usa `multer` e invoca uno script Python (pcap_to_http_json.py).

Error handling specifico:
- **400** se mancano i campi `pcap` o `sslkeys`
- **500** se:
    - lo script termina con exit code ≠ 0
    - stdout non è JSON valido
    - errori di spawn/esecuzione

Cleanup:
- rimozione best-effort dei file temporanei in `finally` via `safeUnlink()`
- errori di unlink non bloccano il flusso (solo log `warn`)

---

## 2) Error handling “process-level” e resilienza

In `server.js` sono presenti handler globali:

```js
process.on('unhandledRejection', ...) 
process.on('uncaughtException', ...) 
process.on('SIGTERM', ...)
```

### 2.1 unhandledRejection

- intercetta Promise reject non gestite
- logga almeno una traccia utile (`reason`)

### 2.2 uncaughtException

- intercetta eccezioni non catturate
- logga l’errore completo

### 2.3 SIGTERM

- imposta lo stato health `server=shutting_down`
- termina il processo (`process.exit(0)`)

Nota: è dichiarato esplicitamente che una “graceful shutdown” più avanzata (chiusura server, attesa richieste in-flight) potrebbe essere introdotta in futuro.

---

## 3) Logging: architettura e convenzioni

Il logging non usa una libreria esterna (es. pino/winston) ma un **logger minimale custom** (`utils/logs/logger.js`) con:
- livelli: `error`, `warn`, `info`, `debug`
- namespace (es. `api:http`, `ws`, `bull`, `redis`)
- output `pretty` in dev e `json` in produzione
- **coalescing** dei messaggi ripetuti
- **listener realtime** per streaming via WebSocket

### 3.1 Creazione logger namespaced

Uso tipico:

```js
const { makeLogger } = require('./utils'); const log = makeLogger('api:http');
```

API esposta:

- `log.error(...)`
- `log.warn(...)`
- `log.info(...)`
- `log.debug(...)`

Il namespace è una stringa libera, usata per segmentare e filtrare i log in UI.

---

### 3.2 Formato log: pretty vs json

La scelta del formato è determinata da:
- `LOG_FORMAT=json` → JSON
- altrimenti:
    - `NODE_ENV=production` → JSON
    - default → pretty (human-readable)

Payload canonico (sempre lo stesso, anche per listener realtime):

`{ "ts": "...", "level": "info", "ns": "api:http", "msg": ... }`

- In modalità JSON: stampa serializzata su stdout/stderr
- In modalità pretty: stringa tipo:
    `[ISO] LEVEL  namespace — <args...>`

---

### 3.3 Soglia di livello (LOG_LEVEL)

La soglia è configurata con `LOG_LEVEL` (default: `info`).

Regola:
- un log viene emesso solo se il livello è >= della soglia configurata (in termini di severità).

Livelli ordinati (più severo → meno severo):  
`error (0)`, `warn (1)`, `info (2)`, `debug (3)`

---

### 3.4 Coalescing dei messaggi ripetuti

Per evitare “log noise” (tipico di retry Redis o loop ripetitivi), il logger implementa **coalescing**:
- finestra temporale: `LOG_COALESCE_WINDOW_MS` (default: `3000ms`)
- chiave di coalescing:
    `ns | level | payload_string`
- comportamento:
    1. il primo messaggio viene emesso subito
    2. i successivi identici entro la finestra aumentano un contatore
    3. allo scadere della finestra viene emesso un log finale:
        `(repeated xN)`

Questo mantiene leggibilità senza perdere informazione quantitativa.

---

## 4) Logging realtime: listener + WebSocket

### 4.1 Listener `onLog()`

Il logger espone:
- `onLog(fn)` → registra un listener e ritorna una funzione di unsubscribe

I listener ricevono il payload **strutturato e già coalesced**:
`{ ts, level, ns, msg }`

I listener sono invocati in `try/catch` per impedire che un subscriber difettoso rompa il logger.

---

### 4.2 Integrazione con `sockets.js`

In `sockets.js`:
- viene aperto il namespace `/logs`
- qualunque entry ricevuta su `socket.on('log')` viene broadcastata a tutti i client
- soprattutto: i log del processo API vengono inoltrati automaticamente:

`onLog((entry) => {   logsNsp.emit('log', entry); });`

Effetto architetturale:

- la dashboard può visualizzare in tempo reale:
    - log API
    - log worker (che si connettono come client e inviano `log`)

---

## 5) Logging operativo in componenti specifici

### 5.1 Queue / Redis (BullMQ)

In `queue.js`:
- ogni queue registra un handler `q.on('error')`
- quando `QUIET_REDIS_ERRORS=1`, errori “rumorosi” (ECONNREFUSED, ETIMEDOUT, etc.) vengono soppressi
- altrimenti log `warn` con namespace `bull`

Inoltre la connessione Redis definisce `retryStrategy()` con backoff esponenziale, loggando i retry (namespace `redis`) salvo `QUIET_REDIS_ERRORS`.

---

### 5.2 WebSocket gateway

In `sockets.js`:
- connessioni e disconnessioni client sono loggate (`ws`)
- errori `QueueEvents` sono loggati come warning

---

## 6) Risultato: comportamento complessivo

Combinando quanto sopra:
- **Errori di input** → 400 (Celebrate)
- **Errori di dipendenze** (GraphDB) → 502 e log dedicato
- **Errori interni** (enqueue, runtime) → 500 + log dettagliato
- **Errori non gestiti** → almeno una traccia in console (unhandledRejection / uncaughtException)
- **Logging**:
    - strutturato e filtrabile
    - poco rumoroso (coalescing + quiet mode redis)
    - disponibile anche in realtime su WebSocket (`/logs`)

---

## Variabili di configurazione rilevanti

- `LOG_LEVEL` (default: `info`)
- `LOG_FORMAT` (`json` oppure auto: json in prod, pretty in dev)
- `LOG_COALESCE_WINDOW_MS` (default: `3000`)
- `QUIET_REDIS_ERRORS` (`1` per ridurre rumore nei retry)
- `SOCKETS_CORS_ORIGIN` (CORS per Socket.IO)

---