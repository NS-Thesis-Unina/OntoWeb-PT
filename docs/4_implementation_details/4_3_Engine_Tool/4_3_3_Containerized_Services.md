# Servizi infrastrutturali containerizzati
---

- [Nginx](./4_3_3_Containerized_Services/4_3_3_1_Nginx.md)
- [Redis](./4_3_3_Containerized_Services/4_3_3_2_Redis.md)
- [GraphDB](./4_3_3_Containerized_Services/4_3_3_3_GraphDB.md)

---

Accanto ai componenti applicativi dell’Engine/Tool (Node API e Node Worker), l’architettura include alcuni **servizi infrastrutturali eseguiti come container** tramite `docker-compose`. Questi servizi non implementano logica di business “white-box”, ma forniscono funzionalità di piattaforma fondamentali per il corretto funzionamento del sistema: **routing e reverse proxy**, **coda/stato dei job**, **triple store RDF** e **bootstrap automatico del repository ontologico**.

Dal punto di vista operativo, il file `docker-compose.yml` definisce due reti logiche:
- **frontend**: rete esposta verso l’esterno, utilizzata dal reverse proxy.
- **backend**: rete interna utilizzata dai componenti server-side per comunicare con Redis e GraphDB.

Sono inoltre definiti volumi persistenti per garantire durabilità dei dati:
- `redis_data` per Redis (AOF abilitato),
- `graphdb_data` per GraphDB (home/storage del repository).

---

## Componenti inclusi

Questa sezione descrive l’infrastruttura containerizzata che affianca l’applicazione Node.js:

1. **Nginx (Reverse Proxy)**
   - Punto di ingresso HTTP sulla porta **80**.
   - Inoltra le richieste verso l’API Node (upstream) e gestisce correttamente l’upgrade delle connessioni (utile per WebSocket e streaming).
   - Fornisce anche un endpoint di **health-check**.

2. **Redis (Job/State Backend)**
   - Database in-memory impiegato come infrastruttura di supporto al **job system** (coda e/o persistenza dello stato, in base alla logica del worker).
   - Configurato con **AOF (Append Only File)** per garantire persistenza in caso di riavvio del container.
   - Esposto sulla porta **6379**.

3. **GraphDB (Triple Store RDF)**
   - Database RDF utilizzato per memorizzare dati e risultati (e per interrogazioni SPARQL), coerentemente con l’ontologia del progetto.
   - Esposto sulla porta **7200**.
   - Configurato con opzioni JVM (`JAVA_OPTS=-Xms1g -Xmx2g`) e volume persistente.

> Nota: oltre ai tre servizi principali, nel `docker-compose.yml` è presente anche un container **graphdb-init** (basato su `curlimages/curl`) che svolge una funzione di *bootstrap*: attende la disponibilità di GraphDB, crea (se assente) il repository `ontowebpt` usando `repository.ttl` e importa l’ontologia da `ontology.rdf` se non già presente. Questo container non è un servizio “runtime” permanente ma un **job di inizializzazione** eseguito una sola volta.

---

## Integrazione con Node API e Worker

I container applicativi `node-api` e `node-worker` dipendono logicamente dai servizi `redis` e `graphdb` e ricevono la configurazione tramite variabili d’ambiente (es. `REDIS_HOST=redis`, `GRAPHDB_BASE=http://graphdb:7200`). In questo modo:
- Redis e GraphDB restano raggiungibili **solo** sulla rete `backend`,
- Nginx espone verso l’esterno unicamente l’interfaccia HTTP pubblica e inoltra verso l’API.

---