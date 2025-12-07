# API Express
---

L’API Express (container `node-api`) è il punto di ingresso applicativo dello stack OntoWeb-PT sul lato Engine/Tool. È il servizio che espone le API HTTP/REST e i WebSocket verso Nginx, serve la dashboard React e coordina tutti i flussi asincroni basati su Redis/BullMQ e GraphDB, senza eseguire direttamente analisi pesanti: quelle sono demandate al componente Worker.

---

## Responsabilità principali

L’API ha quattro responsabilità fondamentali:
- Esporre le API di dominio  
  - endpoint per ingestione e consultazione del traffico HTTP normalizzato 
  - endpoint per lanciare analisi Techstack, Analyzer (SAST/DOM/HTML) e HTTP resolver  
  - endpoint per interrogare e aggiornare il grafo via SPARQL (in modo controllato)  
  - endpoint per trasformare PCAP+SSL keys in richieste HTTP tramite lo script Python dedicato

- Orchestrare i job asincroni  
  - produce job sulle code BullMQ (HTTP, SPARQL, Techstack, Analyzer)  
  - restituisce lo stato e il risultato dei job (via REST e WebSocket)  
  - non esegue le analisi: si limita a creare job e interrogare le code

- Fornire interfacce realtime  
  - WebSocket per streaming log in tempo quasi reale (namespace `/logs`)  
  - WebSocket per eventi di job (completed/failed) per singolo `jobId` (namespace di default)

- Servire la dashboard  
  - espone il bundle statico React dalla directory `dashboard` interna all’immagine  
  - garantisce che tutte le rotte “front-end” (`/`, `/http`, `/analyzer`…) tornino sempre `index.html`

---

## Tecnologie e struttura interna

Il servizio è implementato in Node.js (CommonJS) e usa principalmente:
- Express come web framework HTTP.
- `cors` per abilitare CORS in modo generico (origini poi controllate a livello di reverse proxy).
- `express.json` con limite di payload a 15 MB per le API JSON.
- `celebrate` (basato su Joi) per validare body, parametri e query di ogni endpoint.
- `bullmq` e `ioredis` per gestire le code di job su Redis e la relativa connessione condivisa (`connection` in `queue.js`).
- `socket.io` per il server WebSocket (sia namespace di default che `/logs`).
- `multer` + `fs`/`os`/`child_process.spawn` per la gestione dell’upload PCAP e l’invocazione dello script Python `pcap_to_http_json.py`.

- Un modulo `utils` che fornisce:  
  - logger centralizzato (`makeLogger` + `onLog`)  
  - health monitor per Redis e GraphDB (`startRedisMonitor`, `startGraphDBHealthProbe`, `setState`, `getHealth`)  
  - wrapper GraphDB (`runSelect`) e builder SPARQL/DTO (httpBuilders, findingBuilders, validators, ecc.)

In fase di bootstrap, `server.js`:

- carica le variabili d’ambiente (`dotenv`);
- istanzia l’app Express, configura CORS e parsing JSON;
- registra le route modulari (`/sparql`, `/http-requests`, `/techstack`, `/analyzer`, `/pcap`);
- monta la dashboard static (`express.static(.../dashboard)` + catch-all `app.get('*', ...)`);
- registra il middleware di gestione errori di Celebrate;
- crea un HTTP server Node standard (`http.createServer(app)`);
- collega il server WebSocket tramite `attachSockets(server)` (modulo `sockets.js`);
- avvia gli health monitor verso Redis e GraphDB, aggiornando un registro interno;
- espone `/health` che restituisce uno snapshot di questo registro con HTTP 200/503.

---

## Interfacce esposte

L’API è raggiunta da Nginx sulla porta 8081 e espone segmenti logici di endpoint:

- Endpoint di salute:  
  - `GET /health`  
    Restituisce stato aggregato di server, Redis e GraphDB (ok / non ok, dettagli minimi). È utilizzato dal reverse proxy per i liveness/readiness check.

- Endpoint SPARQL (`/sparql`):  
  - `POST /sparql/query`  
    Esegue sincronicamente SELECT/ASK su GraphDB tramite `runSelect`, con validazione che impedisce UPDATE.  
  - `POST /sparql/update`  
    Enqueue di uno statement SPARQL UPDATE sotto forma di job `sparql-update` sulla coda dedicata; l’esecuzione avviene nel Worker.

- Endpoint HTTP requests (`/http-requests`):  
  - `POST /http-requests/ingest-http`  
    Ingestione di uno o più oggetti “HTTP request” in un formato normalizzato; crea un job `http-ingest` per la persistenza in GraphDB e, opzionalmente (`activateResolver`), un job `http-resolver` per l’analisi delle richieste.  
  - `GET /http-requests/results/:jobId`  
    Restituisce lo stato e l’eventuale risultato di un job BullMQ associato a HTTP. 
  - `GET /http-requests/list` e `GET /http-requests/:id`  
    Recuperano liste e dettagli di richieste HTTP da GraphDB tramite SPARQL SELECT + trasformazione in JSON.  
  - `GET /http-requests/finding/list` e `GET /http-requests/finding/:id`  
    Espongono le HttpScan findings generate dall’HTTP resolver, con vista paginata e dettaglio.

- Endpoint Techstack (`/techstack`):  
  - `POST /techstack/analyze`  
    Enqueue di un job `techstack-analyze` con informazioni su tecnologie, WAF, header, cookie, dominio principale.  
  - `GET /techstack/results/:jobId`  
    Stato/risultato del job di analisi techstack.  
  - `GET /techstack/finding/list` e `GET /techstack/finding/:id`  
    Lista paginata e dettaglio delle TechstackScan findings presenti nel grafo.

- Endpoint Analyzer (`/analyzer`):  
  - `POST /analyzer/analyze`  
    Enqueue di un job SAST/DOM/HTML (`sast-analyze`) con url, html, scripts, forms, iframes, opzione `includeSnippets`.  
  - `GET /analyzer/results/:jobId`  
    Stato e risultato del job.  
  - `GET /analyzer/finding/list` e `GET /analyzer/finding/:id`  
    Accesso a lista paginata e dettaglio delle AnalyzerScan findings.

- Endpoint PCAP (`/pcap`):  
  - `POST /pcap/pcap-http-requests`  
    Upload via `multipart/form-data` di `pcap` e `sslkeys`; salvataggio temporaneo dei file; invocazione dello script Python che usa TShark per estrarre richieste HTTP/HTTPS e produce un array JSON di richieste nel formato compatibile con `/http-requests/ingest-http`. L’API non inserisce direttamente questi dati in GraphDB: tipicamente la dashboard usa la risposta per decidere quali richieste inviare poi in ingestione.

- Servizio dashboard:  
  - `GET /static assets` (bundle JS/CSS, immagini) e `GET *`  
    Serviti dalla directory `dashboard` del container; ogni rotta non API viene risolta su `index.html` per supportare il router lato client.

- WebSocket (via `socket.io` in `sockets.js`):  
  - Namespace `/logs`:  
    - riceve eventi `log` da worker o altri client e li ribroadcast a tutti i subscriber;  
    - il processo API, tramite `onLog`, forwarda anche i propri log verso questo namespace, ottenendo uno stream unificato per la dashboard.  
  - Namespace di default `/`:  
    - gestisce `subscribe-job` / `unsubscribe-job` per iscriversi alle “stanze” `job:<jobId>`;  
    - riceve da `QueueEvents` di BullMQ gli eventi `completed` e `failed` dalle diverse code e li forwarda verso la stanza del job corrispondente.

---

## Flussi di dati

Dal punto di vista dei flussi, l’API si colloca al centro di più pipeline:

- Flusso di ingestione HTTP:
  1. Un client (estensione o dashboard) chiama `POST /http-requests/ingest-http` con una o più richieste normalizzate.
  2. L’endpoint valida il payload, normalizza il formato e crea un job `http-ingest` sulla coda BullMQ dedicata.
  3. Il Worker HTTP consuma il job, costruisce lo SPARQL UPDATE appropriato e inserisce le richieste in GraphDB.
  4. Se richiesto (`activateResolver`), viene anche creato un job `http-resolver` che analizza le stesse richieste e genera findings, a loro volta inserite in GraphDB.
  5. Lo stato e il risultato di entrambi i job sono consultabili via `GET /http-requests/results/:jobId` e via WebSocket (eventi `completed`/`failed` inviati alle stanze `job:<jobId>`).

- Flussi di analisi Techstack e Analyzer:  
  - `POST /techstack/analyze` e `POST /analyzer/analyze` delegano rispettivamente a `queueTechstack` e `queueAnalyzer`;  
  - i Worker corrispondenti eseguono le analisi, costruiscono SPARQL UPDATE con i finding, li inseriscono nel grafo;  
  - l’API espone sia lo stato dei job (endpoint `/results/:jobId`) sia viste di lettura aggregate sul grafo (`/finding/list` e `/finding/:id`), usando `runSelect` e funzioni di mapping.

- Flusso SPARQL diretto:  
  - le query di consultazione (`/sparql/query`) passano direttamente da API → GraphDB → API → client;  
  - le operazioni di update (`/sparql/update`) sono invece sempre serializzate come job asincroni, in modo da non bloccare il thread HTTP e sfruttare il retry/backoff configurato nel Worker SPARQL.

- Flusso PCAP:
  1. La dashboard invia PCAP e TLS keylog file a `POST /pcap/pcap-http-requests`.
  2. L’API salva entrambi in una directory temporanea e avvia lo script Python (che usa TShark, percorso configurabile via `TSHARK_BIN`).
  3. Lo script restituisce su stdout un array JSON di richieste HTTP normalizzate; l’API lo rimanda al client.
  4. Tipicamente la dashboard permette all’utente di selezionare un sottoinsieme di queste richieste e di re-invocare `/http-requests/ingest-http` per l’inserimento in GraphDB e l’eventuale analisi.

- Flussi di monitoraggio e salute:  
  - `startRedisMonitor` e `startGraphDBHealthProbe` vengono eseguiti all’avvio: interagiscono con Redis (via la stessa `connection` di BullMQ) e con GraphDB (via `runSelect`) per aggiornare un registro di health interno;  
  - `/health` legge questo registro (`getHealth`) e decide se restituire 200 o 503;  
  - Nginx usa questo endpoint nei propri healthcheck per stabilire se instradare o meno traffico verso l’istanza API.

- Flusso di log:  
  - tutti i log del processo API passano per `makeLogger`; `onLog` registra un listener globale che forwarda ogni entry al namespace `/logs` di Socket.IO;  
  - i Worker, tramite un client Socket.IO (`socket.io-client`) puntato a `LOGS_WS_URL`, inviano i propri log verso lo stesso namespace;  
  - la dashboard sottoscrive `/logs` e riceve uno stream unificato di log API + Worker, che può visualizzare in tempo reale.

---

## Dipendenze principali

Per funzionare correttamente, l’API dipende da:
- Redis:  
  - raggiungibile sull’host e porta configurati (`REDIS_HOST`, `REDIS_PORT`);  
  - usato da BullMQ per le code (`queueHttpRequests`, `queueSparql`, `queueTechstack`, `queueAnalyzer`) e dai monitor di salute;  
  - in caso di problemi di connessione, la retry strategy logga e tenta riconnessioni con backoff esponenziale; lo stato Redis influisce sull’output di `/health`.

- GraphDB:  
  - raggiungibile tramite `GRAPHDB_BASE` (tipicamente `http://graphdb:7200`);  
  - usato per tutte le operazioni di lettura SPARQL (`runSelect`) dalle route di lista/dettaglio e dalle sonde di health;  
  - se non disponibile, le route di lettura restituiscono 502, e `/health` segnala stato non sano.

- Worker BullMQ:  
  - processi separati (container `node-worker`) che consumano le code prodotte dall’API;  
  - se i Worker non sono in esecuzione, l’API continua a enqueuare job (rispondendo 202), ma i job resteranno in stato “waiting” e le analisi non produrranno dati in GraphDB.

- Ambiente Python/TShark interno all’immagine:  
  - per gli endpoint PCAP è richiesto che lo script `pcap_to_http_json.py` e il binario TShark (`TSHARK_BIN`, default `/usr/bin/tshark`) siano disponibili nel container;  
  - in caso di errore di esecuzione o parsing, l’API risponde con errore 500 specificando un messaggio diagnostico.

- Dashboard build:  
  - il bundle statico React deve essere presente nella directory `dashboard` del progetto Node.js al momento della build dell’immagine;  
  - se mancante o incompleto, il front-end non sarebbe servito correttamente, pur con API funzionanti.

---
