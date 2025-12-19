# API Server
---

- [Entry Point and Bootstrap](./4_3_1_Api_Server/4_3_1_1_Entry_Point_Bootstrap.md)
- [REST Endpoints](./4_3_1_Api_Server/4_3_1_2_REST_Endpoints.md)
- [WebSocket Gateway](./4_3_1_Api_Server/4_3_1_3_WebSocket_Gateway.md)
- [Error Handling and Logging](./4_3_1_Api_Server/4_3_1_4_Error_Handling_Logging.md)
- [Utils Functions](./4_3_1_Api_Server/4_3_1_5_Utils_Functions.md)
- [Script Python](./4_3_1_Api_Server/4_3_1_6_PCAP_Python_Script.md)

---

Questa sezione descrive l’**implementazione** del componente **API Server** del Tool (Engine/Tool), cioè il backend che espone endpoint **REST** e canali **WebSocket** utilizzati dalla Dashboard e dall’estensione per:
- verificare lo **stato** del sistema (health),
- avviare operazioni “pesanti” in **background** (ingestion e analisi),
- osservare l’avanzamento tramite **job events** e consultare i **risultati** dei job.

---

## Ruolo architetturale

**API Server** è il punto di ingresso del backend. Non esegue direttamente le elaborazioni più costose: tipicamente:
1. valida e normalizza i payload in ingresso,
2. crea uno o più **job** (BullMQ/Redis),
3. risponde subito al client con uno stato “accepted” e un `jobId`,
4. pubblica aggiornamenti (WebSocket) e rende consultabili gli esiti (REST).

Questo approccio mantiene l’API reattiva e rende tracciabile l’avanzamento delle operazioni.

---

## Struttura logica (pattern consigliato / adottato)

L’implementazione è organizzata secondo separazione di responsabilità:

- **Routes**: definiscono URL, metodi, schema di input, binding verso controller.
- **Controllers**: orchestrano request/response, invocano servizi, mappano errori in HTTP status.
- **Services**: logica applicativa “thin” (validazione avanzata, normalizzazione payload, composizione job).
- **Queue/Jobs layer**: creazione job, gestione id, stato, retry, failure.
- **Adapters**: integrazioni esterne (GraphDB, Redis, filesystem, ecc.).
- **WebSocket gateway**: gestione connessioni, subscription ai job, emissione eventi ai client.

---

## Entry point e bootstrap

All’avvio, il server:
1. carica la configurazione (env + default),
2. inizializza logger,
3. abilita middleware comuni (CORS, parsing JSON, limiti payload),
4. monta routes REST versionate,
5. avvia WebSocket gateway (o namespace dedicato),
6. registra endpoint di health.

Punti chiave del bootstrap:
- **Fail-fast**: se mancano variabili d’ambiente critiche (es. Redis/GraphDB), il server deve segnalare chiaramente lo stato “degraded/off”.
- **Limiti payload**: l’ingestion può inviare batch grandi (fino a svariati MB); occorre un limite esplicito lato server (e/o compressione) coerente col client.

---

## Contratti REST principali

Di seguito i contratti “operativi” coerenti con il comportamento osservabile dal client (estensione/Dashboard). I nomi esatti degli endpoint possono variare, ma i **ruoli** e i **payload** sono questi.

### Health check

**Scopo**: indicare se il Tool è utilizzabile e quali componenti sono *up/down*.

- `GET /health`
- Risposta tipica:
  - `ok: boolean`
  - `components: { redis: "up|down", graphdb: "up|down", worker: "up|down", ... }`

Il client calcola “tool_on” solo se `ok === true` e **tutti** i componenti risultano `up`.

### Ingestion HTTP (Interceptor → Ontology)

**Scopo**: inserire richieste HTTP (spesso a batch) nella knowledge base (GraphDB), con opzione resolver.

- `POST /ingest/http`
- Input: batch RDF/triadi o payload strutturato (dipende dal mapping implementato)
- Flag: `activateResolver: boolean`
- Output:
  - `resRequest: { accepted: boolean, jobId?: string }`
  - `resResolver: { accepted: boolean, jobId?: string }` (opzionale)

Nota: nel client si vede chiaramente che l’ingestion e il resolver possono generare **due job distinti**.

### Analisi TechStack (Techstack → Resolver/Ontology)

**Scopo**: inviare una snapshot TechStack salvata e avviare un job di analisi/risoluzione.

- `POST /analyze/techstack`
- Input: risultati TechStack + `mainDomain` (dominio principale/URL)
- Output:
  - `{ accepted: boolean, jobId?: string, error?: string }`

---

## Job model e API di osservabilità

L’API Server espone due meccanismi complementari:

### 1) WebSocket events (primario)

**Scopo**: notificare in tempo reale lo stato dei job (created/active/progress/completed/failed).

Eventi tipici:
- `tool_update` / `health_update` (stato complessivo tool)
- `job_event` con campi:
  - `queue` (es. `http`, `techstack`)
  - `jobId`
  - `event` (es. `completed`, `failed`, `progress`, …)
  - `data` (payload event-specific)

**Subscription**:
- il client invoca una `subscribeJob(jobId)` per ricevere eventi solo dei job di interesse,
- alla fine invoca `unsubscribeJob(jobId)` (best effort).

### 2) REST polling (fallback)

**Scopo**: recuperare lo stato job anche se WS è indisponibile o se qualche evento è andato perso.

- `GET /jobs/:queue/:jobId`
- Output: `{ ok: boolean, data?: { state, progress, result, failedReason, ... } }`

Nel client la strategia è “ibrida”:
- WS per eventi live,
- polling ogni ~3s quando un dialog “Job Summaries” è aperto,
- stop polling quando tutti i job sono terminali (completed/failed).

---

## Error handling

Linee guida implementative per robustezza:

- **Validation errors** (input incompleto/malformato): `400 Bad Request` con dettagli minimi (campo mancante).
- **Tool offline / dipendenze down**:
  - `503 Service Unavailable` oppure `200 ok:false` sul health,
  - messaggi coerenti col client (“tool_off”).
- **Job enqueue failure** (Redis non disponibile): `502/503` con `accepted:false`.
- **Unhandled errors**: `500` con `requestId` per correlazione log.

È importante che l’errore sia **deterministico**: il client mostra snackbar “warning/error” e non deve restare in stati intermedi indefiniti.

---

## Logging e osservabilità

Minimo indispensabile:
- log strutturati (JSON) con:
  - timestamp,
  - livello,
  - route/method,
  - `requestId`,
  - `jobId` quando presente,
  - durata request.
- tracciamento di:
  - enqueue job,
  - completamento job (anche lato worker),
  - errori di integrazione GraphDB/Redis.

---

## Configurazione API Server

La configurazione è gestita via variabili d’ambiente (vedi sezione 4.3.4) con gruppi tipici:
- HTTP server: host, port, CORS origins
- Redis/BullMQ: URL, prefix, queue names
- GraphDB: endpoint, repository, credenziali
- limiti: max payload, timeout, batch size

---

## Casi d’uso end-to-end supportati dall’API Server

1. **Tool Status**
   - client → `GET /health`
   - server → `ok/components`
   - client → mostra “tool_on / tool_off”.

2. **Send HTTP Requests to Ontology**
   - client → `POST /ingest/http` (N batch)
   - server → enqueue job(s) → ritorna `accepted + jobId`
   - client → subscribe WS job + polling fallback
   - server → emette `job_event` fino a `completed/failed`.

3. **Analyze TechStack**
   - client → `POST /analyze/techstack`
   - server → enqueue job → ritorna `accepted + jobId`
   - client → subscribe/poll → dialog “Job Summaries”.

---

## Limiti e non-obiettivi

- L’API Server **non** esegue direttamente la logica pesante di parsing/risoluzione: delega ai worker.
- L’API Server **non** gestisce il lock globale di scansione dell’estensione (quello è lato client/extension).
- Il traffico “runtime capture” dell’Interceptor avviene nell’estensione; il backend vede solo i dati **esplicitamente inviati** (es. “Send to Ontology”).

---
