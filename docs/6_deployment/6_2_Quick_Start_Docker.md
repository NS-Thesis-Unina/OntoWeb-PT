# Quick Start Docker
---

Questo documento descrive il **percorso “happy path”** per avviare l’intero sistema (Redis, GraphDB, init repository + ontologia, API, Worker e Nginx) **con un solo comando** tramite Docker Compose.

> Obiettivo: avere il tool operativo in pochi minuti, pronto per Dashboard/Extension.

---

## 1) Avvio completo in un comando

Dalla cartella dove si trova il tuo `docker-compose.yml`:
`docker compose up -d`

Questo comando:
- scarica le immagini necessarie (se mancanti),
- builda le immagini Node (API/Worker) se richiesto,
- avvia tutti i container in background.

---

## 2) Verifiche rapide dopo l’avvio

### Health check API (via Nginx)

Verifica che l’API sia raggiungibile tramite Nginx:
`curl http://localhost/health`

Atteso:
- risposta HTTP **200**
- payload JSON con stato generale e componenti (server/redis/graphdb), a seconda dell’implementazione.

> Se `curl` fallisce nei primi secondi, attendi qualche istante: GraphDB potrebbe essere ancora in bootstrap e l’API potrebbe essere in fase di connessione.

---

### Verifica GraphDB UI

Apri l’interfaccia GraphDB:
- `http://localhost:7200`
Atteso:
- GraphDB UI accessibile dal browser;
- repository `ontowebpt` presente (dopo init).

---

## 3) Cosa succede al primo avvio

Al primo `docker compose up -d`, avviene tipicamente questa sequenza:
1. **GraphDB** avvia il servizio sul container `graphdb` e pubblica la UI su `:7200`.
2. **graphdb-init** (container one-shot):
    - attende che GraphDB risponda su `/rest/repositories`;
    - verifica se esiste il repository **`ontowebpt`**;
    - se non esiste, lo crea usando `repository.ttl`;
    - verifica se l’ontologia è già presente;
    - se non presente, importa `ontology.rdf` nel repository.
3. **Redis** parte sul container `redis` (porta `6379`) e rende disponibili le code BullMQ.
4. **node-api**:
    - avvia l’Express server (porta `8081`);
    - si collega a Redis e GraphDB usando le variabili d’ambiente;
    - espone REST API + WebSocket (incluso namespace `/logs`).
5. **node-worker**:
    - avvia il worker BullMQ;
    - si collega a Redis e GraphDB;
    - rimane in ascolto sulle queue configurate, pronto a processare job.
6. **Nginx**:
    - espone la tool API su **`http://localhost/`** (porta `80`);
    - fa reverse proxy verso l’API (configurata tramite upstream).

---

## 4) Stop del sistema

Per fermare tutti i container senza perdere i dati:
`docker compose down`

Questo:
- ferma e rimuove i container,
- **mantiene** i volumi (`redis_data`, `graphdb_data`).

---

## 5) Reset completo (ATTENZIONE: distrugge i dati)

Per fermare tutto e cancellare anche i volumi (quindi repository GraphDB, dati Redis, ecc.):
`docker compose down -v`

**Attenzione**: questo comando elimina definitivamente:
- i dati persistiti in **GraphDB** (volumi),
- lo stato Redis (volumi),
- qualsiasi dato importato (HTTP requests, findings, ontologia già caricata, ecc.).

Dopo un reset con `-v`, il successivo `docker compose up -d` ripeterà l’intera inizializzazione (`graphdb-init` incluso).

---

## 6) Troubleshooting rapido

### Vedere lo stato dei container

`docker compose ps`

### Leggere i log (utile al primo boot)

`docker compose logs -f`

Oppure per un singolo servizio:

`docker compose logs -f graphdb docker compose logs -f graphdb-init docker compose logs -f node-api docker compose logs -f node-worker`

---