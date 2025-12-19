# Flow Taxonomy
---

Questo capitolo definisce la **tassonomia dei flussi operativi** utilizzati nella documentazione _End-to-End System Flows_.  
Il suo obiettivo è fornire un **vocabolario comune**, una **classificazione dei flussi** e una **struttura concettuale condivisa** per interpretare correttamente tutti i flussi descritti nelle sezioni successive.

---

## Tipi di flusso

I flussi end-to-end del sistema possono essere classificati in tre categorie principali, in base al modello di comunicazione e al ciclo di vita dell’operazione.

### Synchronous Flows (REST)

I **flussi sincroni** sono basati su un classico modello _request/response_ via HTTP REST.

Caratteristiche principali:
- il client invia una richiesta e attende una risposta immediata;
- non coinvolgono code o worker;
- sono tipicamente **read-heavy** o di **controllo**.

Esempi:
- interrogazione dei findings dal Dashboard;
- richiesta dello stato del sistema;
- fetch dei risultati di un’analisi già completata.

Tali flussi attraversano generalmente:
`Client → Nginx → API → (GraphDB / Redis) → API → Client`

---

### Asynchronous Flows (Queue + Worker)

I **flussi asincroni** sono utilizzati per operazioni:
- computazionalmente costose;
- potenzialmente lunghe;
- non compatibili con un ciclo sincrono HTTP.

Caratteristiche principali:
- la richiesta del client termina rapidamente con un _acknowledgment_;
- l’elaborazione avviene in background tramite job in coda;
- il risultato viene persistito e reso disponibile successivamente.

Esempi:
- analisi Techstack;
- analisi Analyzer (SAST);
- ingestione e analisi del traffico HTTP;
- parsing di PCAP.

Schema concettuale:
`Client → Nginx → API → Redis Queue → Worker → GraphDB`

---

### Streaming Flows (WebSocket)

I **flussi streaming** forniscono feedback continuo al client durante l’esecuzione di un’operazione asincrona.

Caratteristiche principali:
- comunicazione push dal backend al client;
- non sostituiscono REST, ma lo affiancano;
- migliorano osservabilità e user experience.

Esempi:
- eventi di avanzamento dei job;
- log di worker;
- stato live delle analisi.

Schema concettuale:
`Worker / API → WebSocket Gateway → Client`

---

## 5.1.2 Pattern architetturali ricorrenti

Indipendentemente dal caso d’uso specifico, la maggior parte dei flussi segue pattern architetturali ben definiti.

### Client → Nginx → API → Redis Queue

È il pattern di ingresso standard per i flussi asincroni.

Responsabilità:
- **Client**: invio dell’azione e del payload;
- **Nginx**: reverse proxy, buffering, routing;
- **API Server**: validazione, normalizzazione, job creation;
- **Redis Queue**: persistenza temporanea del lavoro da eseguire.

Questo pattern garantisce:
- disaccoppiamento tra ingresso e processing;
- resilienza ai picchi di carico;
- possibilità di retry controllati.

---

### Worker → GraphDB

Pattern di persistenza dei risultati.

Responsabilità:
- **Worker**: esecuzione del resolver e produzione dei risultati;
- **GraphDB**: storage semantico e correlabile delle informazioni.

Caratteristiche:
- write-heavy;
- operazioni idempotenti per quanto possibile;
- dati strutturati secondo l’ontologia.

---

### Worker → API → Dashboard (logs / events)

Pattern di feedback operativo.

Responsabilità:
- **Worker**: produzione di eventi e log;
- **API Server**: aggregazione e forwarding;
- **Dashboard / Extension**: visualizzazione in tempo reale.

Questo pattern è fondamentale per:
- osservabilità end-to-end;
- debugging;
- percezione di avanzamento da parte dell’utente.

---

## 5.1.3 Convenzioni terminologiche e layer

Per descrivere i flussi in modo coerente, ogni flusso viene articolato utilizzando una suddivisione concettuale in **layer**.

### Client Action

Rappresenta:
- l’azione iniziale dell’utente;
- il contesto di origine (Extension, Dashboard, ZSH Plugin).

Non include dettagli di UI, ma solo:
- _cosa_ viene avviato;
- _perché_.

---

### Ingress Layer

Comprende:
- Nginx;
- API Server.

Responsabilità:
- ricezione del traffico;
- validazione del payload;
- autenticazione (se applicabile);
- routing verso il layer successivo.

---

### Processing Layer

Comprende:
- Redis (queue);
- Worker.

Responsabilità:
- scheduling;
- esecuzione delle analisi;
- gestione retry e fallimenti;
- produzione dei risultati.

---

### Persistence Layer

Comprende:
- GraphDB;
- Redis (per stato temporaneo).

Responsabilità:
- memorizzazione duratura dei risultati;
- correlazione semantica;
- supporto alle query di esplorazione.

---

### Feedback Channel

Comprende:
- REST API;
- WebSocket.

Responsabilità:
- notifica dello stato;
- restituzione dei risultati;
- osservabilità del sistema.

---