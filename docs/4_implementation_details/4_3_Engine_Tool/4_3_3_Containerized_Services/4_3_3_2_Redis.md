# Redis
---

Redis è utilizzato come **servizio infrastrutturale di supporto al job system** dell’Engine/Tool. Non contiene logica applicativa custom, ma fornisce una **infrastruttura affidabile e a bassa latenza** per la gestione di code, stato dei job e coordinamento tra API Server e Worker.

Nel sistema Redis rappresenta il **punto di sincronizzazione** tra:
- **API Server** (enqueue dei job, interrogazione stato),
- **Node Worker** (esecuzione dei job, aggiornamenti di stato),
- **WebSocket Gateway** (propagazione eventi di avanzamento).

---

## 1) Definizione nel docker-compose

Il servizio Redis è definito come segue:

- **Image**: `redis:latest`
- **Container name**: `redis`
- **Command**: `redis-server --appendonly yes`
- **Port mapping**: `6379:6379`
- **Volume**: `redis_data:/data`
- **Restart policy**: `unless-stopped`
- **Healthcheck**:
  - test: `redis-cli ping`
  - interval: 5s, timeout: 3s, retries: 20
- **Network**: `backend`

Questa configurazione utilizza Redis **as-is**, senza moduli aggiuntivi o patch custom.

---

## 2) Ruolo architetturale

Nel contesto dell’Engine/Tool, Redis svolge le seguenti funzioni:

- **Backend per la coda dei job**
  - supporto alla creazione, scheduling e avanzamento dei job,
  - gestione di retry, fallimenti e job terminali.

- **Persistenza dello stato dei job**
  - stato corrente (`waiting`, `active`, `completed`, `failed`),
  - metadati (progress, timestamps, error reason).

- **Canale di coordinamento**
  - permette a più processi Node (API + Worker) di condividere stato e notifiche in modo consistente.

Redis non viene utilizzato come cache applicativa general-purpose, né come data store business.

---

## 3) Persistenza e durabilità

Redis è configurato con:
```bash
redis-server --appendonly yes
```
Questo abilita **Append Only File (AOF)**, garantendo che:
- i dati dei job sopravvivano al riavvio del container,
- la perdita di job in corso sia ridotta al minimo.

Il file AOF è salvato nel volume Docker:
`redis_data:/data`

In questo modo la persistenza è **indipendente dal ciclo di vita del container**.

---

## 4) Accesso e networking

- Redis è esposto sulla porta **6379**, ma viene usato **solo internamente**.
- I container `node-api` e `node-worker` lo raggiungono tramite:
    `REDIS_HOST=redis`
- Tutta la comunicazione avviene sulla rete Docker `backend`.

In un deployment production-grade, l’esposizione `6379:6379` può essere rimossa per evitare accessi diretti dall’host.

---

## 5) Convenzioni di keyspace

Le chiavi Redis sono generate dal **job system** (es. BullMQ o astrazione equivalente) e seguono convenzioni automatiche basate su:
- nome della coda,
- `jobId`,
- stato del job,
- strutture ausiliarie (lock, delayed, completed, failed).

Il progetto **non definisce manualmente key custom**, demandando la gestione del keyspace alla libreria di job utilizzata.  
Questo riduce il rischio di collisioni e semplifica manutenzione e upgrade.

---

## 6) Healthcheck e osservabilità

Il healthcheck:
`redis-cli ping`
viene usato dal Docker engine per:
- verificare che Redis risponda correttamente,
- ritardare (indirettamente) l’avvio operativo di API e Worker finché Redis non è disponibile.

A livello applicativo:
- se Redis non è raggiungibile, l’API Server segnala **tool degraded/off** nel `/health`,
- i job non vengono accettati (`accepted:false`).

---

## 7) Limiti e non-obiettivi

- Redis **non** è utilizzato come:
    - cache HTTP,
    - session store,
    - database applicativo.
- Redis **non** contiene dati di sicurezza o risultati finali:  
    questi vengono persistiti in **GraphDB**.

Redis è quindi un **componente transazionale e infrastrutturale**, critico per il runtime del sistema ma non per la conservazione a lungo termine della conoscenza.

---

## 8) Considerazioni operative

- La scelta di Redis come backend job è coerente con:
    - workload asincroni,
    - operazioni CPU-intensive delegate ai worker,
    - necessità di notifiche near-real-time.
- La configurazione attuale è adatta a:
    - ambienti di sviluppo,
    - deployment controllati,
    - carichi medi.

Per scenari ad alta disponibilità (HA), Redis potrebbe essere sostituito o esteso con:
- Redis Sentinel,
- Redis Cluster,
- servizi gestiti.

---