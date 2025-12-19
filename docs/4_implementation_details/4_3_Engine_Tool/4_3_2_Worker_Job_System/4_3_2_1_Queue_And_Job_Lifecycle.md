# Queue and Job Lifecycle
---

Questo file descrive come il sistema **Worker / Job System** gestisce le code e il **ciclo di vita dei job**. L’implementazione è basata su **BullMQ** (code) e **Redis** (storage e stato).

---

## 1) Scelte architetturali

### Perché una coda (BullMQ) invece di esecuzione sincrona

Le operazioni “pesanti” (scritture su GraphDB, analisi HTTP, risoluzione Techstack, analyzer) non vengono eseguite dentro l’API Server. Il server:

1. valida l’input,
2. **enqueue** di un job su Redis,
3. risponde subito con `accepted + jobId`,
4. il Worker esegue il job in background.

Questo mantiene l’API reattiva e rende osservabile lo stato del lavoro.

### Dove vive lo stato dei job

Lo **stato** è persistito da BullMQ su **Redis** (non in memoria dell’API).  
Questo consente:
- resilienza a restart dell’API/worker,
- retrieval di stato e history (fino ai limiti di retention configurati),
- fan-out eventi via QueueEvents.

---

## 2) Configurazione Redis condivisa

Nel modulo `queue.js` è definita una `connection` condivisa usata da **tutte le code**.

Caratteristiche principali:
- `host` / `port` configurabili via env (`REDIS_HOST`, `REDIS_PORT`) con default `127.0.0.1:6379`
- `enableReadyCheck: true` (aspetta che Redis sia davvero “ready”)
- `maxRetriesPerRequest: null` (comportamento compatibile con carichi lunghi)
- `retryStrategy(times)` con **exponential backoff** e delay capped a 30s
    - log dei retry disattivabile con `QUIET_REDIS_ERRORS=1`

---

## 3) Code definite (queue.js)

Le code sono distinte per **dominio funzionale**. I nomi sono configurabili via env e hanno un default.

### 3.1 HTTP Requests queue

- **nome default**: `http-requests-writes` (`QUEUE_NAME_HTTP_REQUESTS_WRITES`)
- **scopo**:
    - ingestion di richieste HTTP verso GraphDB
    - analisi / resolver su richieste HTTP e scrittura findings

**Default job options**
- `attempts`: default 5 (`JOB_HTTP_REQUESTS_ATTEMPTS`)
- `backoff`: exponential, delay default 2000ms (`JOB_HTTP_REQUESTS_BACKOFF_*`)
- retention:
    - `removeOnComplete`: default 500
    - `removeOnFail`: default 1000

---

### 3.2 SPARQL queue

- **nome default**: `sparql-writes` (`QUEUE_NAME_SPARQL_WRITES`)
- **scopo**:
    - esecuzione di **SPARQL UPDATE** generici (decoupling delle write)

**Default job options**

- `attempts`: default 5
- `backoff`: exponential, delay default 2000ms
- retention:
    - `removeOnComplete`: default 500
    - `removeOnFail`: default 1000

---

### 3.3 Techstack queue

- **nome default**: `techstack-analyze` (`QUEUE_NAME_TECHSTACK_WRITES`)
- **scopo**:
    - trasformare payload techstack in findings e persist su GraphDB

**Default job options**

- `attempts`: default 3
- `backoff`: exponential, delay default 2000ms
- retention:
    - `removeOnComplete`: default 300
    - `removeOnFail`: default 800

---

### 3.4 Analyzer queue

- **nome default**: `analyzer-writes` (`QUEUE_NAME_ANALYZER_WRITES`)
- **scopo**:
    - job “SAST-like” su HTML/JS (analisi statica) e scrittura findings

**Default job options**

- `attempts`: default 3
- `backoff`: exponential, delay default 2000ms
- retention:
    - `removeOnComplete`: default 300
    - `removeOnFail`: default 800

---

## 4) Gestione errori a livello coda

In `queue.js`, ogni `Queue` registra un handler su evento `error`:
- se `QUIET_REDIS_ERRORS=1` e l’errore è tipico di rete (`ECONNREFUSED`, `ETIMEDOUT`, `getaddrinfo`), viene **silenzato**
- altrimenti viene loggato con namespace `bull`

Obiettivo: evitare log eccessivamente rumorosi in ambienti instabili.

---

## 5) Worker: consumo dei job e concorrenza (worker.js)

Ogni coda ha un **Worker dedicato** (`new Worker(queueName, processor, opts)`).

Parametri comuni:
- `connection`: la stessa del server
- `concurrency`: configurabile per worker (`CONCURRENCY_WORKER_*`, default 2)
- `stalledInterval`: controlla job “stalled” (`STALLED_INTERVAL_WORKER_*`, default 30000ms)

Eventi gestiti per osservabilità:
- `completed`: log strutturato con sintesi del risultato
- `failed`: log del motivo
- `error`: problemi interni del worker/BullMQ

---

## 6) Tipi di job e mapping “queue → job.name”

BullMQ usa `job.name` per distinguere il tipo di task dentro la stessa coda.

### 6.1 Queue HTTP (`http-requests-writes`)

- `http-ingest`
    - input: `{ payload }`
    - azione: normalizza payload → genera SPARQL UPDATE → `runUpdate()`
    - output tipico: `{ status, count, payload }`
- `http-resolver`
    - input: `{ list }` (array di richieste HTTP già normalizzate)
    - azione: `analyzeHttpRequests(list)` → produce findings/stats → insert findings su GraphDB
    - output tipico: `{ result, insertStatus }`

---

### 6.2 Queue SPARQL (`sparql-writes`)

- `sparql-update`
    - input: `{ sparqlUpdate }`
    - azione: `runUpdate(sparqlUpdate)`
    - output tipico: `{ status }`

---

### 6.3 Queue Techstack (`techstack-analyze`)

- `techstack-analyze`
    - input: `{ technologies, waf, secureHeaders, cookies, mainDomain }`    
    - azione: `resolveTechstack(...)` → findings → insert findings su GraphDB
    - output tipico: `{ result, insertStatus }`

---

### 6.4 Queue Analyzer (`analyzer-writes`)

- `sast-analyze`
    - input: `{ url, html, scripts, forms, iframes, includeSnippets }`
    - azione: `resolveAnalyzer(...)` → findings → insert findings su GraphDB
    - output tipico: `{ result, insertStatus }`

---

## 7) Ciclo di vita del job

BullMQ gestisce uno stato interno che, dal punto di vista del Tool, si traduce nel seguente lifecycle logico:

1. **Created / Waiting**
    - il job è stato creato ed è in attesa in coda.
2. **Active / Running**
    - un Worker lo ha preso in carico (rispetta `concurrency`).
3. **Completed**
    - il processor ha completato senza eccezioni e ha ritornato un risultato.
4. **Failed**
    - il processor ha lanciato un errore.
    - BullMQ applica retry fino a `attempts`, con `backoff` configurato.
5. **Removed**
    - in base alle policy `removeOnComplete` / `removeOnFail` viene mantenuta una history limitata,  
        poi i job vecchi vengono rimossi automaticamente.

Nota: la combinazione `attempts + backoff` è fondamentale per gestire failure temporanee (es. GraphDB down o rete instabile).

---

## 8) Propagazione eventi verso i client

### 8.1 Fan-out eventi tramite QueueEvents (sockets.js)

L’API Server crea una `QueueEvents` per ciascuna coda:
- ascolta eventi BullMQ (in questa implementazione: `completed`, `failed`)
- inoltra gli eventi via Socket.IO ai client che si sono iscritti al job

### 8.2 Subscription per jobId

Sul namespace Socket.IO “default”:
- il client invia `subscribe-job(jobId)`
- il server mette la socket nella room: `job:<jobId>`
- quando arriva un evento BullMQ con `payload.jobId`, il server emette nella room `job:<jobId>`

Payload inoltrato:
- `queue`: identificatore logico (`http`, `sparql`, `techstack`, `analyzer`)
- tutti i campi dell’evento BullMQ (incluso `jobId`)

Questo consente alla dashboard di mostrare lo stato job in tempo reale senza polling continuo.

---

## 9) In sintesi

- Le code sono **separate per dominio** (HTTP, SPARQL, Techstack, Analyzer).
- Redis è il **backend di stato**: job persistenti e osservabili.
- Ogni worker applica **retry/backoff** coerenti con il costo e la criticità del task.
- Gli eventi `completed/failed` sono propagati ai client tramite **QueueEvents → Socket.IO rooms** basate su `jobId`.
- La retention (`removeOnComplete/removeOnFail`) limita l’uso di memoria Redis mantenendo una history utile per debug/UI.

---