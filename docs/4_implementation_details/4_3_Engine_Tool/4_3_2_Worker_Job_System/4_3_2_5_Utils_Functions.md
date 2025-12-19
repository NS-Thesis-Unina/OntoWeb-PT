# Funzioni `utils` usate dal Worker
---

Questo documento riassume **solo** le funzioni del pacchetto interno `./utils` effettivamente utilizzate dal **Worker / Job System** (file principale: `worker.js`).

---

## 1) `utils/index.js` come entrypoint unica

Anche nel worker, `utils/index.js` viene usato come **barrel module** per importare in modo compatto tutte le utility necessarie:

```js
const {   
	graphdb: { runUpdate, runSelect },   
	httpBuilders: {     
		buildInsertFromHttpRequest,     
		buildInsertFromHttpRequestsArray,     
		normalizeHttpRequestsPayload,   
		},   
	findingBuilders: { buildInsertFromFindingsArray },   
	monitors: { startRedisMonitor, startGraphDBHealthProbe },   
	makeLogger,   
	onLog, 
} = require('./utils');
```

---

## 2) Logging e forwarding (`makeLogger`, `onLog`)

### 2.1 `makeLogger(ns)`

Crea un logger namespaced con metodi standard (`error/warn/info/debug`).  
Nel worker viene usato per distinguere chiaramente i domini operativi:
- `worker:http` → ingestion HTTP + http-resolver
- `worker:sparql` → esecuzione update SPARQL
- `worker:techstack` → analisi techstack
- `worker:analyzer` → analisi SAST/analyzer
- `logs-forwarder` → stato della connessione Socket.IO verso `/logs`

Questo consente di separare nei log:
- errori di esecuzione job,
- completamento job,
- risultati sintetici (es. numero findings inseriti),
- problemi di rete (Redis/GraphDB/Socket.IO).

### 2.2 `onLog(listener)` (worker → API)

Nel worker viene installato un listener globale:
- ogni log prodotto via `makeLogger` viene trasformato in entry strutturata:
    `{ ts, level, ns, msg }`
- l’entry viene inviata via Socket.IO al namespace `/logs` dell’API Server (`logsSocket.emit('log', entry)`)

In questo modo la Dashboard riceve uno stream unico:
- log API server + log worker
- senza connettersi direttamente ai processi worker

---

## 3) Client GraphDB

### 3.1 `runUpdate(sparqlUpdate)`

È la funzione principale usata dal worker per persistere dati in GraphDB:
- ingestion HTTP → `INSERT DATA` su grafo HTTP
- findings (HTTP/Techstack/Analyzer) → `INSERT DATA` su grafo findings
- job “sparql-update” → esecuzione generica di UPDATE

Il worker applica retry/backoff a livello BullMQ (queue) e non dentro `runUpdate`.

### 3.2 `runSelect(sparql)`

Nel worker `runSelect` non viene usata per query funzionali (read model), ma per:
- **health probe GraphDB** tramite `startGraphDBHealthProbe(runSelect, 'graphdb:worker')`

---

## 4) HTTP builders usati dal worker (`httpBuilders.*`)

Queste utility servono a trasformare il payload HTTP ricevuto dal job in una **SPARQL UPDATE** pronta da inviare a GraphDB.

### 4.1 `normalizeHttpRequestsPayload(payload)`

Normalizza il payload di ingestion in una lista piatta di richieste HTTP.

Formati accettati:
- singolo oggetto → `[obj]`
- array di oggetti → array invariato
- `{ items: [...] }` → ritorna `items`

Nel worker è usata nel job:
- `http-ingest` → per uniformare il formato prima di costruire l’update SPARQL.

### 4.2 `buildInsertFromHttpRequest(item)`

Genera una SPARQL `INSERT DATA` per **una singola** richiesta HTTP (triplette RDF + prefissi), tipicamente quando la lista normalizzata ha `length === 1`.

### 4.3 `buildInsertFromHttpRequestsArray(list)`

Genera una SPARQL `INSERT DATA` per **più richieste HTTP** in un’unica operazione.

Caratteristica rilevante per il worker:
- raggruppa le triple per grafo (`GRAPH <...> { ... }`) e produce un’unica query di insert (utile per batch ingestion).

---

## 5) Finding builders usati dal worker (`findingBuilders.*`)

### 5.1 `buildInsertFromFindingsArray(findings)`

Il worker usa questa funzione per persistere in GraphDB i findings prodotti dai resolver (che descriveremo nella sezione `4_3_2_6_*`).

Flusso tipico:
1. il resolver produce `result.findings[]`
2. il worker assicura un `source` coerente (`http`, `techstack`, `analyzer`)
3. costruisce la SPARQL update:
    `const sparql = buildInsertFromFindingsArray(findingsForInsert);`
4. esegue `runUpdate(sparql)`

---

## 6) Monitor e health probe nel processo worker (`monitors.*`)

Nel worker i monitor servono soprattutto per **osservabilità via log** (non aggiornano direttamente l’endpoint `/health` dell’API Server).

### 6.1 `startRedisMonitor(connection, 'redis:worker')`

Avvia un client Redis “solo monitor” che:
- traccia transizioni (`connecting/up/down`)
- logga eventi significativi (ready, reconnecting, end, error)

Nel worker viene avviato a fine file per diagnosticare problemi di connettività Redis che impattano:
- fetch job dalla queue
- ack/completamento job

### 6.2 `startGraphDBHealthProbe(runSelect, 'graphdb:worker')`

Esegue periodicamente un probe (`ASK {}`) verso GraphDB e logga transizioni `up/down`.  
È utile per distinguere:
- job falliti per problemi logici (payload, resolver)
- job falliti per indisponibilità GraphDB

---

## 7) Riepilogo: Worker → funzioni `utils` usate (esclusi resolver)

- **Logging**
    - `makeLogger(ns)`
    - `onLog(listener)` (per forwarding log verso API `/logs`)
- **GraphDB**
    - `graphdb.runUpdate(sparqlUpdate)` (scrittura)
    - `graphdb.runSelect(sparql)` (solo probe)
- **HTTP ingestion builders**
    - `httpBuilders.normalizeHttpRequestsPayload(payload)`
    - `httpBuilders.buildInsertFromHttpRequest(item)`
    - `httpBuilders.buildInsertFromHttpRequestsArray(list)`
- **Finding persistence**
    - `findingBuilders.buildInsertFromFindingsArray(findings)`
- **Monitor**
    - `monitors.startRedisMonitor(connection, 'redis:worker')`
    - `monitors.startGraphDBHealthProbe(runSelect, 'graphdb:worker')`

---