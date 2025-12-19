# WebSocket Gateway
---

Questa sezione descrive il **gateway WebSocket** dell’API Server, implementato tramite **Socket.IO** in `sockets.js`. Il gateway fornisce canali real-time per:

- streaming dei log (API + worker);
- propagazione degli eventi di lifecycle dei job BullMQ;
- coordinamento tra backend e client (dashboard ed extension) senza polling aggressivo.

Il server WebSocket è montato **sulla stessa istanza HTTP** dell’API REST per condividere porta, CORS e contesto di deployment.

---

## Bootstrap e configurazione

Il gateway viene inizializzato in `server.js`:

```js
const server = http.createServer(app);
attachSockets(server)
```

### Motivazioni architetturali

- **Singola porta di esposizione**  
    REST e WebSocket condividono host/porta (default `:8081`), semplificando:
    - reverse proxy (Nginx);
    - CORS;
    - configurazione client (`VITE_LOGS_WS_URL`, `VITE_WS_URL`).
- **Stesso lifecycle del processo API**  
    Il gateway segue l’avvio/stop dell’API Server e viene automaticamente incluso nello stato di salute complessivo del tool.

---

## Server Socket.IO

In `sockets.js`:

```js
const io = new Server(httpServer, {   cors: { origin: process.env.SOCKETS_CORS_ORIGIN || '*' }, });
```

- **CORS WebSocket** configurabile via `SOCKETS_CORS_ORIGIN`
- fallback permissivo (`*`) in ambienti di sviluppo

---

## Namespace disponibili

Il gateway espone **due namespace principali**:
1. `/logs` – streaming real-time dei log
2. `/` (default) – eventi job BullMQ

---

## Namespace `/logs`: log streaming

### Ruolo

Il namespace `/logs` aggrega e redistribuisce in tempo reale:
- log prodotti dal processo API;
- log prodotti dai worker (che si collegano come client Socket.IO).

In questo modo la dashboard riceve **un unico stream coerente** di log applicativi.

---

### Connessione

```js
const logsNsp = io.of('/logs');
```

Alla connessione:
- viene loggato `logs client connected`;
- il socket resta in ascolto di eventi `log`.

---

### Evento `log`

```js
socket.on('log', (entry) => {   logsNsp.emit('log', entry); });
```
- qualsiasi client può inviare un `entry`;
- il server lo **fan-out** a tutti i subscriber `/logs`.

### Forward dei log API

```js
onLog((entry) => {   logsNsp.emit('log', entry); });
```
- `onLog` intercetta i log prodotti internamente dal logger API;
- ogni entry viene immediatamente emessa su `/logs`.

---

### Struttura log entry

Le entry sono strutturate (oggetto JSON) e tipicamente includono:
- `ts` – timestamp
- `level` – livello (`info`, `warn`, `error`, ...)
- `ns` – namespace logger: `api`, `api:http`, `ws`, `bull`, ecc.
- `msg` – messaggio (string o payload serializzato)

Questa struttura consente:
- colorazione semantica lato UI;
- filtering;
- correlazione temporale con job events.

---

## Namespace default `/`: job events

### Ruolo

Il namespace root serve per:
- sottoscrivere client agli eventi lifecycle di un job BullMQ;
- inviare notifiche push su `completed` / `failed`;
- evitare polling continuo sugli endpoint `/results/:jobId`.

---

### QueueEvents BullMQ

All’avvio vengono istanziati i listener BullMQ:

```js 
const qHttp  = new QueueEvents(queueNameHttpRequestsWrites, { connection }); 
const qSp    = new QueueEvents(queueNameSparqlWrites, { connection }); 
const qTech  = new QueueEvents(queueNameTechstackWrites, { connection }); 
const qAnaly = new QueueEvents(queueNameAnalyzerWrites, { connection });
```

Prima di accettare client:

```js 
await Promise.all([ qHttp.waitUntilReady(), qSp.waitUntilReady(), qTech.waitUntilReady(), qAnaly.waitUntilReady()]);`
```

**Effetto:**  
il gateway non espone eventi finché Redis e BullMQ non sono effettivamente pronti.

---

### Connessione client

```js
io.on('connection', (socket) => {   ... });
```

Eventi supportati:
#### `subscribe-job`

```js
socket.on('subscribe-job', (jobId) => {   socket.join(`job:${jobId}`); });
```
- il client si iscrive a una “stanza logica”:
    `job:<jobId>`
- usata per ricevere solo gli eventi del job di interesse.

#### `unsubscribe-job`

```js
socket.leave(`job:${jobId}`);
```
- rimozione esplicita dalla stanza;
- evita leak e fan-out non necessario.

---

## Forward degli eventi BullMQ

### Pattern di emissione

Per ogni coda viene creato un forwarder:

```js
const forward = (queue) => (evt, payload) => {   io.to(`job:${payload.jobId}`).emit(evt, { queue, ...payload }); };
```

Ogni evento:
- viene emesso solo ai client iscritti a `job:<jobId>`;
- include:
    - `queue` (http | sparql | techstack | analyzer);
    - payload originale BullMQ (`jobId`, `returnvalue`, `failedReason`, ecc.).

---

### Eventi gestiti

Per ogni coda:
- `completed`
- `failed`

Esempio:

```js
qHttp.on('completed', (p) => fHttp('completed', p)); qHttp.on('failed', (p) => fHttp('failed', p));
```

---

### Eventi a livello coda

```js
qe.on('error', (err) => log.warn('QueueEvents error', ...));
```
- errori di connessione Redis;
- problemi interni BullMQ;
- **non** associati a un job specifico.

Questi eventi **non** vengono propagati ai client, ma solo loggati.

---

## Flusso tipico lato client

1. Client invia `POST /<domain>/analyze|ingest|update`
2. Riceve `202 Accepted` con `jobId`
3. Apre socket verso namespace default `/`
4. Invia:
    `socket.emit('subscribe-job', jobId)`
5. Riceve eventi:
    - `completed`    
    - `failed`
6. Opzionalmente:
    - effettua una `GET /results/:jobId` finale per payload completo
    - invia `unsubscribe-job`

---

## Motivazioni architetturali

### Perché Socket.IO (e non SSE / raw WS)

- gestione automatica reconnection;
- fallback trasporti;
- namespace e rooms già pronti;
- compatibilità semplice con browser extension e dashboard React.

---

### Perché jobId come room

- isolamento totale degli eventi;
- scalabilità orizzontale (fan-out limitato);
- sicurezza implicita (un client vede solo job a cui si iscrive).

---

## Limitazioni note

- Nessuna autenticazione WS (trust model basato su rete interna o reverse proxy).
- Nessuna retention server-side:
    - se il client si connette **dopo** il `completed`, l’evento non viene replayed.
    - in tal caso è necessario usare `/results/:jobId`.
- Gli eventi intermedi (`progress`, `active`) non sono attualmente forwardati.

---

## Collegamenti

- **Bootstrap:** `server.js`
- **Gateway WS:** `sockets.js`
- **Job system:** `queue.js`
- **Dashboard:** sezione 4.2.1.4 WebSocket integration
- **Worker:** sezione 4.3.2 Worker / Job System

---