# Panoramica della repository e del processo di build
---

Questa sezione descrive **come è organizzata la repository** e **come si costruiscono/avviano** le principali componenti (Engine/Tool, Dashboard, Extension, Ontologia, ZSH plugin). L’obiettivo è dare un orientamento rapido “da sviluppatore”, prima di entrare nei dettagli white-box dei singoli moduli.

---

## Struttura della repository GitHub

Il progetto è mantenuto in **un’unica repository**. La root contiene sia il codice eseguibile sia gli artefatti di configurazione e la documentazione.

Struttura logica (alto livello):
- **`docs/`**  
    Contiene la documentazione in formato **Markdown**, organizzata per capitoli e pensata per essere navigata/modificata con **Obsidian**. È la “sorgente” della documentazione del progetto.
- **`engine/`**  
    Contiene tutto ciò che riguarda l’**Engine/Tool**, cioè l’ambiente di esecuzione containerizzato (Docker Compose) e i moduli Node.js che implementano **API server** e **worker**. Qui convivono:
    - infrastruttura containerizzata (Redis, GraphDB, Nginx);
    - configurazioni (nginx.conf, repository.ttl, ontology.rdf);
    - codice custom (node-api e node-worker);
    - progetto Dashboard React destinato ad essere buildato e servito dal backend.
- **`extension/`**  
    Contiene l’implementazione dell’**estensione browser** (popup) e la sua pipeline di sviluppo/build tramite tool `extension`.
- **`onto/`**  
    Contiene la versione corrente dell’**ontologia** in RDF e una sottocartella **`old/`** con versioni precedenti (storico).
- **`zsh-plugin/`**  
    Contiene lo script/plugin ZSH.

---

## Script principali e workflow di build/esecuzione

Il progetto non usa un “build system” unico in root: ogni macro-componente ha i propri comandi, tipicamente esposti via `package.json` o via `docker-compose`.

#### Engine/Tool (Docker Compose)

Il file **`engine/docker-compose.yml`** è l’entrypoint operativo principale per avviare l’intero ambiente Engine (servizi + backend).

Servizi definiti:
- **redis** (immagine `redis:latest`, AOF abilitato, healthcheck `redis-cli ping`)
- **graphdb** (immagine `ontotext/graphdb:10.8.11`)
- **graphdb-init** (container `curlimages/curl` che inizializza repository e importa l’ontologia se mancante)
- **node-api** (build da `engine/nodejs/Dockerfile`, comando `npm run start:api`, porta 8081)
- **node-worker** (stessa immagine, comando `npm run start:worker`)
- **nginx** (immagine `nginx:alpine`, reverse proxy verso `node-api`, porta 80, healthcheck `/health`)

Il Compose usa:
- `env_file: engine/nodejs/.env` per API e worker,
- override di alcune variabili `environment:` per adattare host/URL interni ai container (es. `REDIS_HOST=redis`, `GRAPHDB_BASE=http://graphdb:7200`).

#### Backend Node.js (API + Worker)

Nel package `engine/nodejs/` sono definiti script separati per sviluppo ed esecuzione:
- **Sviluppo (hot reload)**
    - `npm run dev:api` → `nodemon src/server.js`
    - `npm run dev:worker` → `nodemon src/worker.js`
    - `npm run dev:all` → avvia entrambi in parallelo con `concurrently`
- **Produzione**
    - `npm run start:api` → `node src/server.js`
    - `npm run start:worker` → `node src/worker.js`
    - `npm run start:all` → avvia entrambi in parallelo
- **Test**
    - `npm test` (+ varianti unit/integration/e2e)

**API server e worker condividono lo stesso codebase**, ma hanno **entrypoint distinti**.

#### Dashboard (React/Vite)

Nel package `engine/nodejs-dashboard/` la dashboard è gestita con Vite:

- `npm run dev` → sviluppo con Vite dev server
- `npm run build` → build statico
- `npm run preview` → preview del build
- `npm run lint` → linting

La dashboard usa variabili `VITE_*` e, dopo build, è prevista l’integrazione con il backend (**servita dal node-api** secondo il vostro setup).
#### Extension (Browser)

Nel package `extension/`:
- `npm run dev` → avvio in modalità dev (porta 17300) con polyfill
- `npm run build` → build per browser target (all) con polyfill

Qui l’entrypoint non è Vite ma il tool `extension` (dipendenza dev `extension@2.0.4`), che gestisce packaging e compatibilità browser.

#### Documentazione

La documentazione è sotto `docs/` e viene gestita come contenuto Markdown per Obsidian. Non è vincolata a script di build: il “workflow” è principalmente editoriale.
#### Ontologia e ZSH plugin

- `onto/` è un repository di artefatti RDF (versione corrente + storico).
- `zsh-plugin/` contiene lo script, tipicamente “attivato” tramite `source` o installazione manuale nel proprio ambiente ZSH.

---

### Convenzioni di directory e responsabilità

Per evitare ambiguità tra “codice” e “infrastruttura”, la repository adotta una separazione pratica basata su cartelle:
#### `engine/` come boundary del runtime containerizzato

Dentro `engine/` convivono:

- **Infrastruttura** (container terzi) e config:
    - `nginx/nginx.conf` → reverse proxy + websocket upgrade + route speciali (es. upload PCAP con body size maggiore)
    - `graphdb/ontology.rdf` e `graphdb/repository.ttl` → materiali di inizializzazione GraphDB
        
- **Orchestrazione**:
    - `docker-compose.yml` → definizione servizi, reti, healthcheck, volumi persistenti
        
- **Codice custom**:
    - `nodejs/` → API server + worker + Dockerfile + `.env`
    - `nodejs-dashboard/` → dashboard React/Vite

Tale organizzazione comunica una cosa importante: **Redis, GraphDB e Nginx non sono “moduli implementati”**, ma **dipendenze di runtime**; ciò che è white-box puro risiede principalmente in `nodejs/` e nei client (`nodejs-dashboard/`, `extension/`, `zsh-plugin/`).
#### Persistenza e volumi

Il Compose definisce volumi nominati:
- `redis_data` (persistenza AOF Redis)
- `graphdb_data` (home GraphDB)

Questo rende la persistenza una responsabilità “di infrastruttura” e non del codice applicativo.
#### Inizializzazione GraphDB come step esplicito

La presenza di **`graphdb-init`** formalizza un pattern importante:
- la repository GraphDB (`ontowebpt`) viene creata se mancante;
- l’ontologia viene importata solo se non già presente (ASK query su `owl:Ontology`).

Questa scelta riduce interventi manuali e rende riproducibile l’ambiente.

---

### Gestione configurazione ed environment variables

La configurazione è guidata principalmente da file `.env` e da override in Docker Compose. È utile distinguere tra:

#### Configurazione Node.js (API + Worker)

Entrambi usano lo stesso file:

- **`engine/nodejs/.env`**  
    Contiene:
    - logging (`LOG_FORMAT`, `LOG_LEVEL`, `LOG_COALESCE_WINDOW_MS`)
    - server (`SERVER_HOST`, `SERVER_PORT`, `SOCKETS_CORS_ORIGIN`)
    - GraphDB (`GRAPHDB_BASE`, `GRAPHDB_REPO`, `GRAPHDB_HEALTH_INTERVAL_MS`)
    - Redis (`REDIS_HOST`, `REDIS_PORT`, `QUIET_REDIS_ERRORS`)
    - code/job config (nomi code BullMQ, tentativi, backoff, retention)
    - concorrenze worker
    - namespace/IRI ontologia e grafi
    - chiavi esterne (es. `NVD_API_KEY`)

Nel Compose, alcune variabili vengono **sovrascritte** per il contesto container:
- `GRAPHDB_BASE=http://graphdb:7200` (URL interno alla rete Docker)
- `REDIS_HOST=redis`
- `SERVER_HOST=0.0.0.0` per esporre il server nel container
- `LOGS_WS_URL` per il worker, puntato al servizio `node-api` nella rete Docker

Questo produce un comportamento coerente:
- in locale “non docker” puoi usare `localhost`,
- in docker le dipendenze si risolvono via hostname di servizio (`redis`, `graphdb`, `node-api`).
#### Configurazione Dashboard (Vite)

La dashboard usa:

- **`engine/nodejs-dashboard/.env`** con variabili `VITE_*`:
    - `VITE_API_BASE_URL` (base URL per REST)
    - `VITE_LOGS_WS_URL` e `VITE_LOGS_WS_URL_LOGS` (socket.io / namespace logs)

Qui è importante ricordare la regola Vite: le variabili `VITE_*` sono tipicamente **iniettate a build-time**, quindi cambiare `.env` può richiedere rebuild della dashboard (a seconda del workflow di deployment).
#### Configurazione Nginx

- **`engine/nginx/nginx.conf`** è montato in sola lettura nel container.
- Nginx è configurato come reverse proxy verso `node-api` (raggiunto come `host.docker.internal:8081`), e gestisce:
    - route `/health` con timeout breve,
    - route dedicata al grande upload PCAP (`/pcap/pcap-http-requests`) con `client_max_body_size` elevato,
    - upgrade WebSocket (`Upgrade` / `Connection`) per supportare socket.io.
#### Principio pratico adottato nel progetto

- **Un `.env` condiviso** per API e worker (coerenza, meno duplicazione).
- **Override in Compose** per differenziare runtime interno ai container vs esecuzione locale.
- **`.env` separato per i client** (Dashboard) con prefisso `VITE_` e variabili mirate a networking/endpoint.

---