# Tool Status & Health Flow
---

Questo documento descrive il **flusso end-to-end di monitoraggio dello stato del tool** tramite la pagina Dashboard **Tool Status**, che fornisce una vista operativa aggregata su:
- raggiungibilità e stato dell’**API Server**;
- stato di **Redis** (health/connessione);
- stato di **GraphDB** (probe/connessione);
- stato di connettività **WebSocket** (root namespace);
- **streaming logs** real-time (namespace `/logs`) in un buffer scorrevole.

Il flusso combina:
- **Synchronous Flow (REST)** per polling periodico dell’endpoint `/health`;
- **Streaming Flow (WebSocket)** per:
    - osservare la connettività del canale WS (connect/disconnect),
    - ricevere un feed continuo di log strutturati (`log` events).

Non coinvolge code/job/worker in modo diretto (è un flusso di **controllo e osservabilità**).

---

![SD](../../../images/5_end_to_end_system_flows/5_3_Dashboard_Flows/5_3_3_Tool_Status_Flow/5_3_3_Tool_Status_Flow_SD.png)

---

## Status request (Client Action)

Il flusso viene avviato quando l’utente apre la pagina **Tool Status** nel Dashboard.

Dal punto di vista client-side (come da codice):
- viene avviato un **polling REST** su `/health` ogni **5s** (e ad ogni flip dello stato WebSocket);
- vengono aperte **due connessioni WebSocket**:
    1. **root namespace** (solo per stato `connected/disconnected`);
    2. **namespace `/logs`** per ricevere eventi `log`.

La pagina costruisce poi una vista aggregata:
- un badge “Tool Status” derivato da `deriveToolStatus(health)`;
- card per singoli componenti (API/Redis/GraphDB/WebSocket);
- pannello “Real-Time Logs” con tail delle ultime ~80 entry.

---

## Redis health (Ingress Layer → Persistence Layer)

Il polling REST segue il pattern sincrono:
`Dashboard → Nginx → API Server → (Redis / GraphDB probes) → API Server → Dashboard`

Nel payload `/health`, Redis viene tipicamente rappresentato come componente:
- `components.redis` = stato (ok/down, o stringhe equivalenti).

Responsabilità:
- **API Server**: eseguire un check leggero verso Redis (connessione/ping o operazione equivalente), senza introdurre carico eccessivo.
- **Dashboard**: mostrare lo stato nella `StatusCard` “Redis”.

Nota: Redis qui è interrogato come dipendenza di runtime (queue, caching, stato), non come “Processing Layer”.

---

## GraphDB probe (Ingress Layer → Persistence Layer)

All’interno dello stesso `/health`, l’API esegue un probe su GraphDB:
- `components.graphdb` = stato della connessione/probe.

Responsabilità:
- **API Server**: verificare la reachability di GraphDB (probe minimale) e serializzare l’esito.
- **Dashboard**: rendere visibile lo stato in una `StatusCard` dedicata.

Questo check è cruciale perché GraphDB è il principale storage persistente usato dai flussi di ingestion e di esplorazione.

---

## Worker heartbeat (Processing Layer – observability)

La pagina Tool Status non invoca direttamente worker o queue, ma può inferire indirettamente lo stato del processing attraverso:
- log in streaming (eventi provenienti da API/worker),
- eventuali campi aggregati nel payload `/health` (se presenti nel backend; in UI il codice attuale mostra `server/redis/graphdb`).

Concettualmente, un “worker heartbeat” può essere rappresentato come:
- presenza continua di log di worker nel feed,
- (opzionale) un probe lato API che segnali worker attivi/idle.

Nel flusso documentato, il segnale operativo principale verso UI è il **canale logs** (Streaming).

---

## WebSocket logs (Feedback Channel)

La pagina apre due socket distinti:

### Root namespace (connectivity)

Serve a mostrare lo stato “WebSocket: connected/disconnected”:
- su `connect` → `wsStatus = connected`
- su `disconnect` → `wsStatus = disconnected`

Questo stato viene anche usato come trigger per re-pollare `/health`, così da catturare transizioni.

### Namespace `/logs` (streaming)

Il socket `/logs` emette eventi `log` con entry strutturate, ad esempio:
- `ts` (timestamp),
- `level` (`info|warn|error|...`),
- `ns` (namespace/logger),
- `msg` (string o oggetto).

La UI mantiene un buffer compatto (ultimi ~80) per evitare crescita non controllata e rendere la vista leggibile.

Schema concettuale streaming:
`API Server / Worker → WebSocket (/logs) → Dashboard`

Questo canale soddisfa l’obiettivo di osservabilità end-to-end, perché rende visibili:
- errori di integrazione (GraphDB down, Redis down),
- progress o anomalie dei worker (se loggati),
- eventi operativi del backend.

---

## Inquadramento nella Flow Taxonomy

- **Synchronous Flow (REST)**: `/health` polled ogni 5s  
    `Dashboard → Nginx → API → (Redis/GraphDB) → API → Dashboard`
- **Streaming Flow (WebSocket)**: root + `/logs`  
    `API/Worker → WebSocket Gateway → Dashboard`

Non si tratta di un flusso asincrono “Queue + Worker” (nessun job viene creato), ma di un flusso di **controllo** e **telemetria**.

---