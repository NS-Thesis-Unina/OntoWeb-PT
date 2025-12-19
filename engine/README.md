# OntoWeb-PT Engine / Tool

Questa cartella contiene l’**Engine / Tool** di **OntoWeb-PT**, ovvero il backend completo della piattaforma.

L’engine è responsabile di:
- esposizione delle **API REST** e **WebSocket**;
- gestione asincrona delle analisi tramite **job system**;
- persistenza semantica dei risultati su **GraphDB (RDF/OWL)**;
- orchestrazione dei servizi tramite **Docker Compose**;
- esposizione del servizio tramite **Nginx reverse proxy**;
- serving della **Dashboard Web**.

---

## High-level overview

L’engine è composto dai seguenti servizi principali:

- **node-api**
  - Server Express
  - API REST
  - WebSocket gateway
  - Health checks
  - Serving Dashboard

- **node-worker**
  - Esecuzione job asincroni
  - Resolver (Techstack, Analyzer, HTTP)
  - Persistenza su GraphDB
  - Emissione eventi e log

- **Redis**
  - Queue BullMQ
  - Stato temporaneo job
  - Coordinamento API ↔ Worker

- **GraphDB**
  - Repository RDF (`ontowebpt`)
  - Storage ontologico
  - Query SPARQL

- **Nginx**
  - Reverse proxy
  - Gestione upload PCAP
  - Ingresso unico HTTP

---

## Repository structure

```
engine/
├── docker-compose.yml # Orchestrazione completa dei servizi
├── graphdb/
│ ├── ontology.rdf # Ontologia OWL/RDF
│ └── repository.ttl # Configurazione repository GraphDB
├── nginx/
│ └── nginx.conf # Reverse proxy configuration
├── nodejs/
│ ├── Dockerfile # Build API + Worker
│ ├── .env # Configurazione backend
│ └── src/ # Codice API + Worker
└── nodejs-dashboard/
├── .env # Configurazione Dashboard (Vite)
└── src/ # Codice frontend Dashboard
```

---

## Quick start

Per avviare **tutto l’engine** (API, Worker, Redis, GraphDB, Nginx):

```bash
cd engine
docker compose up -d
```

### Verifica

- API health: http://localhost/health
- Dashboard: http://localhost/
- GraphDB UI: http://localhost:7200

---

## Primo avvio: cosa succede

Al primo `docker compose up`:
1. Redis e GraphDB vengono avviati
2. Il container `graphdb-init`:
   - verifica la disponibilità di GraphDB
   - crea il repository `ontowebpt` se non esiste
   - importa l’ontologia `ontology.rdf` se assente
3. `node-api` si collega a Redis e GraphDB
4. `node-worker` si registra sulle code BullMQ
5. Nginx espone l’ingresso HTTP su `http://localhost/`

Lo script di bootstrap di GraphDB è **idempotente**:
- se repository e ontologia esistono, non vengono ricreati.

---

## Configurazione

La configurazione principale del backend è centralizzata in:

`engine/nodejs/.env`


Qui è possibile configurare:
- logging
- porte e CORS
- GraphDB e Redis
- code, retry e backoff
- concorrenza worker
- URI dell’ontologia
- chiavi API esterne (es. NVD)

**Attenzione**  
Modificare le variabili prima del primo avvio, oppure ricostruire le immagini Docker dopo la modifica.

**Per una descrizione completa delle variabili**:  
[Deployment → Backend Configuration](../docs/6_deployment/6_3_Backend_Configuration.md)

---

## Dashboard

La Dashboard è:
- sviluppata in nodejs-dashboard/ (Vite)
- precompilata e servita direttamente da node-api

Se modifichi la dashboard:
1. aggiorna .env in nodejs-dashboard
2. esegui npm run build
3. copia dist/ nella cartella servita dall’API
4. ricostruisci le immagini Docker

---

## Logs & debugging

### Logs dei container
```bash
docker logs -f node-api
docker logs -f node-worker
docker logs -f graphdb-init
```

### Tool Status

La Dashboard espone una pagina dedicata che mostra:
- stato API
- stato Redis
- stato GraphDB
- stato WebSocket
- log in tempo reale via WebSocket

---

## Shutdown & reset

```bash
docker compose down
```

**Reset completo (distrugge i dati RDF e Redis):**
```bash
docker compose down -v
```

---

## Documentation

Per i dettagli architetturali e operativi completi:

- [Architecture](../docs/2_architecture/2_Architecture.md)
- [Implementation Details](../docs/4_implementation_details/4_Implementation_Details.md)
- [End-to-End Flows](../docs/5_end_to_end_system_flows/5_End_To_End_System_Flows.md)
- [Deployment & Setup](../docs/6_deployment/6_Deployment.md)

[Documentazione completa](./README.md)

---
