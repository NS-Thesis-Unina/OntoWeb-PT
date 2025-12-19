# Workers, Queues and Observability
---

Questo documento descrive come funziona il runtime dell’Engine OntoWebPT in termini di:
- **Job system** (BullMQ + Redis),
- **worker** (concorrenza, retry/backoff),
- **osservabilità** (health REST + WebSocket logs),
- troubleshooting rapido quando la Tool Status page segnala problemi.

---

## BullMQ queues on Redis

Il backend usa **BullMQ** appoggiandosi a **Redis** come storage per:
- code (jobs),
- stati (queued/active/completed/failed),
- retry e backoff.

Le code principali (nomi configurabili via `.env`) sono:
- `http-requests-writes`  
    Ingestione di richieste/risposte HTTP (es. da Interceptor o da Send PCAP) e persistenza in GraphDB.
- `sparql-writes`  
    Scritture SPARQL “generiche” o di supporto (arricchimenti, linking, operazioni bulk).
- `techstack-analyze`  
    Job di analisi Techstack (fingerprinting + CVE enrichment, se configurato).
- `analyzer-writes`  
    Job di analisi Analyzer (DOM/HTML inspection e produzione di finding).

> Nota: i nomi possono essere cambiati tramite variabili `QUEUE_NAME_*` nel file `/engine/nodejs/.env`. Il worker e l’API devono usare la stessa configurazione.

---

## Worker concurrency

Ogni worker può processare più job in parallelo. La concorrenza è configurata con variabili del tipo:
- `CONCURRENCY_WORKER_HTTP_REQUESTS`
- `CONCURRENCY_WORKER_SPARQL`
- `CONCURRENCY_WORKER_TECHSTACK`
- `CONCURRENCY_WORKER_ANALYZER`

Esempio (valori tipici):

```
CONCURRENCY_WORKER_HTTP_REQUESTS=2 CONCURRENCY_WORKER_SPARQL=2 CONCURRENCY_WORKER_TECHSTACK=2 CONCURRENCY_WORKER_ANALYZER=2
```

### Impatto pratico

- aumentare la concorrenza aumenta il throughput, ma:
    - aumenta anche il carico su **GraphDB** (scritture SPARQL/RDF),
    - aumenta l’uso CPU/RAM lato container `node-worker`,
    - può amplificare “burst” di scritture e contesa su Redis/GraphDB.

Suggerimento: aumentare i valori gradualmente e monitorare GraphDB (RAM, GC) e tempi di job.

---

## Retry and backoff

Le policy di retry/backoff sono controllate da variabili `JOB_*` nel file `/engine/nodejs/.env`. Per ogni categoria di job tipicamente esistono:
- `JOB_*_ATTEMPTS`  
    numero massimo di tentativi prima di marcare failed.
- `JOB_*_BACKOFF_TYPE`  
    strategia (es. `exponential`).
- `JOB_*_BACKOFF_DELAY` (o `JOB_*_DELAY` a seconda del job)  
    delay iniziale (ms) o delay usato dalla policy.

Esempio (HTTP requests):
```
JOB_HTTP_REQUESTS_ATTEMPTS=5 
JOB_HTTP_REQUESTS_BACKOFF_TYPE=exponential 
JOB_HTTP_REQUESTS_BACKOFF_DELAY=2000
```

### Note operative

- Backoff esponenziale è utile per errori transitori (es. GraphDB temporaneamente lento).
- Se i job falliscono “sempre” (errore deterministico: config errata, repository mancante, ecc.), aumentare attempts non risolve: va corretto l’errore a monte.

---

## Worker heartbeat and stalled jobs

BullMQ considera “stalled” un job se:
- un worker lo prende in carico,
- ma non aggiorna lo stato entro un intervallo previsto (crash, blocco, OOM).

Gli intervalli sono configurati con variabili del tipo:
- `STALLED_INTERVAL_WORKER_HTTP_REQUESTS`
- `STALLED_INTERVAL_WORKER_SPARQL`
- `STALLED_INTERVAL_WORKER_TECHSTACK`
- `STALLED_INTERVAL_WORKER_ANALYZER`

Esempio:

`STALLED_INTERVAL_WORKER_HTTP_REQUESTS=30000`

Se vedi job che passano spesso in stalled:
- controlla `docker logs node-worker`,
- verifica risorse (CPU/RAM),
- verifica latenza/risposta GraphDB.

---

## Tool Status and health observability

La pagina **Tool Status** del Dashboard aggrega tre canali di osservabilità:

### 1) REST polling `/health`

Il client esegue polling periodico (es. ogni 5s) su:
- `GET http://localhost/health` (via Nginx)

Il backend risponde con uno stato consolidato e per-component (server/redis/graphdb). Questo è il “truth source” sincrono per la UI.

### 2) WebSocket root namespace (connectivity)

Il Dashboard apre una connessione WebSocket (Socket.io) al backend, root namespace:
- `http://localhost:8081` (configurabile via env dashboard)

Usata principalmente per:
- mostrare **connected / disconnected**,
- triggerare un refresh UI quando la connettività cambia.

### 3) WebSocket namespace `/logs`

Il Dashboard apre una seconda connessione:
- `http://localhost:8081/logs`

e riceve eventi `log` in streaming (buffer rolling, es. ultimi ~80 eventi).  
Questi log possono provenire dall’API e/o dai worker, e servono per troubleshooting rapido e percezione “live”.

---

## Troubleshooting rapido

### Caso A — Tool Status dice “Redis down”

Sintomi:
- `/health` segnala `redis: down`
- job non partono / rimangono in coda
- worker non processa

Check rapidi:

```
docker ps | grep redis 
docker logs -f redis
```

Azioni comuni:
- verificare che la porta 6379 non sia in conflitto (solo se usi Redis locale esterno),
- controllare rete docker (`backend`),
- riavviare il servizio:

`docker compose restart redis`

---

### Caso B — Tool Status dice “GraphDB down”

Sintomi:
- `/health` segnala `graphdb: down`
- job falliscono con errori di query/scrittura
- UI GraphDB non raggiungibile o lenta

Check rapidi:

```
docker ps | grep graphdb 
docker logs -f graphdb 
docker logs -f graphdb-init
```

Cause tipiche:
- GraphDB in startup lento (attendere init),
- repository non creato (graphdb-init fallito),
- memoria JVM insufficiente (OOME / GC thrashing).

Azioni comuni:
- controllare che `graphdb-init` sia completato con successo,
- aumentare memoria JVM se necessario (docker-compose `JAVA_OPTS=-Xms1g -Xmx2g`),
- riavviare GraphDB:

`docker compose restart graphdb`

---

### Caso C — Worker non processa job

Check rapidi:

```
docker logs -f node-worker 
docker logs -f node-api
```

Cose da verificare:
- `REDIS_HOST` e `GRAPHDB_BASE` corretti nel container (in compose sono “redis” e “graphdb”),
- nomi delle queue coerenti tra API e worker (stesso `.env`),
- concorrenza troppo alta che manda in crisi GraphDB (ridurre `CONCURRENCY_WORKER_*`).

---

### Caso D — PCAP upload fallisce (413 / timeout)

Sintomi:
- errore HTTP 413 (payload too large) o timeout durante `/pcap/pcap-http-requests`

Verificare in Nginx:
- `client_max_body_size` nel location PCAP (configurato a `200m` nel tuo `nginx.conf`)
- `proxy_read_timeout` / `proxy_send_timeout` adeguati

---

## Comandi utili di osservabilità

```
# Stato container 
docker compose ps  

# Log in tempo reale 
docker logs -f node-api 
docker logs -f node-worker 
docker logs -f graphdb 
docker logs -f graphdb-init 
docker logs -f redis 
docker logs -f nginx
```

---