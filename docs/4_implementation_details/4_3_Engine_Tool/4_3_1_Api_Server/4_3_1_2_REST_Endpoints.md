# REST Endpoints
---

Questa sezione descrive gli endpoint REST esposti dall’API Server (Express) e il loro comportamento “white-box”: validazione, pattern di risposta, integrazione con BullMQ (job async) e interrogazioni sincrone su GraphDB.

I router sono montati in `server.js` sui seguenti prefissi:

- `/health`
- `/sparql` → `routes/sparql.js`
- `/http-requests` → `routes/httpRequests.js`
- `/techstack` → `routes/techstack.js`
- `/analyzer` → `routes/analyzer.js`
- `/pcap` → `routes/pcap.js`

---

## Convenzioni comuni agli endpoint

### Validazione input
Tutti i router (eccetto PCAP) usano **Celebrate/Joi**:

- `celebrate({ [Segments.BODY|QUERY|PARAMS]: schema }, celebrateOptions)`
- gli errori di validazione vengono convertiti in risposta **HTTP 400** tramite `celebrateErrors()` registrato globalmente in `server.js`.

Schema e opzioni sono importati da `utils.validators.<domain>`:
- `validators.sparql.*`
- `validators.httpRequests.*`
- `validators.techstack.*`
- `validators.analyzer.*`

### Pattern async (BullMQ)
Gli endpoint che avviano elaborazioni pesanti o scritture asincrone:

- fanno `queueX.add(jobName, payload)`
- rispondono con **202 Accepted**
- restituiscono un `jobId` che può essere:
  - sottoscritto via WebSocket (vedi 4.3.1.3)
  - interrogato via endpoint `GET /<domain>/results/:jobId` (polling)

### Pattern sync (GraphDB)
Gli endpoint di consultazione usano `graphdb.runSelect(sparql)` e gestiscono errori upstream come:

- **502 Bad Gateway** con body `{ error: 'GraphDB query failed', detail: ... }`

---

## GET /health

**File:** `server.js`

Endpoint di readiness. Restituisce:
- **200** se `getHealth().ok === true`
- **503** altrimenti

Header:
- `Cache-Control: no-store`

Payload: oggetto “health registry” aggregato (server/redis/graphdb e componenti).

---

## /sparql (routes/sparql.js)

### POST /sparql/query
Esegue **sincrono** su GraphDB una query SPARQL consentita.

- **Input body**
  - `sparql` (string): query SPARQL

- **Validazione**
  - accetta solo query `SELECT` o `ASK` (`sparqlQuerySchema(isSelectOrAsk)`)

- **Output**
  - **200** `{ data }` dove `data` è la risposta raw GraphDB (`head`, `results`)
  - **400** su validazione
  - **502** se GraphDB fallisce

**Uso tipico:** dashboard/admin per interrogazioni esplorative o list view che non richiedono pipeline job.

---

### POST /sparql/update
Enqueue asincrono di uno SPARQL UPDATE.

- **Input body**
  - `sparqlUpdate` (string): update SPARQL (INSERT/DELETE/...)

- **Validazione**
  - accetta solo statement di tipo UPDATE (`sparqlUpdateSchema(isUpdate)`)

- **Output**
  - **202** `{ accepted: true, jobId }`
  - **400** su validazione
  - **500** se enqueue fallisce

**Nota architetturale:** l’esecuzione dell’update non avviene nel processo API ma nel worker (vedi sezione Worker/Job System).

---

## /http-requests (routes/httpRequests.js)

Questa area copre:
1) ingestione di traffico HTTP
2) consultazione paginata delle richieste in GraphDB
3) gestione findings generati da un resolver

### POST /http-requests/ingest-http
Ingest di una o più HTTP request + enqueue job di scrittura.

- **Input body**
  - può essere:
    - un singolo oggetto request
    - un array di oggetti request
    - `{ items: Request[] }`
  - opzionale: `activateResolver` (boolean) per enqueue di un secondo job “http-resolver”

- **Validazione**
  - `ingestPayloadSchema`

- **Comportamento**
  - normalizza il payload in `list`
  - `queueHttpRequests.add('http-ingest', { payload: list })`
  - se `activateResolver`:
    - `queueHttpRequests.add('http-resolver', { list })`

- **Output**
  - **202** con struttura:
    ```json
    {
      "resRequest": { "accepted": true, "jobId": "<id>", "count": <n> },
      "resResolver": { "accepted": true, "jobId": "<id>", "count": <n> }
    }
    ```
    (`resResolver` presente solo se richiesto)
  - **500** se enqueue fallisce

**Nota:** `http-resolver` riceve `{ list }` mentre `http-ingest` riceve `{ payload: list }` (dettaglio importante lato worker).

---

### GET /http-requests/results/:jobId
Polling stato/risultato di un job HTTP (ingest o resolver).

- **Validazione params**
  - `jobIdParamSchema`

- **Output**
  - **200**
    ```json
    {
      "jobId": "...",
      "state": "completed|failed|active|waiting|...",
      "result": {...}|null,
      "createdAt": <timestamp>,
      "finishedAt": <timestamp|null>
    }
    ```
  - **404** `{ error: 'Job not found', jobId }`
  - **500** su errore interno

---

### GET /http-requests/list
Lista paginata di richieste HTTP salvate in GraphDB.

- **Query params**
  - `limit` (default 100)
  - `offset` (default 0)
  - filtri opzionali (applicati a livello SPARQL):
    - `method`, `scheme`, `authority`, `path`
    - `headerName`, `headerValue`
    - `text`

- **Validazione query**
  - `listQuerySchema`

- **Comportamento**
  - costruisce `filters`
  - SPARQL via `buildSelectRequestsPaged({ filters, limit, offset })`
  - esegue `runSelect`
  - estrae `total` dalla variabile `?total` sulle bindings
  - converte i dettagli con `bindingsToRequestsJson(detailBindings)`
  - ordina per `id`
  - calcola metadati paginazione (`hasNext/hasPrev/nextOffset/prevOffset`)

- **Output**
  - **200**
    ```json
    {
      "items": [ ... ],
      "page": {
        "limit": <n>,
        "offset": <n>,
        "total": <n>,
        "hasNext": true|false,
        "hasPrev": true|false,
        "nextOffset": <n|null>,
        "prevOffset": <n|null>
      }
    }
    ```
  - **502** se GraphDB fallisce

---

### GET /http-requests/:id
Dettaglio singola richiesta HTTP.

- **Params**
  - `id` (validato con `idParamSchema`)

- **Comportamento**
  - usa `buildSelectRequests({ ids: [id], ... })`
  - `bindingsToRequestsJson` → primo item

- **Output**
  - **200** item
  - **404** `{ error: 'Not found' }`
  - **502** su errore GraphDB

---

### GET /http-requests/finding/list
Lista paginata di `HttpFinding` prodotti dal resolver.

- **Query**
  - `limit`, `offset`

- **Validazione**
  - `httpFindingsListQuerySchema`

- **Comportamento**
  - SPARQL: `buildSelectHttpFindingsPaged`
  - parsing: `bindingsToHttpFindingsList` → `{ items, total }`
  - paginazione come per list

- **Output**
  - **200** `{ items, page: {...} }`
  - **502** GraphDB error

---

### GET /http-requests/finding/:id
Dettaglio di una singola `HttpFinding`.

- **Params**
  - `id` (validato con `httpFindingIdParamSchema`)

- **Comportamento**
  - SPARQL: `buildSelectHttpFindingById({ id })`
  - parsing: `bindingsToHttpFindingDetail`

- **Output**
  - **200** finding detail
  - **404** `{ error: 'Not found', id }`
  - **502** GraphDB error

---

## /techstack (routes/techstack.js)

### POST /techstack/analyze
Enqueue analisi “ontology/resolver” per uno snapshot TechStack.

- **Input body**
  - `technologies` (array)
  - `waf` (array)
  - `secureHeaders` (array)
  - `cookies` (array)
  - `mainDomain` (string)

- **Validazione**
  - `techstackBodySchema`

- **Comportamento**
  - `queueTechstack.add('techstack-analyze', { technologies, waf, secureHeaders, cookies, mainDomain })`

- **Output**
  - **202**
    ```json
    {
      "accepted": true,
      "jobId": "<id>",
      "technologies": <n>,
      "waf": <n>,
      "secureHeaders": <n>,
      "cookies": <n>
    }
    ```
  - **500** enqueue error

---

### GET /techstack/results/:jobId
Polling stato job techstack.

- **Validazione**
  - `jobIdParamSchema`

- **Output**
  - **200** `{ jobId, state, result, createdAt, finishedAt }`
  - **404** job non trovato
  - **500** errore interno

---

### GET /techstack/finding/list
Lista paginata di `TechstackFinding` in GraphDB.

- **Query**
  - `limit`, `offset`
- **Validazione**
  - `techstackFindingsListQuerySchema`
- **Output**
  - **200** `{ items, page }`
  - **502** error GraphDB

---

### GET /techstack/finding/:id
Dettaglio singolo `TechstackFinding`.

- **Params**
  - `id` (validato con `techstackFindingIdParamSchema`)
- **Comportamento**
  - SPARQL: `buildSelectTechstackFindingById`
  - parsing: `bindingsToTechstackFindingDetail`
- **Output**
  - **200** detail
  - **404** `{ error: 'Not found', id }`
  - **502** error GraphDB

---

## /analyzer (routes/analyzer.js)

### POST /analyzer/analyze
Enqueue di un job di analisi SAST/DOM/HTML.

- **Input body**
  - `url` (string)
  - `html` (string)
  - `scripts` (array)
  - `forms` (array)
  - `iframes` (array)
  - `includeSnippets` (boolean)

- **Validazione**
  - `analyzerBodySchema`

- **Comportamento**
  - `queueAnalyzer.add('sast-analyze', { url, html, scripts, forms, iframes, includeSnippets })`

- **Output**
  - **202**
    ```json
    {
      "accepted": true,
      "jobId": "<id>",
      "url": "...",
      "scripts": <n>,
      "forms": <n>,
      "iframes": <n>,
      "includeSnippets": true|false
    }
    ```
  - **500** enqueue error

---

### GET /analyzer/results/:jobId
Polling job analyzer.

- **Validazione**
  - `jobIdParamSchema`

- **Output**
  - **200** `{ jobId, state, result, createdAt, finishedAt }`
  - **404** job non trovato
  - **500** errore interno

---

### GET /analyzer/finding/list
Lista paginata `AnalyzerFinding`.

- **Query**
  - `limit`, `offset`
- **Validazione**
  - `analyzerFindingsListQuerySchema`
- **Comportamento**
  - SPARQL: `buildSelectAnalyzerFindingsPaged`
  - parsing: `bindingsToAnalyzerFindingsList` → `{ items, total }`
- **Output**
  - **200** `{ items, page }`
  - **502** error GraphDB

---

### GET /analyzer/finding/:id
Dettaglio singolo `AnalyzerFinding`.

- **Params**
  - `id` (validato con `analyzerFindingIdParamSchema`)
- **Comportamento**
  - SPARQL: `buildSelectAnalyzerFindingById`
  - parsing: `bindingsToAnalyzerFindingDetail`
- **Output**
  - **200** detail
  - **404** `{ error: 'Not found', id }`
  - **502** error GraphDB

---

## /pcap (routes/pcap.js)

Questo router gestisce upload file e conversione PCAP → JSON HTTP requests tramite script Python.

### POST /pcap/pcap-http-requests
Carica PCAP + TLS keylog e restituisce una lista di richieste HTTP estratte.

- **Content-Type**
  - `multipart/form-data`

- **Fields**
  - `pcap` (file, obbligatorio) `.pcap` / `.pcapng`
  - `sslkeys` (file, obbligatorio) keylog TLS

- **Upload handling**
  - Multer con storage su `os.tmpdir()`
  - max upload: **200 MB**
  - filename univoco: `<timestamp>-<random>-<originalname>`

- **Processing**
  - spawn:
    - script: `scripts/pcap_to_http_json.py`
    - python bin: `PYTHON_BIN || 'python'`
  - legge stdout come JSON (atteso array)
  - stderr viene catturato e incluso nel messaggio di errore in caso di exit code != 0

- **Cleanup**
  - `safeUnlink` in `finally`: rimuove sempre file temporanei

- **Output**
  - **200** `HttpRequest[]` (array)
  - **400** se manca `pcap` o `sslkeys`
  - **500** su fallimento spawn/exit != 0/JSON invalido

**Nota architetturale:** questo endpoint NON enqueua job BullMQ; produce output sincrono (potenzialmente costoso). In contesti con PCAP grandi può essere candidato a conversione asincrona.

---

## Mappa rapida: endpoint per “job lifecycle”

Per ogni dominio asincrono, l’API espone tipicamente:

- `POST /<domain>/<action>` → enqueue, **202** con `jobId`
- `GET /<domain>/results/:jobId` → polling stato/risultato

Domini che seguono questo pattern:
- `http-requests` (ingest/resolver) → `queueHttpRequests`
- `sparql` (update) → `queueSparql`
- `techstack` (analyze) → `queueTechstack`
- `analyzer` (analyze) → `queueAnalyzer`

---

## Considerazioni operative

- **Codici di risposta coerenti**
  - 202: job accettato (async)
  - 200: query sincrona ok
  - 400: input invalido (Celebrate)
  - 404: job/finding non trovato
  - 500: errore interno o enqueue fallito
  - 502: dipendenza upstream (GraphDB) non disponibile o query fallita

- **Osservabilità**
  - log `info` per enqueue, paging, not-found
  - log `error` su fallimenti enqueue e query GraphDB
  - job event in tempo reale via WS (vedi sezione successiva)

---