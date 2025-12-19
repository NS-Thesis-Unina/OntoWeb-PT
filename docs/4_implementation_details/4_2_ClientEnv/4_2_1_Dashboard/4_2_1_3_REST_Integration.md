# REST Integration
---

La dashboard comunica con l’Engine/Tool tramite **API REST** consumate con Axios. L’integrazione è costruita con un layer leggero composto da:
- un **client HTTP centralizzato** (`services/httpClient.js`);
- una serie di **service module** per dominio (`httpRequestsService`, `techstackService`, `analyzerService`, `sparqlService`, `pcapService`, `healthService`);
- gestione di **errori e feedback utente** lasciata alle pagine (snackbar/alert).

---

## Client HTTP centralizzato

`services/httpClient.js` definisce una singola istanza Axios con:
- **baseURL** ricavata da `import.meta.env.VITE_API_BASE_URL` (fallback: `http://localhost`);
- **timeout** fisso a 15s;
- **response interceptor** che non trasforma la risposta e propaga gli errori al chiamante (`Promise.reject(error)`).

---

## Organizzazione dei service module

I file sotto `services/` seguono lo stesso pattern:
- ogni funzione fa una singola chiamata `get/post`;
- ritorna direttamente `res.data`;
- i path parameter vengono protetti con `encodeURIComponent` dove serve (es. `/:jobId`, `/:id`);
- i filtri/paginazione passano via `params` (Axios querystring).

Esempi rilevanti:
- **Health**  
    `GET /health` tramite `healthService.getHealth()`; `deriveToolStatus()` produce uno stato UI (“tool_on / checking / tool_off”) a partire dal payload.
- **HTTP Requests**  
    `httpRequestsService` copre ingest (`POST /http-requests/ingest-http`), polling job (`GET /http-requests/results/:jobId`), list e detail (`GET /http-requests/list`, `GET /http-requests/:id`) e findings derivati (`/finding/...`).
- **Techstack / Analyzer**  
    Moduli paralleli: `analyze`, `results/:jobId`, `finding/list`, `finding/:id`.
- **SPARQL**  
    `sparqlService` invia query e update come `POST` con body `{ sparql }` / `{ sparqlUpdate }`.

---

## Paginazione e filtri: contratto lato client

### Modello offset/limit

Le liste lavorano in server-side pagination con parametri `offset` e `limit`. La pagina `HttpRequests` costruisce i parametri in modo deterministico:
- trimming dei valori stringa;
- esclusione dei campi vuoti;
- invio dei soli filtri attivi.

Lato UI, MUI DataGrid usa `page/pageSize`, quindi i componenti tabella convertono tra i due mondi:
- `page = floor(offset / limit)`
- `offset = page * pageSize`

Un risultato utile: il backend rimane indipendente dal componente UI, mentre la dashboard controlla esattamente i parametri inviati.

---

## Error handling lato pagina

Con l’interceptor “pass-through”, i punti di gestione errori sono principalmente:
- `try/catch/finally` nelle pagine e nei componenti “smart”;
- `enqueueSnackbar(...)` per segnalare errori operativi (fetch list, detail drawer, invio batch, ecc.);
- `Alert` persistente per errori che devono bloccare un flusso (wizard PCAP).

Esempi concreti:
- `HttpRequests.fetchRequests()` → snackbar “Error while executing the request.”
- `HttpRequestsDataGrid.fetchRequest()` → snackbar e chiusura drawer
- `TechstackFindings.fetchFindings()` → snackbar “Error while loading techstack findings.”
- `SendPcap` → `errorMessage` mostrato in alto (Alert) + scroll-to-top per visibilità

---

## Upload multipart e payload binari

### Estrazione da PCAP

`pcapService.extractHttpRequestsFromPcap(pcapFile, sslKeysFile)` usa:
- `FormData` con campi `pcap` e `sslkeys`;
- `Content-Type: multipart/form-data` (impostato esplicitamente);
- `POST /pcap/pcap-http-requests`.

Il flusso di `SendPcap` valida l’estensione dei file prima di inviare:
- `.pcap/.pcapng` per capture
- `.log/.txt` per TLS key log

---

## Ingestione di richieste HTTP: batching e limiti

La fase “send to ontology” costruisce payload JSON che possono diventare grandi. Per evitare request troppo pesanti, la dashboard usa `makeBatchPayloads(...)` che:
- normalizza e valida i dati (URL assoluti http/https, metodi ammessi, header name RFC-like, trimming e cap su lunghezze);
- gestisce i body come base64 e applica limiti sulla dimensione _decodificata_;
- splitta il dataset in batch rispettando un limite di byte (stimato con `TextEncoder`) con `maxBytes` e `safetyMargin`.

Nel wizard, ogni batch viene inviato con `httpRequestsService.ingestHttpRequests({ ...batch, activateResolver })`. Gli errori per singolo batch producono snackbar e log in console, senza interrompere automaticamente l’invio degli altri batch (scelta utile per non perdere tutto a fronte di un batch problematico).

---

## Polling risultati job via REST come fallback

Il wizard usa `GET /http-requests/results/:jobId` tramite `httpRequestsService.getHttpIngestResult(jobId)` anche come canale complementare ai WebSocket:
- polling ogni 3s mentre la finestra “Job Summaries” è aperta;
- creazione di eventi “sintetici” (`completed/failed/update`) a partire dallo `state` ricevuto;
- rimozione dei job completati/falliti dal set di subscription.

Dal punto di vista REST, l’aspetto importante è che il risultato del job viene trattato come fonte autorevole di stato quando il trasporto socket non basta o non è disponibile.

---

## Configurazione degli endpoint dal runtime

La dashboard risolve la destinazione delle API tramite env Vite:
- `VITE_API_BASE_URL` → base URL REST (usato da Axios)
- altri `VITE_*` vengono usati per WS/log (dettagli nel file WebSocket integration)

In ambiente dev tipico, il default `http://localhost` permette di far partire la dashboard anche senza `.env`, purché l’API sia raggiungibile in locale.

---