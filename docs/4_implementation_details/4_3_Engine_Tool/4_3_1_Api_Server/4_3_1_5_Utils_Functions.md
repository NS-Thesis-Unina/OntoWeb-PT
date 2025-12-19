# Funzioni `utils` usate dall’API Server
---

Questo documento riassume **solo** le funzioni del pacchetto interno `./utils` effettivamente utilizzate dall’**API Server** (file: `server.js`, `queue.js`, `sockets.js`, `routes/*.js`).

---

## 1) `utils/index.js` (barrel module)

`utils/index.js` agisce da **modulo aggregatore**: re-esporta e raggruppa in un’unica entrypoint le utility usate dall’API Server, consentendo import compatti, ad esempio:

```js
const { makeLogger, onLog, monitors, graphdb, validators, findingBuilders } = require('./utils');
```

## 2) Logging (`makeLogger`, `onLog`)

### 2.1 `makeLogger(ns)`

Crea un logger **namespaced** con i metodi:
- `error(...args)`
- `warn(...args)`
- `info(...args)`
- `debug(...args)`

**Uso nell’API Server**
- `server.js`: log di bootstrap, lifecycle, errori e shutdown.
- `queue.js`: log relativi a code/eventi e diagnostica (lato API server, non worker).
- `sockets.js`: log lifecycle Socket.IO, connessioni e forwarding eventi.
- `routes/*.js`: log per dominio (`api:http`, `api:analyzer`, `api:techstack`, `api:sparql`, `api:pcap`) per troubleshooting.

### 2.2 `onLog(listener)`

Registra un listener per ricevere le entry log “strutturate”, nel formato:

```js
{ ts: string, level: 'error'|'warn'|'info'|'debug', ns: string, msg: any }
```

**Uso nell’API Server**

- `sockets.js`: sottoscrive `onLog()` e inoltra le entry ai client del namespace Socket.IO `/logs` (stream real-time verso dashboard/console).

## 3) Health e monitor (`monitors.*`)

`utils.monitors` espone funzioni per monitorare dipendenze e costruire lo stato dell’endpoint `/health`.

### 3.1 `monitors.setState(key, value)` e `monitors.getHealth()`

- `setState(key, value)`  
    Aggiorna lo stato di un componente nel registry in-memory (componenti: `server`, `graphdb`, `redis`).
- `getHealth()`  
    Restituisce:
    ```js
    { ok: boolean, components: { server, graphdb, redis } }
    ```
    dove `ok === true` solo se tutti i componenti risultano `up`.

**Uso nell’API Server**

- `server.js`:
    - aggiorna lo stato del server e delle dipendenze;
    - l’endpoint `GET /health` risponde `200` se `ok`, altrimenti `503`.

### 3.2 `monitors.startRedisMonitor(connectionOpts, ns, report?)`

Avvia un client Redis “solo monitor” per:
- tracciare transizioni di stato (es. `connecting`, `up`, `down`)
- loggare eventi di connessione
- opzionalmente notificare `report(state)` per aggiornare il registry health.

**Uso nell’API Server**
- `server.js`: avvia il monitor Redis e usa `report` per allineare `setState('redis', ...)`.


### 3.3 `monitors.startGraphDBHealthProbe(runSelect, ns, intervalMs, report?)`

Esegue un probe periodico verso GraphDB (basato su `ASK {}`), con:
- stato `up/down` a seconda dell’esito
- log delle transizioni significative
- callback opzionale `report(state)`.

**Uso nell’API Server**
- `server.js`: avvia il probe GraphDB passando `graphdb.runSelect` e aggiorna `setState('graphdb', ...)`.

---

## 4) Client GraphDB (`graphdb.*`)

`utils.graphdb` è il client HTTP minimale usato dall’API Server per interrogare GraphDB.

### 4.1 `graphdb.runSelect(sparql)`

Esegue query **SELECT/ASK** su GraphDB e ritorna il payload in formato SPARQL JSON.

**Uso nell’API Server**
- `routes/sparql.js`: endpoint “query” (SELECT/ASK).
- `routes/*finding*`: endpoint di lettura per liste/dettagli (read model su GraphDB).
- `server.js`: health probe GraphDB tramite `startGraphDBHealthProbe`.

> Nota: qui documentiamo solo l’uso lato API Server (lettura/health). Gli aspetti legati a scrittura/pipeline worker sono trattati altrove.

---

## 5) SPARQL query type helpers (solo route `sparql.js`)

Questi helper vengono usati dalla rotta SPARQL per distinguere query di lettura vs update.

### 5.1 `isSelectOrAsk(query)`

Rileva se una stringa SPARQL inizia con `SELECT` o `ASK` (check semplice a prefisso).

**Uso nell’API Server**
- `routes/sparql.js`: usato in combinazione con gli schema di validazione per l’endpoint query.

### 5.2 `isUpdate(query)`

Rileva se una stringa SPARQL è un’operazione di **UPDATE** (con stripping di commenti e dichiarazioni `PREFIX/BASE`).

**Uso nell’API Server**
- `routes/sparql.js`: usato in combinazione con gli schema di validazione per l’endpoint update.

---

## 6) Finding builders e mappers (read model) — `findingBuilders.*`

Le route `analyzer`, `http-requests` e `techstack` leggono i findings da GraphDB usando un pattern stabile:
1. builder → genera la SPARQL SELECT
2. mapper → trasforma `results.bindings` in JSON per la response

### 6.1 Lista findings (paginata)

Usati dalle rispettive route `GET */finding/list`:

- Analyzer:
    - `buildSelectAnalyzerFindingsPaged({ limit, offset })`
    - `bindingsToAnalyzerFindingsList(bindings)`
- HTTP:
    - `buildSelectHttpFindingsPaged({ limit, offset })`
    - `bindingsToHttpFindingsList(bindings)`
- Techstack:
    - `buildSelectTechstackFindingsPaged({ limit, offset })`
    - `bindingsToTechstackFindingsList(bindings)`

### 6.2 Dettaglio finding per id

Usati dalle rispettive route `GET */finding/:id`:

- Analyzer:
    - `buildSelectAnalyzerFindingById({ id })`
    - `bindingsToAnalyzerFindingDetail(bindings)`
- HTTP:
    - `buildSelectHttpFindingById({ id })`
    - `bindingsToHttpFindingDetail(bindings)`
- Techstack:
    - `buildSelectTechstackFindingById({ id })`
    - `bindingsToTechstackFindingDetail(bindings)`

---

## 7) Validators (Celebrate/Joi) — `validators.*`

L’API Server usa gli schema `utils.validators.*` per validare `BODY`, `PARAMS` e `QUERY` nelle route.

### 7.1 `validators.analyzer`

Schema usati da `routes/analyzer.js`:
- `analyzerBodySchema`
- `jobIdParamSchema`
- `analyzerFindingsListQuerySchema`
- `analyzerFindingIdParamSchema`

### 7.2 `validators.httpRequests`

Schema usati da `routes/httpRequests.js`:
- `ingestPayloadSchema`
- `listQuerySchema`
- `idParamSchema`
- `jobIdParamSchema`
- `httpFindingsListQuerySchema`
- `httpFindingIdParamSchema`

### 7.3 `validators.techstack`

Schema usati da `routes/techstack.js`:
- `techstackBodySchema`
- `jobIdParamSchema`
- `techstackFindingsListQuerySchema`
- `techstackFindingIdParamSchema`

### 7.4 `validators.sparql`

Schema usati da `routes/sparql.js`:
- `sparqlQuerySchema(...)`
- `sparqlUpdateSchema(...)`

---

## 8) Note specifiche per route `pcap.js`

La route `routes/pcap.js` usa `utils` **solo** per:
- `makeLogger('api:pcap')`

Non utilizza builder/mappers GraphDB né validator `utils` nel flusso PCAP.

---

## 9) Riepilogo: API Server → funzioni `utils` usate

- **Logging**
    - `makeLogger(ns)`
    - `onLog(listener)` (solo `sockets.js`)
- **Health/Monitor**
    - `monitors.setState(key, value)`
    - `monitors.getHealth()`
    - `monitors.startRedisMonitor(...)`
    - `monitors.startGraphDBHealthProbe(...)`
- **GraphDB**
    - `graphdb.runSelect(sparql)` (lettura + health)
- **SPARQL type helpers (route sparql)**
    - `isSelectOrAsk(query)`
    - `isUpdate(query)`
- **Finding read model**
    - `findingBuilders.*` (builder + mapper per list/detail)
- **Validazione**
    - `validators.analyzer.*`
    - `validators.httpRequests.*`
    - `validators.techstack.*`
    - `validators.sparql.*`
    - `celebrateOptions` (opzioni comuni Celebrate)

---