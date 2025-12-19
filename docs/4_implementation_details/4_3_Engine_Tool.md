# Engine / Tool
---

- [API Server](./4_3_Engine_Tool/4_3_1_Api_Server.md)
- [Worker / Job System](./4_3_Engine_Tool/4_3_2_Worker_Job_System.md)
- [Containerized_Services](./4_3_Engine_Tool/4_3_3_Containerized_Services.md)
- [General Configurazion and Environment](./4_3_Engine_Tool/4_3_4_General_Configuration_Environment.md)

---

La sezione **Engine / Tool** descrive il cuore operativo di OntoWeb-PT: l’insieme di componenti backend responsabili dell’elaborazione dei dati, dell’esecuzione dei job asincroni, dell’interazione con i servizi infrastrutturali (Redis, GraphDB) e dell’esposizione delle API verso i client.

L’obiettivo di questo capitolo è fornire una visione **implementativa e architetturale** di come il sistema lavora internamente, distinguendo chiaramente:
- ciò che viene gestito sincronicamente via API;
- ciò che viene delegato a worker e job asincroni;
- i confini tra codice custom e servizi esterni;
- i punti di integrazione con dashboard, extension e plugin CLI.

Il capitolo non replica la documentazione OpenAPI né i file di configurazione container: si concentra invece sui **code path**, sui **flussi di esecuzione** e sulle **responsabilità dei moduli**.

---

## Visione d’insieme

L’Engine è strutturato come un sistema **API + Worker**, con separazione netta tra:
- **API Server**: gestione richieste client, validazione, orchestrazione iniziale, esposizione endpoint REST e WebSocket;
- **Worker / Job System**: esecuzione di operazioni lunghe o intensive (analisi, ingestione, resolver);
- **Moduli di dominio**: parsing, normalizzazione, mapping ontologico, accesso a GraphDB;
- **Servizi di supporto**: Redis per code e stato job, WebSocket per eventi, GraphDB per persistenza semantica.

Questa separazione consente:
- scalabilità dei job senza bloccare l’API;
- isolamento dei failure (job falliti non impattano il server HTTP);
- osservabilità tramite eventi e log real-time.

---

## Relazione con i Client

Dal punto di vista dei client (Dashboard, Extension, ZSH Plugin), il Tool si presenta come:
- **un insieme di endpoint REST** per inviare dati, interrogare stato e recuperare risultati;
- **uno o più namespace WebSocket** per:
    - aggiornamenti di stato (health, job lifecycle);
    - stream di eventi (log, job progress).

I client **non interagiscono mai direttamente con i worker**: ogni richiesta passa dall’API Server, che decide se:
- rispondere immediatamente (operazione sincrona);
- creare un job asincrono e restituire un identificativo.

---

## Responsabilità principali del Tool

A livello funzionale, l’Engine copre quattro macro-aree:
1. **Ingestione dati**
    - ricezione di richieste HTTP, PCAP, snapshot TechStack;
    - validazione e normalizzazione dei payload;
    - preparazione per la persistenza ontologica.
2. **Analisi e resolver**
    - esecuzione di resolver (HTTP, TechStack, Analyzer);
    - correlazione con ontologia;
    - generazione di findings e relazioni.
3. **Persistenza semantica**
    - scrittura e aggiornamento delle triple in GraphDB;
    - gestione namespace e IRI coerenti;
    - supporto a query operative via SPARQL.
4. **Osservabilità e stato**
    - tracciamento lifecycle dei job;
    - health check dei componenti;
    - emissione di eventi e log verso i client.

---

## Sincrono vs Asincrono

Una distinzione chiave dell’Engine è tra **operazioni sincrone** e **asincrone**.

### Operazioni sincrone

- Health check (`/health`);
- Validazioni leggere;
- Query di stato o recupero risultati già disponibili.

Queste richieste vengono gestite interamente dall’API Server e rispondono immediatamente.

### Operazioni asincrone

- Analisi TechStack e Analyzer;
- Ingestione massiva (PCAP, batch);
- Resolver ontologici;
- Job che coinvolgono GraphDB o pipeline complesse.

In questi casi:
1. l’API crea un job;
2. il job viene messo in coda (Redis);
3. il worker lo esegue;
4. eventi e stato vengono notificati via WebSocket;
5. il risultato finale può essere recuperato via REST.

---

## Confini “custom” vs “third-party”

All’interno del Tool convivono componenti **custom** e servizi **third-party**:

- **Custom**
    - API server (routing, controller, orchestrazione);
    - worker logic e pipeline job;
    - mapping ontologico e SPARQL builder;
    - integrazione semantica applicativa.
- **Third-party / as-is**
    - Redis (queue, stato job);
    - GraphDB (triple store);
    - Nginx (reverse proxy, WebSocket upgrade);
    - BullMQ (o libreria equivalente) per gestione code.

Questa distinzione viene mantenuta anche a livello di documentazione, per chiarire dove risiede la logica di progetto e dove si utilizzano strumenti standard.

---

## Collegamenti ai sottocapitoli

I dettagli implementativi sono approfonditi nei capitoli successivi:

- **4.3.1 API Server**  
    Struttura del server, controller, middleware, error handling e health endpoint.
- **4.3.2 Worker / Job System**  
    Modello dei job, code, lifecycle, eventi WebSocket e persistenza dello stato.
- **4.3.3 Moduli di dominio core**  
    Parsing HTTP, ingestione ontologica, SPARQL, GraphDB writer e utility condivise.
- **4.3.4 Configurazione e variabili d’ambiente**  
    Config runtime, grouping delle env var, default e validazione.

---