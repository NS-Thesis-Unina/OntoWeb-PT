# Send PCAP
---

### Scopo della pagina

La sezione **Send PCAP** implementa un flusso guidato (wizard) per:
- caricare un file **PCAP/PCAPNG** e un **TLS key log** (es. `sslkeys.log`);
- inviare i file al backend per **decrittare** ed **estrarre** le richieste HTTP;
- **pre-visualizzare** le richieste ricostruite;
- **selezionare** un sottoinsieme da ingerire nell’ontologia;
- inviare i dati in modo sicuro al backend, con possibilità di **attivare il resolver**;
- monitorare i **job BullMQ/Redis** tramite **WebSocket** (più fallback via polling) e mostrarne un riepilogo.

---

### Struttura UI e navigazione interna

L’interfaccia è costruita attorno a:

- **Titolo + pannello descrittivo** (MUI `Typography`, `Paper`, animazione `Zoom`).
- **Stepper verticale** (MUI `Stepper`, `Step`, `StepLabel`, `StepContent`) con **6 step**:
    1. Upload PCAP
    2. Upload SSL keys
    3. Estrazione richieste
    4. Preview estratti
    5. Selezione richieste
    6. Conferma + invio (opzione resolver + invio)
- **Area errori globale**: `Alert` dismissibile, resa evidente con scroll automatico verso l’alto quando compare un messaggio d’errore.
- **Dialog di riepilogo job** (MUI `Dialog`) che elenca stato e outcome dei job avviati.

La pagina rimane “self-contained”: gestisce l’intero workflow nello stesso route, senza passaggi a schermate dedicate.

---

### Stato applicativo e flusso di controllo

Lo stato è mantenuto localmente tramite `useState`, con alcune strutture di supporto:

**Stati principali**
- `activeStep`: indice dello step corrente.
- `pcapFile`, `sslKeysFile`: file caricati.
- `requests`: richieste estratte dal backend (preview).
- `selectedRequests`: subset selezionato per ingest.
- `loadingExtract`, `loadingSend`: flag di operazioni asincrone.
- `errorMessage`: messaggio d’errore globale.
- `checkingTool`: flag per health gate prima di avanzare.
- `activateResolver`: abilita l’avvio del resolver in ingest.
- `jobEvents`: stream eventi job (WS + polling).
- `openJobsDialog`: visibilità del dialog di riepilogo.

**Supporto a subscription**

- `subscribedJobIdsRef` (via `useRef(new Set())`): evita doppie sottoscrizioni e semplifica teardown.

**Dispatcher di avanzamento**

- `handleNext()`:
    - esegue prima un **controllo di health** (`checkToolBeforeContinue`);
    - allo step 2 invoca l’estrazione (`extractRequests`);
    - allo step 5 invoca l’ingest (`sendRequestsToOntology`);
    - altrimenti incrementa `activeStep`.
- `handleBack()` blocca il back durante operazioni in corso.

**Regole di abilitazione**  
`isContinueDisabled()` disabilita “Continue/Send” quando mancano prerequisiti (file non caricati, nessuna request estratta, nessuna selezione) o durante operazioni (`checkingTool`, `loadingExtract`, `loadingSend`).

---

### Integrazione REST

La pagina integra più endpoint tramite i servizi:

**Health gate**
- `healthService.getHealth()` + `healthService.deriveToolStatus()`  
    Se lo stato risulta `tool_off` (o la chiamata fallisce), la progressione viene interrotta con messaggio esplicito.

**Estrazione da PCAP**
- `pcapService.extractHttpRequestsFromPcap(pcapFile, sslKeysFile)`  
    Popola `requests` con l’array estratto; in caso di array vuoto viene segnalata l’assenza di richieste.

**Ingest verso ontologia**
- `httpRequestsService.ingestHttpRequests({...batch, activateResolver})`  
    L’invio non spedisce direttamente `requests`, ma prima normalizza e “impacchetta” i dati per evitare payload troppo grandi.

**Batching e normalizzazione payload**
- `mapPcapItemsToRawItems(selectedRequests)` converte la struttura derivata dal PCAP in un formato “raw” adatto alla trasformazione in payload API:
    - ricostruzione URL (`uri.full`),
    - conversione headers array → oggetto `name:value`,
    - conservazione body response (base64 se stringa).
- `makeBatchPayloads(rawItems, convertOpts, packOpts)`:
    - converte gli item nel formato atteso dal backend;
    - applica limiti su campi e body;
    - spezza in più batch rispettando una soglia (`maxBytes: 10MB` con `safetyMargin`).  
        In caso di item singolo oltre limite, viene sollevato errore con id dell’item coinvolto.

Feedback utente:
- `enqueueSnackbar(...)` per confermare accettazione backend e segnalare errori di invio batch.

---

### Integrazione WebSocket e fallback

Il monitoraggio job combina push e polling:

**Listener eventi**
- `socketService.onJobEvent(cb)` registra un handler che appende eventi in `jobEvents`.

**Sottoscrizione job**
- `subscribeJob(jobId)`:
    - idempotente grazie a `subscribedJobIdsRef.current`;
    - chiama `socketService.subscribeJob(id)`.

**Fallback polling**  
Quando `openJobsDialog` è attivo:
- intervallo ogni 3 secondi che invoca `httpRequestsService.getHttpIngestResult(jobId)`;
- genera eventi sintetici (`completed`, `failed`, `update`) e li aggiunge a `jobEvents`;
- rimuove job completati/falliti dall’insieme.

**Teardown**  
Alla chiusura del dialog:
- `socketService.unsubscribeJob(id)` su tutti gli id ancora registrati;
- reset completo del wizard (step a 0, stato pulito, selezioni azzerate).

---

### Componenti UI riusabili e pattern

La pagina riutilizza pattern già presenti nel resto della dashboard:

**Drawer per dettaglio richiesta**
- `PcapRequestsDataGrid` e `PcapRequestsDataGridSelectable` aprono un pannello laterale tramite `DrawerWrapper`, mostrando:
    - header con chip metodo/status e URL copiabile,
    - sezione request (URI scomposta, query params, headers),
    - sezione response (status, headers, body copiabile).

**DataGrid**
- Preview: `PcapRequestsDataGrid` (read-only, paginazione client).
- Selezione: `PcapRequestsDataGridSelectable` (checkboxSelection).
    - usa un modello di selezione personalizzato `{ type: 'include'|'exclude', ids: Set }` e propaga i record selezionati con `onSelectionChange`.

---

### Convenzioni UI e styling

- Layout centrato con `max-width: 1200px` e padding coerente con altre pagine (`sendPcap.css`).
- Stepper contenuto in `sendPcap-content` con larghezza max `1100px`.
- Stati di caricamento:
    - estrazione: `CircularProgress` con testo “Extracting...”
    - invio: progress inline “Sending selected requests...”
    - dialog job: spinner fino a disponibilità riepiloghi
- Messaggi di errore: `Alert` `variant="filled"` con dismiss e scroll-to-top automatico.
- Testi esplicativi brevi in ogni step tramite `step.description`.

---

### Note implementative rilevanti

- Validazione file basata su estensione (`.pcap/.pcapng`, `.log/.txt`) tramite `hasValidExtension`.
- Blocco navigazione back durante operazioni asincrone per evitare stati incoerenti.
- Dialog job non chiude il workflow automaticamente: la chiusura esegue un reset e riparte dallo step iniziale.
- La stringa del graph di destinazione è letta da env (`VITE_CONNECT_HTTP_REQUESTS_NAME_GRAPH`) con fallback locale.

---