# Configurazione generale ed Environment
---

Questa sezione descrive come il sistema viene configurato a runtime tramite **Docker Compose**, **variabili d’ambiente** e **file `.env`**, evidenziando le convenzioni adottate per distinguere configurazione locale, configurazione in container e parametri “sensibili” (es. API key).

---

## Stratificazione della configurazione

L’Engine/Tool viene eseguito in ambiente containerizzato e la configurazione è determinata da tre livelli principali:

1. **Valori di default nel codice**  
    Alcuni moduli prevedono fallback (es. host/porte o campi opzionali) per poter funzionare anche in contesti di sviluppo.
    
2. **File `nodejs/.env`**  
    Contiene i valori standard per l’esecuzione in locale e costituisce la base comune sia per `node-api` che per `node-worker`.
    
3. **Override in `docker-compose.yml`**  
    Alcune variabili vengono sovrascritte esplicitamente nella sezione `environment:` dei servizi per adattare i riferimenti all’ambiente Docker (es. `REDIS_HOST=redis`, `GRAPHDB_BASE=http://graphdb:7200`).
    

> In Docker Compose, le variabili definite in `environment:` **sovrascrivono** eventuali valori provenienti dal file `env_file:`.

---

## Configurazione generale in Docker Compose

### Servizi principali e dipendenze

La composizione include:
- **node-api**: API server (Express + WebSocket) esposto su `8081:8081`.
- **node-worker**: worker BullMQ per job asincroni.
- **redis**: backend di coda/stato job.
- **graphdb**: triple store RDF.
- **graphdb-init**: container “one-shot” per bootstrap repository + import ontologia.
- **nginx**: reverse proxy su porta `80:80`.

Le dipendenze applicative sono esplicitate tramite `depends_on`:
- `node-api` e `node-worker` dipendono da `redis` e `graphdb`.
- `graphdb-init` dipende da `graphdb` e viene eseguito una sola volta (restart `"no"`).

### Reti e isolamento

Sono definite due reti bridge:
- **backend**: usata da `node-api`, `node-worker`, `redis`, `graphdb`, `graphdb-init`
- **frontend**: usata da `nginx`

Questo separa il traffico pubblico (Nginx) dai servizi interni, riducendo l’esposizione di componenti infrastrutturali.

### Persistenza dati

Sono definiti volumi Docker:
- `redis_data` → montato su `/data` (AOF abilitato)
- `graphdb_data` → montato su `/opt/graphdb/home`

La persistenza garantisce che:
- la coda e gli stati (Redis) sopravvivano ai restart,
- il repository e gli indici (GraphDB) restino disponibili tra ricostruzioni dei container.

### Healthcheck

Sono previsti healthcheck per:
- **Redis**: `redis-cli ping`
- **Nginx**: check HTTP su `/health` (proxy verso API)

Questi meccanismi migliorano l’osservabilità e riducono errori in avvio “a cascata”.

---

## Immagine Node.js e dipendenze di runtime

Il `nodejs/Dockerfile` costruisce un’immagine unica riutilizzata da **node-api** e **node-worker** con:
- base: `node:22-bookworm-slim`
- installazione strumenti di supporto:
    - `python3` (necessario per lo script PCAP)
    - `tshark` (necessario per parsing traffico)
- `npm ci --omit=dev` per installare sole dipendenze production

È inoltre esposta la porta `8081` per l’API server.

---

## Variabili d’ambiente: gruppi funzionali

Di seguito i principali gruppi presenti in `nodejs/.env` (e relativi override in compose).

### Logging e osservabilità

- `LOG_FORMAT`, `LOG_LEVEL`
- `LOG_COALESCE_WINDOW_MS`
- `LOGS_WS_URL`  
    In compose, per il **worker** viene impostato `LOGS_WS_URL=http://node-api:8081/logs` così da inviare eventi log all’API nel network backend.

### API server

- `SERVER_HOST`, `SERVER_PORT`
- `SOCKETS_CORS_ORIGIN`

In compose viene forzato:

- `SERVER_HOST=0.0.0.0` per consentire binding su tutte le interfacce dentro il container.

### GraphDB

- `GRAPHDB_BASE`, `GRAPHDB_REPO`
- `GRAPHDB_HEALTH_INTERVAL_MS`

In compose:

- `GRAPHDB_BASE=http://graphdb:7200` (risoluzione via DNS di servizio nel network backend)

### Redis / BullMQ

- `REDIS_HOST`, `REDIS_PORT`
- `QUIET_REDIS_ERRORS`
- parametri di naming e retry delle code:  
    `QUEUE_NAME_*`, `JOB_*_ATTEMPTS`, `JOB_*_BACKOFF_*`, `JOB_*_REMOVE_ON_*`

In compose:

- `REDIS_HOST=redis` per usare il container Redis come endpoint interno.

### Configurazione worker

- `CONCURRENCY_WORKER_*`
- `STALLED_INTERVAL_WORKER_*`

Queste variabili controllano parallelismo e gestione job “stalled” per ciascun worker (HTTP, SPARQL, Techstack, Analyzer).

### Ontologia e Named Graphs

- `ONT_EX`, `ONT_CONTENT`
- `HTTP_REQUESTS_NAME_GRAPH`
- `FINDINGS_NAME_GRAPH`

Questi parametri definiscono gli IRI base e i grafi nominali utilizzati in fase di scrittura su GraphDB (dati HTTP separati dai risultati dei resolver).

### Chiavi/API esterne

- `NVD_API_KEY`

Usata dal **Techstack Resolver** per interrogare NVD (National Vulnerability Database) con rate limit più permissivo.

> Nota operativa: `NVD_API_KEY` è un segreto applicativo e, in ambienti non di sviluppo, dovrebbe essere gestita tramite secret manager o variabili d’ambiente fuori repository (non hard-coded nei file versionati).

---

## Considerazioni di deploy e coerenza tra reti

Nel file `nginx.conf` l’upstream è configurato come:

- `server host.docker.internal:8081`

Questo implica che Nginx instradi verso la porta **pubblicata sull’host**, non direttamente verso `node-api` tramite DNS Docker. La scelta è coerente con la separazione delle reti (`nginx` sta su `frontend`, `node-api` su `backend`): usando `host.docker.internal`, Nginx può raggiungere l’host gateway e quindi la porta mappata del servizio.

Alternative possibili (non adottate qui) includerebbero:
- collegare `nginx` anche alla rete `backend`, oppure
- definire un network condiviso tra `nginx` e `node-api`.

---
