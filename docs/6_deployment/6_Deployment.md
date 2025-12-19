# Deployment
---

- [Prerequisites](./6_1_Prerequisites.md)
- [Quick Start Docker](./6_2_Quick_Start_Docker.md)
- [Backend Configuration](./6_3_Backend_Configuration.md)
- [Development Setup](./6_4_Development_Setup.md)
- [Dashboard Build and Environment](./6_5_Dashboard_Build_And_Env.md)
- [Workers, Queues and Observability](./6_6_Workers_Queues_And_Observability.md)
- [Hardware and Software Requirements](./6_7_Hardware_Software_Requirements.md)
- [Advanced Configuration](./6_8_Advanced_Configuration.md)
- [Extension Installation](./6_9_Extension_Installation.md)

---
Questa sezione descrive **come installare, configurare e avviare OntoWebPT** in modo riproducibile.  
Il progetto è pensato per essere eseguito principalmente tramite **Docker Compose**, con un flusso di setup **backend-first**:
1. configurazione e avvio dell’**Engine/Tool** (backend + servizi);
2. (opzionale) rebuild della **Dashboard** e integrazione degli `.env` client;
3. installazione della **Browser Extension** in modalità developer.

L’obiettivo è permettere:
- un avvio “quick start” con un singolo comando;
- una configurazione avanzata (code/worker, GraphDB, limiti upload, named graphs, CORS, logging);
- un setup di sviluppo in cui alcuni componenti possono essere eseguiti localmente.

---

## Componenti deployati

Il deployment standard avvia i seguenti componenti:

- **Redis**
    - persistence AOF abilitata;
    - usato come message broker per BullMQ (queue/job system) e, dove necessario, cache/stato.
- **GraphDB**
    - triple store semantico usato come persistence layer per dati e findings;
    - espone UI e endpoint SPARQL.
- **GraphDB Init (bootstrap container)**
    - crea (se non esiste) il repository `ontowebpt` usando `repository.ttl`;
    - importa (se non presente) l’ontologia da `ontology.rdf`;
    - esegue una procedura idempotente: se repo/ontology esistono, non reimporta.
- **Node API (Express)**
    - espone REST API e WebSocket gateway;
    - riceve richieste da Dashboard/Extension;
    - effettua operazioni sincrone (health, query, preview PCAP) e crea job per le pipeline asincrone.
- **Node Worker**
    - consuma job da Redis;
    - esegue resolver/pipeline (Techstack, Analyzer, HTTP ingestion/resolver);
    - persiste risultati su GraphDB;
    - emette log/eventi verso il canale WebSocket.
- **Nginx (reverse proxy)**
    - entrypoint HTTP del sistema su porta 80;
    - proxy verso `node-api` (REST + WebSocket);
    - gestisce buffering e limiti per upload (es. PCAP).
- **Dashboard (frontend)**
    - è precompilata e servita dal backend (static assets);
    - può essere rebuildata localmente e reinclusa nell’immagine `node-api`.

---

## Modalità operative

Questa sezione copre tre modalità principali:
1. **Quick Start (Docker Compose)**
    - esegue tutto in container;
    - è la modalità raccomandata per uso standard e demo.
2. **Development Setup (ibrido)**
    - servizi stateful (Redis/GraphDB) in Docker;
    - API e Worker opzionalmente eseguiti in locale per debug rapido.
3. **Custom Build / Rebuild Client**
    - rebuild della Dashboard con nuovi `.env` (`VITE_*`);
    - ricostruzione delle immagini backend per includere gli asset aggiornati.

---

## Ordine consigliato di configurazione

Per evitare mismatch tra endpoint, proxy e variabili d’ambiente, l’ordine raccomandato è:
1. **Configurare il backend** (prima di avviare):
    - `engine/nodejs/.env` (GraphDB/Redis/Queue/Worker/logging/named graphs);
    - eventuali override nel `docker-compose.yml`;
    - (opzionale) tuning `graphdb` (JVM) e `nginx` (body size/timeouts).
2. **Avviare l’engine**:
    - `docker compose up -d`.
3. **Configurare e/o rebuildare la Dashboard** (solo se necessario):
    - `engine/nodejs-dashboard/.env` (base URL e WebSocket URLs);
    - build e copia del contenuto `dist/` nel backend;
    - rebuild immagini Docker se erano già state costruite.
4. **Installare l’estensione** (Edge/Chrome/Firefox) e puntarla al tool (base URL).

---

## File e cartelle rilevanti

Durante il deployment si utilizzano principalmente:
- `engine/docker-compose.yml`
    - definisce servizi e network (backend/frontend).
- `engine/nodejs/.env`
    - configurazione runtime comune a `node-api` e `node-worker`.
- `engine/graphdb/repository.ttl`
    - configurazione repository GraphDB.
- `engine/graphdb/ontology.rdf`
    - ontologia importata nel repository.
- `engine/nginx/nginx.conf`
    - reverse proxy, routing e limiti upload.
- `engine/nodejs-dashboard/.env`
    - configurazioni Vite per API base URL e WebSocket.
- `dist/` (Extension)
    - build browser-specific della extension.

---