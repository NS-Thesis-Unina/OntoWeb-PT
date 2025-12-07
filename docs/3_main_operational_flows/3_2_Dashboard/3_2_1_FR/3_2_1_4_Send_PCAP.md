# Send PCAP – Requisiti Funzionali
---

**FR-DASH-PCAP-01 – Workflow guidato a step per l’invio di PCAP**

La pagina “Send PCAP” deve presentare all’utente un flusso guidato (stepper verticale) composto da 6 passi sequenziali:
1. **Upload PCAP file**
2. **Upload SSL keys file**
3. **Extract HTTP requests**
4. **Preview extracted requests**
5. **Select requests for ontology**
6. **Confirm and send**

Per ciascun passo, l’interfaccia deve:
- mostrare un titolo (label) e una breve descrizione testuale dello scopo dello step;
- visualizzare, all’interno del contenuto dello step, i controlli rilevanti (upload file, griglia di anteprima, checkbox, ecc.);
- evidenziare chiaramente quale step è attivo (activeStep) e consentire la navigazione solo tramite i pulsanti “Continue” e “Back” secondo le regole del flusso.

---

**FR-DASH-PCAP-02 – Caricamento file PCAP con validazione estensioni**

Nello step **“Upload PCAP file”** l’utente deve poter selezionare dal proprio filesystem un file di cattura di rete con estensione:
- `.pcap`
- `.pcapng`

I requisiti sono:
- il campo di input file deve accettare solo queste estensioni (attributo `accept=".pcap,.pcapng"`);
- se l’utente tenta di caricare un file con estensione non valida:
    - il file selezionato deve essere scartato (stato `pcapFile` riportato a `null`);
    - deve essere impostato un messaggio di errore globale coerente (es. “Invalid file type. Please select a .pcap or .pcapng file.”), mostrato nell’alert superiore;
- se il file è valido:
    - lo stato `pcapFile` deve essere aggiornato con il file selezionato;
    - eventuali errori precedenti devono essere azzerati.

Il nome del file selezionato deve essere mostrato in chiaro vicino al pulsante “Upload file”.

---

**FR-DASH-PCAP-03 – Caricamento file TLS key log con validazione estensioni**

Nello step **“Upload SSL keys file”** l’utente deve poter selezionare un file di key log TLS con estensione:
- `.log`
- `.txt`

I requisiti sono:
- il campo di input file deve accettare solo `.log` e `.txt`;
- se viene scelto un file non conforme:
    - il file deve essere scartato (`sslKeysFile` riportato a `null`);
    - deve essere mostrato un messaggio di errore globale (es. “Invalid file type. Please select a .log or .txt file.”);
- se il file è valido:
    - lo stato `sslKeysFile` deve essere aggiornato;
    - eventuali errori precedenti devono essere rimossi.

L’utente deve vedere il nome del file selezionato in modo analogo allo step PCAP.

---

**FR-DASH-PCAP-04 – Alert globale di errore e auto-scroll in caso di problemi**

In qualsiasi step del wizard, quando viene impostato un messaggio di errore (variabile `errorMessage` non vuota):
- deve comparire, nella parte alta della pagina, un **Alert** di tipo “error” (es. MUI `<Alert severity="error">`) con il testo corrispondente;
- il layout contenente il wizard deve effettuare lo scroll verso l’alto (sulla colonna di contenuto) per rendere l’alert immediatamente visibile all’utente;
- l’alert deve avere una “X” o controllo equivalente per chiuderlo, che azzera `errorMessage`.

Questo comportamento deve valere tanto per errori di validazione (file mancanti, nessuna request estratta, ecc.) quanto per errori restituiti dal backend.

---

**FR-DASH-PCAP-05 – Controllo stato tool prima di ogni “Continue”**

Prima di consentire il passaggio allo step successivo tramite il pulsante “Continue” (o l’azione equivalente su uno step avanzato), la pagina deve:
- invocare il servizio di health check (`healthService.getHealth` + `deriveToolStatus`);
- se lo stato risultante è **“tool_off”** o il servizio è irraggiungibile:
    - impedire l’avanzamento di step (`handleNext` deve uscire senza cambiare `activeStep`);
    - impostare un messaggio di errore adeguato (ad es. “The analysis tool is currently OFF. Please enable it before continuing.”);
- se il tool è **ON** (o comunque non off), permettere l’avanzamento logico dello step (estrazione, invio o semplice incremento di `activeStep`).

Durante il controllo, il pulsante principale deve mostrare lo stato “Checking tool...” e risultare disabilitato per impedire doppi click.

---

**FR-DASH-PCAP-06 – Estrazione HTTP requests da PCAP**

Quando l’utente si trova allo step **“Extract HTTP requests”** (index 2) e preme “Continue”:
- se non è stato selezionato un file PCAP valido, il sistema deve:
    - impostare un errore (“Please select a PCAP file before continuing.”);
    - riportare `activeStep` allo step 0 (upload PCAP);  
- se non è stato selezionato un file SSL keys valido, il sistema deve:
    - impostare un errore (“Please select an SSL keys file before continuing.”);
    - riportare `activeStep` allo step 1 (upload SSL keys);
- se entrambi i file sono presenti:
    - il sistema deve chiamare `pcapService.extractHttpRequestsFromPcap(pcapFile, sslKeysFile)` e impostare `loadingExtract = true` fino al completamento;
    - il risultato deve essere interpretato come array di richieste HTTP (o array vuoto se non valido);
    - lo stato `requests` deve essere aggiornato con l’array “safe” (sempre array), e `selectedRequests` deve essere resettato a lista vuota;
    - se l’array è vuoto, deve essere impostato un messaggio di errore (“No HTTP requests were extracted from the PCAP.”).

In assenza di errori di chiamata, al termine dell’estrazione `activeStep` deve essere impostato direttamente a **3** (step “Preview extracted requests”), saltando lo step 2 come completato.

In caso di errore (eccezione, HTTP error, ecc.), deve essere mostrato il messaggio restituito dal backend se disponibile (`error.response.data.error`), altrimenti un fallback (“Failed to extract HTTP requests from PCAP.”).

---

**FR-DASH-PCAP-07 – Gestione stati di caricamento per estrazione**

Durante l’estrazione (step 2):
- se `loadingExtract` è **true**, nello step di estrazione deve comparire:
    - uno spinner di caricamento;
    - un messaggio tipo “Extracting HTTP requests from PCAP...”.
- il pulsante “Continue” deve risultare disabilitato finché `loadingExtract` rimane true;
- il pulsante “Back” deve essere disabilitato se una estrazione è in corso (`loadingExtract === true`).

Al termine, lo spinner scompare e lo step mostra un testo descrittivo (“When you press Continue…”), con il pulsante nuovamente utilizzabile.

---

**FR-DASH-PCAP-08 – Anteprima delle richieste estratte (preview read-only)**

Nello step **“Preview extracted requests”** (index 3), la pagina deve:
- mostrare una griglia in sola lettura (`PcapRequestsDataGrid`) che elenchi tutte le richieste HTTP contenute nello stato `requests`, con almeno le colonne:
    - Method
    - Status
    - URL
    - Authority
    - Body (snippet);
- consentire all’utente di aprire un drawer di dettaglio per ogni riga, con vista strutturata di:
    - metadati della richiesta (method, scheme, authority, path, query);
    - query params (se presenti);
    - request headers e response headers come liste name:value;
    - response body in chiaro con pulsante “Copy body” (attivo solo se presente).

Se non sono presenti richieste (`requests.length === 0`), deve essere mostrato un messaggio informativo (“No HTTP requests are available. Please extract them again from the PCAP.”).

---

**FR-DASH-PCAP-09 – Selezione delle richieste per l’ontologia**

Nello step **“Select requests for ontology”** (index 4), l’interfaccia deve:
- mostrare una griglia selezionabile (`PcapRequestsDataGridSelectable`) contenente le stesse richieste dello stato `requests`;
- consentire la selezione multipla di righe tramite checkbox;
- mantenere internamente un modello di selezione custom (`rowSelectionModel` con `type: 'include' | 'exclude'`), ma esporre verso il parent una semplice lista di richieste selezionate:
    - ogni cambiamento della selezione deve aggiornare lo stato `selectedRequests` nel componente padre tramite `onSelectionChange`;
- offrire le stesse funzionalità di dettaglio del drawer della griglia read-only (metadati, headers, body, copy).

Se non ci sono richieste disponibili, deve essere mostrato lo stesso messaggio di assenza dati (“No HTTP requests are available. Please extract them again from the PCAP.”).

---

**FR-DASH-PCAP-10 – Abilitazione contestuale del pulsante “Continue”**

L’abilitazione del pulsante principale (“Continue” / “Send requests”) deve rispettare le seguenti regole per ciascuno step (oltre al vincolo generale `checkingTool`):
- **Step 0 (Upload PCAP)**
    - “Continue” abilitato solo se è presente un `pcapFile` valido.    
- **Step 1 (Upload SSL keys)**
    - “Continue” abilitato solo se è presente un `sslKeysFile` valido.
- **Step 2 (Extract HTTP requests)**
    - “Continue” disabilitato se `loadingExtract` è true;
    - altrimenti abilitato (l’effettiva estrazione verrà gestita in `handleNext`).
- **Step 3 (Preview)**
    - “Continue” abilitato solo se `requests.length > 0`.
- **Step 4 (Select requests)**
    - “Continue” abilitato solo se:
        - `requests.length > 0`, e
        - `selectedRequests.length > 0`.
- **Step 5 (Confirm and send)**
    - “Continue” (etichetta “Send requests”) abilitato solo se:
        - `selectedRequests.length > 0`, e    
        - `loadingSend` è false.

In qualsiasi step, se `checkingTool` è true, il pulsante deve essere disabilitato e l’etichetta impostata a “Checking tool...”.

---

**FR-DASH-PCAP-11 – Opzione di attivazione del resolver**

Nello step finale **“Confirm and send”** (index 5), l’utente deve:
- visualizzare l’elenco delle richieste selezionate (`selectedRequests`) in una griglia di anteprima read-only (`PcapRequestsDataGrid`);
- disporre di una checkbox esplicita (FormControlLabel) per abilitare o meno il resolver, con label simile a:
    - “Enable resolver to detect potential vulnerabilities.”;
- poter cambiare liberamente il valore di questa opzione prima dell’invio:
    - il valore deve essere mantenuto nello stato `activateResolver`.

Se `selectedRequests` è vuoto, deve essere mostrato un messaggio (“No requests selected. Go back and select at least one request.”) e il pulsante “Send requests” deve risultare disabilitato.

---

**FR-DASH-PCAP-12 – Normalizzazione delle richieste per l’ingestione**

Prima dell’invio verso l’ontologia, le richieste selezionate (`selectedRequests`) devono essere mappate in un formato “raw” compatibile con l’API di ingestione HTTP:
- per ciascuna richiesta PCAP, generare un oggetto che includa:
    - `id`: `r.id` se presente, altrimenti un ID sintetico (es. `pcap-<index>`);
    - `request`:
        - `method`: metodo HTTP originale;            
        - `url`: `uri.full` se presente, altrimenti stringa vuota;
        - `headers`: oggetto chiave/valore costruito da `requestHeaders` (array name/value);
        - `body` e `bodyEncoding`: non valorizzati (undefined) per la request;
    - `response`:
        - `status`: `response.statusCode`;
        - `statusText`: `response.reasonPhrase`;
        - `headers`: oggetto name:value derivato da `response.responseHeaders`;
        - `body`: `response.body` (preservato, tipicamente base64);
        - `bodyEncoding`: impostato a `'base64'` se `response.body` è stringa, altrimenti undefined;
    - `meta.pageUrl`: URL della richiesta (`uri.full`).

La funzione di mapping (`mapPcapItemsToRawItems`) deve garantire che header non validi o privi di `name` vengano ignorati e non causino errori.

---

**FR-DASH-PCAP-13 – Creazione dei batch e invio all’ontologia**

Quando l’utente preme **“Send requests”** allo step 5:
- se `selectedRequests` è vuoto:
    - deve essere impostato un errore (“Please select at least one request before sending.”);
    - `activeStep` deve essere riportato allo step 4 (selezione richieste);
    - nessuna chiamata di invio deve essere effettuata;
- altrimenti:
    - il sistema deve:
        - impostare `loadingSend = true`;
        - mappare le richieste selezionate in `rawItems`;
        - costruire uno o più batch tramite `makeBatchPayloads`, passando:
            - i `rawItems` generati;
            - il grafo di destinazione (da env `VITE_CONNECT_HTTP_REQUESTS_NAME_GRAPH` o default `http://localhost/graphs/http-requests`);
            - i limiti di dimensione (`maxBytes` e `safetyMargin`);
    - se non viene prodotto alcun batch, deve essere impostato l’errore (“No valid HTTP requests to send.”) e il processo interrotto.

Per ogni batch generato:
- deve essere chiamato `httpRequestsService.ingestHttpRequests({ ...batch, activateResolver })`;
- se `res.resRequest.accepted` è true e `res.resRequest.jobId` è presente, il jobId deve essere sottoscritto via `subscribeJob` (WebSocket);
- se `activateResolver` è true e `res.resResolver.accepted` è true con relativo `jobId`, anche questo deve essere sottoscritto.

Gli errori per singolo batch devono essere notificati via snackbar (es. “Error while sending the request (check the console for details).”) e non devono bloccare l’elaborazione dei restanti batch.

---

**FR-DASH-PCAP-14 – Feedback finale post-invio e apertura Job Summaries**

Al termine dell’invio di tutti i batch:
- il sistema deve calcolare:
    - `ok`: numero di job accettati per le richieste (`resRequest.accepted === true`);
    - `total`: numero totale di batch;
    - se `activateResolver` è attivo:
        - `ok` deve includere anche i job resolver accettati (`resResolver.accepted === true`);
        - `total` deve essere incrementato di conseguenza (batch resolver);
- deve essere mostrata una notifica non bloccante (snackbar) con un messaggio del tipo:
    - “Requests accepted by the backend: X/Y. Waiting for results from the worker...”  
        con variante `success` se X > 0, altrimenti `warning`;
- il dialog “Job Summaries” (`openJobsDialog`) deve essere aperto (`setOpenJobsDialog(true)`), mostrando lo stato dei job in corso.

In caso di errore globale nell’invio (eccezione non gestita per singolo batch), deve essere mostrato un messaggio esplicito (“Failed to send HTTP requests to ontology.” o messaggio backend) e il dialog non deve essere aperto.

---

**FR-DASH-PCAP-15 – Raccolta eventi job via WebSocket e costruzione Job Summaries**

La pagina deve sottoscriversi agli eventi di job via WebSocket all’inizializzazione:
- `socketService.onJobEvent(callback)` deve essere registrato in un `useEffect` e disiscritto in un cleanup;
- ogni evento ricevuto deve essere aggiunto allo stato `jobEvents` (lista cumulativa).

I riepiloghi da mostrare nel dialog devono essere derivati da `jobEvents` in maniera aggregata:
- per ciascun jobId, il sistema deve mantenere:
    - `jobId` (stringa);
    - `queue` (nome coda, default “http” se non specificato);
    - `lastEvent` (ultimo tipo di evento ricevuto: completed / failed / update / ecc.);
    - flag booleani `completed` e `failed`;
    - eventuale array `raw` per tracciare la storia degli eventi;

I job devono essere ordinati in modo deterministico (es. per `jobId`) e visualizzati nel dialog come elenco di card, ognuna con:
- un’icona di stato (es. Brightness1Icon) con colore:
    - verde se `completed === true`;
    - rosso se `failed === true`;
    - giallo (warning) altrimenti;
- il nome della coda;
- l’ID del job;
- indicatori testuali “Completed: true/false” e, se pertinente, “Failed: true”.

Se non ci sono ancora job sintetizzati (`jobSummaries.length === 0`), il dialog deve mostrare uno spinner centrale.

---

**FR-DASH-PCAP-16 – Polling di fallback per stato job e gestione sottoscrizioni**

Quando il dialog “Job Summaries” è aperto (`openJobsDialog === true`), la pagina deve:
- avviare un meccanismo di polling periodico (es. ogni 3 secondi) che:
    - legge l’elenco corrente degli ID sottoscritti (`subscribedJobIdsRef.current`);
    - per ciascun ID chiama `httpRequestsService.getHttpIngestResult(id)`;
    - costruisce un evento sintetico con:
        - `event`: “completed” o “failed” se `res.state` lo indica, altrimenti “update”;
        - `queue`: ad es. “http”;
        - `jobId`: l’ID in questione;
        - `data`: l’oggetto `res` del backend;
    - aggiunge l’evento a `jobEvents` (append);
    - se lo stato del job è `completed` o `failed`, rimuove l’ID da `subscribedJobIdsRef.current`;
- interrompere il polling automaticamente quando:
    - tutti i job sottoscritti sono stati processati (`subscribedJobIdsRef.current.size === 0`), cancellando l’intervallo attivo;
- gestire eventuali errori di polling in modo silenzioso (senza bloccare il dialog).

Alla chiusura del dialog (pulsante “OK”):
- il sistema deve:
    - chiudere il dialog (`openJobsDialog = false`);
    - svuotare `jobEvents`;
    - tentare di invocare `socketService.unsubscribeJob(id)` per ogni ID ancora presente in `subscribedJobIdsRef.current`, ignorando eventuali errori;
    - svuotare `subscribedJobIdsRef.current`;
- resettare completamente il wizard riportandolo allo stato iniziale:
    - `activeStep = 0`;
    - `pcapFile`, `sslKeysFile` = null;
    - `requests` e `selectedRequests` = array vuoti;
    - `activateResolver = false`;
    - `errorMessage = ''`;
    - `loadingExtract`, `loadingSend`, `checkingTool` = false.

---

**FR-DASH-PCAP-17 – Gestione del pulsante “Back” e blocco durante operazioni critiche**

Per tutto il flusso:
- il pulsante “Back” deve:
    - decrementare `activeStep` di 1, fino a un minimo di 0 (non andare mai sotto lo step iniziale);
    - resettare eventuali errori (`errorMessage` vuoto) al momento della navigazione indietro;
- “Back” deve essere disabilitato quando:
    - ci si trova allo step 0 (non esiste step precedente);
    - è in corso una estrazione (`loadingExtract === true`);
    - è in corso un invio (`loadingSend === true`);
    - è in corso un controllo tool (`checkingTool === true`).

In questo modo l’utente non può spostarsi tra gli step durante operazioni asincrone critiche.

---

**FR-DASH-PCAP-18 – Comportamento in caso di errori imprevisti**

Per ogni chiamata di rete (health, estrazione, ingest, polling):
- se l’errore è specifico e il backend restituisce un messaggio testuale (`error.response.data.error`), questo deve essere propagato all’utente tramite `errorMessage` globale o snackbar (per errori non bloccanti);
- se l’errore non fornisce dettaglio, usare messaggi generici ma chiari (“Failed to extract HTTP requests from PCAP.”, “Failed to send HTTP requests to ontology.”);
- nessun errore deve causare il crash della pagina:
    - gli stati di caricamento (`loadingExtract`, `loadingSend`, `checkingTool`) devono sempre essere riportati a false in `finally`;
    - gli step devono rimanere coerenti (nessun salto non previsto).

---