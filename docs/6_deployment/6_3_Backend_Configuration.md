# Backend Configuration
---

Questo documento descrive **come configurare l’Engine/Tool backend prima dell’avvio o della build**, seguendo un approccio **backend-first**.

L’obiettivo è permettere all’utente di:
- capire **come è strutturato il backend**;
- sapere **quali file e variabili modificare prima di `docker compose up -d`**;
- evitare rebuild inutili o configurazioni errate a runtime.

---

## 1) Docker Compose – Overview dei servizi

Il backend è orchestrato tramite **Docker Compose** e composto dai seguenti servizi principali.

---

### Redis

**Ruolo**
- Message broker e backend per le **queue BullMQ**.
- Gestisce job asincroni, retry, backoff e stato temporaneo.

**Configurazione principale**
- Porta: `6379`
- Persistenza: volume `redis_data`
- Healthcheck attivo (`redis-cli ping`)

**Dipendenze**
- `node-api`
- `node-worker`

---

### GraphDB

**Ruolo**
- Triple store RDF per:
    - HTTP requests;
    - findings (Analyzer / Techstack / HTTP);
    - ontologia e correlazioni semantiche.

**Configurazione principale**
- Porta UI/API: `7200`
- Persistenza: volume `graphdb_data`
- Heap Java configurato via `JAVA_OPTS`

---

### graphdb-init (bootstrap)

**Ruolo**
- Container **one-shot** responsabile del bootstrap iniziale.

**Cosa fa**
1. Attende che GraphDB risponda su `/rest/repositories`;
2. Controlla se il repository `ontowebpt` esiste;
3. Se non esiste:
    - lo crea usando `repository.ttl`;
4. Controlla se l’ontologia è già presente;
5. Se non presente:
    - importa `ontology.rdf`.

**Caratteristica chiave**

- **Idempotente**:
    - se repository e ontologia esistono → **skip** automatico;
    - non duplica dati.

**File coinvolti**

- `/engine/graphdb/repository.ttl`
- `/engine/graphdb/ontology.rdf`

---

### node-api

**Ruolo**
- Server Express REST;
- Gateway WebSocket (eventi + `/logs`);
- Entry point per:
    - Dashboard;
    - Extension;
    - PCAP upload;
    - Health/status.

**Caratteristiche**
- Porta interna: `8081`
- Esposta esternamente tramite **Nginx**
- Legge configurazione da `/engine/nodejs/.env`

---

### node-worker

**Ruolo**
- Esecuzione asincrona dei job:
    - HTTP ingestion;
    - Techstack analysis;
    - Analyzer scan;
    - SPARQL writes.

**Caratteristiche**
- Nessuna porta esposta;
- Condivide `.env` con `node-api`;
- Concurrency configurabile per tipo di worker;
- Usa `tshark` per parsing PCAP.

---

### Nginx

**Ruolo**
- Reverse proxy frontend/backed;
- Espone l’API su `http://localhost/`;
- Gestisce:
    - buffering;
    - upload PCAP;
    - WebSocket upgrade.

**Nota**
- Non contiene frontend statico: la Dashboard è servita dall’API Node.

---

## 2) Backend Environment Variables

La configurazione principale del backend è centralizzata nel file:
`/engine/nodejs/.env`
Questo file viene usato **sia da `node-api` che da `node-worker`**.

---

### Logging

`LOG_FORMAT=pretty LOG_LEVEL=info LOG_COALESCE_WINDOW_MS=3000 LOGS_WS_URL=http://localhost:8081/logs`
- `LOG_LEVEL`: `debug | info | warn | error`
- `LOG_FORMAT`: formattazione output
- `LOGS_WS_URL`: endpoint WebSocket per streaming log

---

### Server Express / WebSocket

`SERVER_HOST=localhost SERVER_PORT=8081 SOCKETS_CORS_ORIGIN=*`
- `SERVER_HOST`: binding host (interno al container)
- `SERVER_PORT`: porta Express
- `SOCKETS_CORS_ORIGIN`: CORS WebSocket (Dashboard/Extension)

---

### GraphDB

`GRAPHDB_BASE=http://localhost:7200 GRAPHDB_REPO=ontowebpt`
- `GRAPHDB_BASE`: base URL GraphDB
- `GRAPHDB_REPO`: repository RDF target

Deve combaciare con il repository creato da `graphdb-init`.

---

### Redis

`REDIS_HOST=127.0.0.1 REDIS_PORT=6379 QUIET_REDIS_ERRORS=0`
- `REDIS_HOST`: hostname Redis
- `REDIS_PORT`: porta Redis
- `QUIET_REDIS_ERRORS`: silenzia warning non critici

---

### Queue configuration (retry / backoff)

Ogni tipo di job ha una queue dedicata:

`QUEUE_NAME_HTTP_REQUESTS_WRITES=http-requests-writes QUEUE_NAME_SPARQL_WRITES=sparql-writes QUEUE_NAME_TECHSTACK_WRITES=techstack-analyze QUEUE_NAME_ANALYZER_WRITES=analyzer-writes`

Configurazioni comuni:
- tentativi (`JOB_*_ATTEMPTS`);
- backoff (`exponential`);
- cleanup su complete/fail.

---

### Worker concurrency e stalled jobs

`CONCURRENCY_WORKER_HTTP_REQUESTS=2 STALLED_INTERVAL_WORKER_HTTP_REQUESTS=30000`
- `CONCURRENCY_*`: numero massimo di job paralleli;
- `STALLED_INTERVAL_*`: timeout per job bloccati.

---

### Ontologia e Named Graphs

`ONT_EX=http://localhost/onto/ontowebpt ONT_CONTENT=http://www.w3.org/2008/content  HTTP_REQUESTS_NAME_GRAPH=http://localhost/graphs/http-requests FINDINGS_NAME_GRAPH=http://localhost/graphs/findings`
- URI base ontologia;
- named graph separati per:
    - HTTP data;
    - findings.

Cambiare questi valori **implica modifiche semantiche** nelle query SPARQL.

---

### NVD API Key

`NVD_API_KEY=...`

Usata dal **Techstack Resolver** per:
- enrichment CVE/CPE;
- query verso NVD API.

---

### TShark

`TSHARK_BIN=/usr/bin/tshark`
- Path al binario `tshark`;
- già incluso nell’immagine Docker Node.

---

## 3) Nginx Configuration

File:
`/engine/nginx/nginx.conf`

### Upload PCAP

`client_max_body_size 200m;`
Consente upload di file PCAP di grandi dimensioni.

---

### Buffering

`proxy_buffering on;`
- evita overload dell’API su upload lunghi;
- migliora stabilità.

---

### Reverse Proxy

`upstream node_upstream {   server host.docker.internal:8081; }`
- inoltra traffico REST e WebSocket a `node-api`;
- supporta upgrade WebSocket.

---

## 4) GraphDB Bootstrap

### repository.ttl

Definisce:
- ID repository (`ontowebpt`);
- tipo storage;
- reasoning;
- namespace predefiniti.

Usato **una sola volta** alla creazione iniziale.

---

### ontology.rdf

Contiene:
- classi (Request, Response, Finding, Resolver, ecc.);
- proprietà;
- relazioni semantiche.

Importata **solo se assente**.

---

### Comportamento idempotente

Lo script `graphdb-init`:
- non ricrea repository esistenti;
- non reimporta ontologia se già presente;
- rende sicuro il riavvio del sistema.

---

## 5) Cosa configurare prima dell’avvio

**Checklist consigliata:**
-  Verificare `.env` (`GRAPHDB_BASE`, `REDIS_HOST`, API keys)
-  Eventuali modifiche a queue / concurrency
-  Verificare `repository.ttl` e `ontology.rdf`
-  Controllare limiti Nginx (PCAP size)

Una volta fatto, è sufficiente:
`docker compose up -d`

Il backend sarà avviato con la configurazione desiderata.

---