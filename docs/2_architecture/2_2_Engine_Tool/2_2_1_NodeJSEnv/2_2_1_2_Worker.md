# Worker

---

Il worker Node.js (`node-worker`) è il componente di elaborazione asincrona dell’Engine/Tool. Non espone interfacce HTTP verso l’esterno, ma lavora “dietro le quinte” consumando job dalle code BullMQ su Redis, eseguendo le analisi e gli aggiornamenti sull’ontologia OntoWeb-PT in GraphDB e restituendo risultati strutturati tramite BullMQ. È pensato come processo stateless e scalabile orizzontalmente: più istanze possono lavorare sulle stesse code in parallelo.

---

## Responsabilità

- Consumare i job accodati dall’API:
  
  - HTTP ingestion (`http-ingest`) e analisi HTTP (`http-resolver`)
  
  - SPARQL UPDATE generici (`sparql-update`)
  
  - analisi Techstack (`techstack-analyze`)
  
  - analisi Analyzer / SAST (`sast-analyze`)

- Interagire con GraphDB:
  
  - eseguire SPARQL UPDATE per inserire/aggiornare richieste HTTP, entità correlate e finding
  
  - eseguire SPARQL SELECT per eventuali sonde e controlli

- Applicare i resolver di dominio:
  
  - normalizzazione delle richieste HTTP e analisi dei flussi per trovare vulnerabilità (HttpScan)
  
  - risoluzione del tech stack (header, cookie, tecnologie, WAF → TechstackScan)
  
  - analisi statica di HTML/JS/DOM (AnalyzerScan)

- Gestire la resilienza dei job:
  
  - retry con backoff, gestione job “stalled”, logging strutturato degli esiti

- Inoltrare i log in tempo reale all’API:
  
  - connessione come client Socket.IO verso `/logs` esposto dall’API
  
  - forwarding di tutti i log del worker alla dashboard tramite l’API

---

## Tecnologie e librerie principali

- Node.js (CommonJS) come runtime.

- BullMQ (`Worker`) per la gestione delle code:
  
  - un worker dedicato per ciascuna coda logica (HTTP, SPARQL, Techstack, Analyzer)
  
  - configurazioni di concurrency e intervallo di rilevamento job bloccati.

- ioredis tramite la configurazione condivisa `connection` per la connessione a Redis.

- socket.io-client per collegarsi al namespace `/logs` dell’API e inviare log in tempo reale.

- Moduli applicativi incapsulati in `utils`:
  
  - `graphdb.runUpdate` / `graphdb.runSelect` per parlare con GraphDB via SPARQL
  
  - `httpBuilders` e `findingBuilders` per generare SPARQL UPDATE in base ai dati di dominio
  
  - `resolvers.techstack`, `resolvers.analyzer`, `resolvers.http` per implementare la logica di analisi
  
  - `monitors.startRedisMonitor` e `startGraphDBHealthProbe` per il health-check lato worker
  
  - `makeLogger` e `onLog` per logging strutturato e forwarding.

- dotenv per la configurazione via variabili d’ambiente (.env condiviso con l’API).

---

## Interfacce esposte

Il worker non espone endpoint HTTP o WebSocket verso l’esterno. Le sue “interfacce” sono:

- Code BullMQ su Redis (ingresso/uscita):
  
  - coda HTTP (`queueNameHttpRequestsWrites`)
    
    - job in ingresso:
      
      - `http-ingest`: inserimento richieste HTTP in GraphDB
      
      - `http-resolver`: analisi HTTP e generazione finding
  
  - coda SPARQL (`queueNameSparqlWrites`)
    
    - job in ingresso:
      
      - `sparql-update`: esecuzione di SPARQL UPDATE generici
  
  - coda Techstack (`queueNameTechstackWrites`)
    
    - job in ingresso:
      
      - `techstack-analyze`: analisi tech stack e generazione finding
  
  - coda Analyzer (`queueNameAnalyzerWrites`)
    
    - job in ingresso:
      
      - `sast-analyze`: analisi statica HTML/JS/DOM e generazione finding
  
  - per ogni job il worker produce un `returnvalue` strutturato che può essere letto dall’API via BullMQ.

- GraphDB:
  
  - interfaccia SPARQL HTTP (UPDATE e, per i monitor, SELECT).

- WebSocket verso l’API:
  
  - connessione client `socket.io` verso `LOGS_WS_URL` (namespace `/logs`), usata esclusivamente per inviare log all’API.

---

## Flussi di dati

HTTP ingestion (`http-ingest`)

- Input:
  
  - job su coda HTTP con `payload` contenente una o più richieste HTTP normalizzabili.

- Passi principali:
  
  - normalizzazione del payload in una lista omogenea di record HTTP (metodo, URI, header, body, ecc.);
  
  - costruzione di una SPARQL UPDATE:
    
    - singola richiesta → `buildInsertFromHttpRequest`
    
    - lista di richieste → `buildInsertFromHttpRequestsArray`
  
  - esecuzione della SPARQL UPDATE tramite `runUpdate`, che inserisce le risorse RDF corrispondenti (Request, Response, Headers, URI, ecc.) nel repository `ontowebpt`.

- Output:
  
  - risultato del job con stato dell’update, conteggio delle richieste inserite e payload originale.

HTTP resolver (`http-resolver`)

- Input:
  
  - job su coda HTTP con `list` di richieste HTTP già normalizzate.

- Passi principali:
  
  - invocazione del resolver HTTP (`analyzeHttpRequests`) che:
    
    - analizza pattern, header, parametri, status code, ecc.;
    
    - genera statistiche aggregate e una lista di finding (HttpScan) coerente con l’ontologia OntoWeb-PT.
  
  - arricchimento dei finding con metadati di origine (`source: 'http'` se mancante).
  
  - trasformazione dei finding in SPARQL UPDATE (`buildInsertFromFindingsArray`) e scrittura in GraphDB tramite `runUpdate`.

- Output:
  
  - risultato del job contenente:
    
    - esito dell’analisi (ok, totalFindings, stats)
    
    - esito dell’INSERT dei finding in GraphDB.

SPARQL UPDATE (`sparql-update`)

- Input:
  
  - job su coda SPARQL con `sparqlUpdate` contenente una UPDATE pronta da eseguire.

- Passi principali:
  
  - esecuzione diretta di `runUpdate` su GraphDB senza logica di dominio aggiuntiva.

- Output:
  
  - risultato con stato dell’update, usato dall’API per confermare l’esito su `/sparql/results/:jobId`.

Techstack analysis (`techstack-analyze`)

- Input:
  
  - job su coda Techstack con:
    
    - `technologies`, `waf`, `secureHeaders`, `cookies`, `mainDomain`.

- Passi principali:
  
  - invocazione del resolver tech stack (`resolveTechstack`) che:
    
    - interpreta le tecnologie rilevate, WAF, header di sicurezza, cookie;
    
    - produce una lista di finding (TechstackScan) e strutture riepilogative.
  
  - arricchimento dei finding con `source: 'techstack'` se non presente.
  
  - costruzione e esecuzione di una SPARQL UPDATE per inserire i finding in GraphDB.

- Output:
  
  - payload con risultati dell’analisi (conteggi per categoria) e stato dell’inserimento in GraphDB.

Analyzer / SAST (`sast-analyze`)

- Input:
  
  - job su coda Analyzer con:
    
    - `url`, `html`, `scripts`, `forms`, `iframes`, `includeSnippets`.

- Passi principali:
  
  - invocazione del resolver Analyzer (`resolveAnalyzer`) che:
    
    - esegue analisi statica su HTML e JavaScript,
    
    - correla contesto DOM, script, form, iframe,
    
    - genera finding di tipo AnalyzerScan secondo l’ontologia.
  
  - arricchimento dei finding con `source: 'analyzer'` se mancante.
  
  - inserimento dei finding in GraphDB via `buildInsertFromFindingsArray` + `runUpdate`.

- Output:
  
  - oggetto con:
    
    - `result` (ok, totalFindings, stats),
    
    - eventuale `insertStatus` dell’update SPARQL.

Monitoraggio e log

- Health monitor:
  
  - `startRedisMonitor` tiene sotto osservazione la connessione Redis del worker (loggando stati “up/down/connecting”).
  
  - `startGraphDBHealthProbe` esegue periodicamente query SELECT di prova su GraphDB, loggando eventuali problemi.
  
  - le sonde non alimentano direttamente l’endpoint `/health` (che è responsabilità dell’API), ma forniscono segnali utili nei log.

- Log forwarding:
  
  - ogni logger creato con `makeLogger` nel processo worker invia i propri eventi a un dispatcher globale (`onLog`);
  
  - il dispatcher inoltra i log sul WebSocket verso l’API (`LOGS_WS_URL`), che li ributta sul namespace `/logs` per la dashboard;
  
  - in caso di disconnessione, i log vengono semplicemente scartati (fail-safe, nessun blocco del processing).

---

## Dipendenze

- Redis:
  
  - necessario per BullMQ; i parametri di connessione (host, port, retryStrategy) sono condivisi con l’API.

- GraphDB:
  
  - repository `ontowebpt` inizializzato da `graphdb-init` e popolato con l’ontologia OntoWeb-PT;
  
  - richiesto per SPARQL SELECT/UPDATE eseguite dai worker.

- API Express:
  
  - non come dipendenza funzionale per i job, ma come endpoint WebSocket per la raccolta centralizzata dei log (/logs).

- Ambiente:
  
  - variabili di configurazione per code, policy di retry/backoff, livelli di concurrency, URL GraphDB, URL logs, ecc.  
    (es. `GRAPHDB_BASE`, `REDIS_HOST`, `CONCURRENCY_WORKER_*`, `STALLED_INTERVAL_WORKER_*`, `LOGS_WS_URL`).

Note di design

- **Separazione netta da API**  
  Il worker non accetta traffico HTTP: il suo unico canale di input/output “logico” sono le code BullMQ e le chiamate SPARQL. Riduce la superficie di attacco, semplifica il deployment e permette di scalare i processi di elaborazione in modo indipendente dall’API.

- **Idempotenza e retry** 
  I job sono pensati per poter essere ritentati senza effetti collaterali gravi (SPARQL UPDATE costruiti in modo da tollerare ripetizioni o da essere usati in contesti controllati). Le policy di retry/backoff sono configurabili via env, per adattarsi a diversi scenari operativi.

- **Specializzazione per dominio**  
  Ogni coda ha un worker dedicato con logger, concurrency e logica specifica (HTTP, SPARQL, Techstack, Analyzer). Ciò rende più semplice osservare e debuggare singole pipeline e, se necessario, scalare solo il tipo di worker più critico (es. Analyzer per analisi SAST pesanti).

- **Log centralizzati ma disaccoppiati**  
  L’uso di `onLog` + WebSocket verso l’API permette di avere un unico stream log per dashboard senza legare il worker a un particolare sistema di logging esterno. In assenza del WebSocket, il worker continua a funzionare normalmente, limitandosi al logging locale.

- **Configurazione orientata all’operatività**  
  Parametri come il numero di worker per coda, i limiti per job “stalled”, la verbosità degli errori Redis (`QUIET_REDIS_ERRORS`) sono esposti via variabili d’ambiente. Questo consente di calibrare il comportamento del worker in base all’ambiente (sviluppo, test, produzione) senza modificare il codice.

---
