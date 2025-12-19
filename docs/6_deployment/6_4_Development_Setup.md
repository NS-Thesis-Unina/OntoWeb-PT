# Development Setup
---

Questo documento descrive come configurare l’ambiente di **sviluppo** distinguendolo chiaramente dalla modalità **produzione dockerizzata**.
L’obiettivo è permettere:
- iterazione rapida sul codice backend;
- debug semplificato;
- riuso dei dati (GraphDB / Redis) tra riavvii.

---

## Concetti chiave

- **Produzione** → tutto gira in Docker (`docker compose up -d`)
- **Sviluppo** → si separano **servizi infrastrutturali** e **codice applicativo**

In sviluppo conviene:
- mantenere **Redis e GraphDB in Docker** (persistenti);
- eseguire **API e Worker in locale** con Node.js;
- evitare rebuild continui delle immagini.

---

## Modalità A – Sviluppo consigliato (ibrido)

**Modalità consigliata per sviluppo attivo**
### Architettura

- Docker:
    - Redis
    - GraphDB
- Locale:
    - node-api
    - node-worker

Schema concettuale:

```
API (local)  ─┐               
			  ├─ Redis (Docker) 
Worker (local)┘               
			  └─ GraphDB (Docker)
```

---

### Step 1 – Avviare solo i servizi base

Dal root del progetto:

`docker compose up -d redis graphdb graphdb-init`

Verifiche rapide:
- GraphDB UI → [http://localhost:7200](http://localhost:7200)
- Repository `ontowebpt` presente
- Ontologia importata

---

### Step 2 – Configurare il `.env` per sviluppo

File:
`/engine/nodejs/.env`

Assicurarsi che punti ai servizi Docker:
```
REDIS_HOST=127.0.0.1 
GRAPHDB_BASE=http://localhost:7200 
SERVER_HOST=localhost 
SERVER_PORT=8081
```

---

### Step 3 – Avviare API e Worker in locale

Entrare nella cartella:

`cd engine/nodejs`

Avviare l’API:
`npm install npm run start:api`

In un secondo terminale, avviare il Worker:
`npm run start:worker`

---

### Vantaggi della Modalità A

- Hot reload / restart immediato;
- Debug diretto (Node inspector, breakpoints);
- Niente rebuild Docker ad ogni modifica;
- Redis e GraphDB **persistono i dati** tramite volume.

---

## Modalità B – Full Docker (produzione-like)

### Avvio completo

`docker compose up -d`

Tutti i componenti girano in container:
- redis
- graphdb
- graphdb-init
- node-api
- node-worker
- nginx

---

### Quando usarla

- test end-to-end;
- validazione pre-release;
- verifica configurazioni Docker/Nginx;
- riproduzione bug ambiente produzione.

---

### Svantaggi in sviluppo

- ogni modifica richiede rebuild immagini;
- ciclo di feedback più lento;
- debug meno immediato.

---

## Persistenza dati in sviluppo

### Perché è consigliata

- GraphDB e Redis usano **volumi Docker**:
    - `graphdb_data`
    - `redis_data`
- I dati sopravvivono a:
    - stop/start container;
    - restart API/Worker locali.

Attenzione solo a:
`docker compose down -v`

Questo comando **distrugge i dati persistenti**.

---

## Debug e Log

### Container Docker

Log dei servizi Docker:
`docker logs -f graphdb-init docker logs -f graphdb docker logs -f redis`

---

### API e Worker in Docker

(se Modalità B)
`docker logs -f node-api docker logs -f node-worker`

---

### API e Worker in locale

(se Modalità A)
I log sono visibili direttamente nel terminale:
- API:
    `npm run start:api`
- Worker:
    `npm run start:worker`
---

## Suggerimento pratico

**Workflow consigliato**
- sviluppo quotidiano → **Modalità A**
- test integrati / demo → **Modalità B**

---