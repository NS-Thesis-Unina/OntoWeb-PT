# Worker / Job System
---

- [Queue and Job Lifecycle](./4_3_2_Worker_Job_System/4_3_2_1_Queue_And_Job_Lifecycle.md)
- [Job Types](./4_3_2_Worker_Job_System/4_3_2_2_Job_Types.md)
- [Job State Persistence](./4_3_2_Worker_Job_System/4_3_2_3_Job_State_Persistence.md)
- [WebSocket Job Events and Observability](./4_3_2_Worker_Job_System/4_3_2_4_WebSocket_Job_Events.md)
- [Utils Functions](./4_3_2_Worker_Job_System/4_3_2_5_Utils_Functions.md)
- [Resolvers Overview](./4_3_2_Worker_Job_System/4_3_2_6_Resolvers_Overview.md)

---

Questa sezione descrive l’**implementazione del sistema di Worker** del Tool (Engine/Tool), responsabile dell’esecuzione asincrona dei job creati dall’API Server.

Il Worker:
- consuma job da **code Redis (BullMQ)**,
- esegue elaborazioni **CPU/IO intensive** (ingestion, analisi, risoluzione),
- persiste risultati e stati intermedi,
- pubblica eventi di avanzamento e completamento osservabili dal client tramite **WebSocket**.

L’obiettivo è separare chiaramente:
- il **piano di controllo** (API Server: validazione, enqueue, osservabilità),
- dal **piano di esecuzione** (Worker: elaborazione effettiva dei dati).

---

## Ruolo architetturale

Il **Worker** non espone endpoint HTTP pubblici e non gestisce direttamente richieste client.

Le sue responsabilità principali sono:

1. **Esecuzione dei job**  
   Prelevare job dalle code Redis e processarli secondo la logica associata al tipo di job.

2. **Gestione del lifecycle**  
   Aggiornare correttamente lo stato del job (`waiting`, `active`, `completed`, `failed`) e i progressi intermedi.

3. **Persistenza degli effetti**  
   Scrivere i risultati su:
   - GraphDB (triple RDF, findings),
   - storage ausiliari (filesystem temporaneo, Redis metadata).

4. **Osservabilità**  
   Pubblicare eventi e log strutturati per permettere:
   - aggiornamenti real-time lato Dashboard,
   - diagnosi in caso di errore o degrado del sistema.

Il Worker è quindi un **componente stateless a runtime**, con stato persistente delegato a Redis e GraphDB.

---

## Relazione con l’API Server

Il flusso tipico è il seguente:

1. **API Server**
   - valida il payload,
   - crea uno o più job (`queue.add()`),
   - restituisce immediatamente `accepted + jobId` al client.

2. **Worker**
   - intercetta il job dalla coda,
   - esegue la logica associata,
   - aggiorna progressi e stato,
   - persiste i risultati.

3. **API Server / WebSocket**
   - riceve eventi dai job (via BullMQ `QueueEvents`),
   - inoltra gli eventi ai client connessi.

In nessun caso il client comunica direttamente con il Worker.

---

## Pattern generali adottati

### Elaborazione asincrona e resiliente

- Tutte le operazioni “pesanti” sono **job-based**.
- I job sono:
  - ri-eseguibili (retry),
  - isolati per tipo,
  - tracciabili singolarmente tramite `jobId`.

### Isolamento per dominio

Ogni dominio funzionale ha:
- una **coda dedicata** (es. HTTP, Analyzer, Techstack),
- un **processor** specifico,
- payload e logica coerenti con il dominio.

Questo riduce coupling e facilita il debugging.

### Best-effort real-time

- Gli eventi WebSocket sono **informativi**, non transazionali.
- Lo stato “source of truth” rimane in Redis (BullMQ).
- Il client combina:
  - eventi live (WebSocket),
  - polling REST come fallback.

---

## Ambito delle sottosezioni

Le sottosezioni seguenti descrivono nel dettaglio:

- **Queue e lifecycle dei job**  
  Come sono definite le code, quali stati attraversa un job e come vengono gestiti retry e failure.

- **Tipologie di job**  
  Quali job esistono (ingest, analyzer, resolver, ecc.), che responsabilità hanno e come sono separati.

- **Persistenza dello stato**  
  Dove vive lo stato del job (Redis/BullMQ), cosa viene persistito e cosa rimane volatile.

- **Eventi WebSocket**  
  Come i job producono eventi osservabili e come questi vengono propagati ai client.

---

## Limiti e non-obiettivi

- Il Worker **non espone API HTTP**.
- Il Worker **non gestisce autenticazione/autorizzazione**.
- Il Worker **non coordina lock globali** tra scansioni (questa logica è lato client/extension).
- La UI **non si basa esclusivamente** sugli eventi WS: il sistema è progettato per tollerare perdite di eventi.

---
