# Send PCAP – Casi d’uso
---

**UC-DASH-PCAP-01 – Apertura della pagina “Send PCAP” e visualizzazione del wizard**

- **Attore principale**  
    Utente (penetration tester) che utilizza la dashboard.
    
- **Obiettivo**  
    Iniziare un flusso guidato per inviare un file PCAP al backend, vedendo chiaramente i passi richiesti.
    
- **Precondizioni**
    - La dashboard è raggiungibile e l’utente ha aperto l’interfaccia.
    - La barra di navigazione laterale è visibile.
        
- **Postcondizioni**
    - La pagina “Send PCAP” è visualizzata all’interno del layout comune (AppBar + nav laterale).
    - Viene mostrato uno stepper verticale con i 6 passi:
        1. Upload PCAP file
        2. Upload SSL keys file
        3. Extract HTTP requests
        4. Preview extracted requests
        5. Select requests for ontology
        6. Confirm and send 
    - Lo step attivo è il primo (“Upload PCAP file”).
    - I pulsanti “Back” e “Continue” sono visibili in fondo al contenuto dello step:
        - “Back” disabilitato (non esiste step precedente).
        - “Continue” disabilitato finché non è stato selezionato un file PCAP valido.
    - Lo stato interno del wizard è inizializzato (file null, liste vuote, nessun errore).
        
- **Scenario principale**
    1. L’utente, da qualsiasi pagina, clicca su “Send PCAP” nella nav laterale o sulla feature card corrispondente in Home.
    2. Il router carica la pagina “Send PCAP” mantenendo barra superiore e nav laterale invariate.
    3. L’interfaccia mostra lo stepper verticale con i 6 passi, evidenziando il primo come attivo.
    4. Sotto il titolo dello step viene mostrata una breve descrizione testuale dello scopo (“Carica il file PCAP…”) e il controllo per selezionare il file PCAP.
    5. In basso compaiono i pulsanti “Back” (disabilitato) e “Continue” (disabilitato finché non viene scelto un file valido).
    6. Nessuna chiamata di rete è ancora stata effettuata; il wizard è pronto all’uso.
        
- **Estensioni / varianti**
    - 2a. L’utente arriva alla pagina tramite URL diretto (`/send-pcap`)  
        → Il comportamento è lo stesso: il wizard viene inizializzato sul primo step.

---

**UC-DASH-PCAP-02 – Caricamento e validazione dei file PCAP e SSL keys**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Caricare un file PCAP e un file SSL keys validi, con feedback chiaro in caso di estensioni non valide.
    
- **Precondizioni**
    - L’utente si trova allo step 0 (“Upload PCAP file”) o allo step 1 (“Upload SSL keys file”) del wizard.
    - Non è in corso alcuna operazione critica (estrazione, invio, controllo tool).
        
- **Postcondizioni**
    - Se il file selezionato è valido:
        - Lo stato interno corrispondente (pcapFile o sslKeysFile) è aggiornato con il file.
        - Il nome del file selezionato è mostrato vicino al pulsante di upload.
        - Eventuali errori precedenti vengono azzerati.
    - Se il file è invalido:
        - Il file viene scartato (stato impostato a `null`).
        - Viene mostrato un messaggio di errore in un alert globale.
        - Il layout effettua scroll verso l’alto per rendere visibile l’alert.
            
- **Scenario principale**
    1. **Step 0 – Upload PCAP**
        1. L’utente clicca il pulsante di upload per il PCAP.
        2. Si apre il file chooser del sistema operativo.
        3. L’utente seleziona un file con estensione `.pcap` o `.pcapng`.
        4. Il componente verifica l’estensione:
            - se valida, aggiorna `pcapFile` e mostra il nome del file;
            - rimuove eventuali messaggi di errore precedenti.
    2. **Step 1 – Upload SSL keys**
        1. L’utente, dopo aver caricato il PCAP, passa allo step 1 (“Upload SSL keys file”).
        2. Clicca il pulsante di upload per il file di key log.
        3. Seleziona un file con estensione `.log` o `.txt`.
        4. Il componente verifica l’estensione:
            - se valida, aggiorna `sslKeysFile` e mostra il nome del file;
            - rimuove eventuali errori precedenti.
                
- **Estensioni / varianti**
    - 1a. L’utente seleziona per il PCAP un file con estensione diversa da `.pcap` / `.pcapng`  
        → Il file viene scartato (`pcapFile = null`), viene impostato `errorMessage` (“Invalid file type. Please select a .pcap or .pcapng file.”), appare un alert di errore in alto e la pagina scrolla verso l’alto.
    - 2a. L’utente seleziona per le SSL keys un file con estensione diversa da `.log` / `.txt`  
        → Il file viene scartato (`sslKeysFile = null`), viene mostrato un alert analogo (“Invalid file type. Please select a .log or .txt file.”) con scroll automatico.
    - 1b/2b. L’utente ricarica un nuovo file valido dopo un errore  
        → Il nuovo file sostituisce quello precedente, `errorMessage` viene azzerato e l’alert scompare.

---

**UC-DASH-PCAP-03 – Controllo dello stato del tool prima dell’avanzamento di step**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Verificare automaticamente che il backend (tool) sia operativo prima di consentire il passaggio allo step successivo o l’avvio di operazioni critiche (estrazione, invio richieste).
    
- **Precondizioni**
    - L’utente si trova in uno qualsiasi degli step del wizard.
    - I requisiti locali dello step per abilitare “Continue” sono soddisfatti (es. file presente, richieste estratte, selezione non vuota).
    - Il pulsante “Continue” è abilitato.
        
- **Postcondizioni**
    - Se il tool è ON (o comunque non OFF):
        - L’azione associata allo step viene eseguita (avanzamento step o chiamata di estrazione/invio).
    - Se il tool è OFF o l’health-check fallisce:
        - Lo step corrente non cambia.
        - Viene mostrato un messaggio di errore in un alert (“The analysis tool is currently OFF…”).
        - L’utente viene informato che deve rendere operativo il tool prima di procedere.
            
- **Scenario principale**
    1. L’utente preme “Continue” da uno step in cui il pulsante è abilitato.
    2. Il sistema imposta lo stato di `checkingTool = true` e sostituisce temporaneamente l’etichetta del pulsante in “Checking tool...”; i pulsanti “Continue” e “Back” vengono disabilitati.
    3. Viene chiamato il servizio di health (`getHealth` + `deriveToolStatus`).
    4. Alla risposta:
        - se lo stato è diverso da “tool_off”:
            1. `checkingTool` torna a false;
            2. il flusso specifico dello step prosegue (es. passaggio allo step successivo o avvio dell’estrazione / invio).
        - se lo stato è “tool_off” o la chiamata fallisce:
            1. `checkingTool` torna comunque a false;
            2. lo `activeStep` rimane invariato;
            3. viene impostato `errorMessage` (ad es. “The analysis tool is currently OFF. Please enable it before continuing.”);
            4. viene mostrato un alert di errore in alto con scroll automatico.
    5. L’utente può correggere la situazione (ad es. abilitando il backend) e premere nuovamente “Continue”.
        
- **Estensioni / varianti**
    - 4a. L’utente preme “Continue” su uno step che comporta un’azione asincrona (estrazione o invio)  
        → Il controllo tool viene comunque eseguito per primo; solo se supera il controllo viene avviata l’operazione specifica dello step.
    - 4b. La chiamata di health genera eccezione o timeout  
        → Viene gestita come tool_off, con messaggio di errore e nessun cambiamento di step.

---

**UC-DASH-PCAP-04 – Estrazione delle richieste HTTP dal PCAP**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Estrarre le richieste HTTP contenute nel PCAP utilizzando il file PCAP e il file SSL keys caricati, con feedback chiaro in caso di problemi o assenza di richieste.
    
- **Precondizioni**
    - L’utente si trova allo step 2 (“Extract HTTP requests”).
    - È stato caricato un file PCAP valido (`pcapFile` non null).
    - È stato caricato un file SSL keys valido (`sslKeysFile` non null).
    - Il tool risulta ON al controllo di UC-DASH-PCAP-03.
    - `loadingExtract` è false.
        
- **Postcondizioni**
    - Se l’estrazione ha successo con richieste:
        - `requests` contiene un array di richieste HTTP.
        - `selectedRequests` è vuoto.
        - `activeStep` viene impostato direttamente a 3 (“Preview extracted requests”).
    - Se l’estrazione ha successo ma non trova richieste:
        - `requests` viene impostato a un array vuoto.
        - `activeStep` viene comunque impostato a 3.
        - Viene impostato `errorMessage` (“No HTTP requests were extracted from the PCAP.”) e mostrato un alert.
    - Se l’estrazione fallisce:
        - `loadingExtract` torna a false.
        - `activeStep` rimane 2.
        - Viene impostato un messaggio di errore (specifico dal backend o generico) e mostrato in alert.
            
- **Scenario principale**
    1. L’utente è allo step “Extract HTTP requests” e preme “Continue”.
    2. Viene eseguito il controllo tool (UC-DASH-PCAP-03); se non passa, l’azione termina lì.
    3. Il componente verifica che:
        - `pcapFile` non sia null;
        - `sslKeysFile` non sia null.
    4. Se uno dei due file manca:
        - se manca `pcapFile`: viene impostato `errorMessage` (“Please select a PCAP file before continuing.”) e `activeStep` viene riportato allo step 0;
        - se manca `sslKeysFile`: viene impostato `errorMessage` (“Please select an SSL keys file before continuing.”) e `activeStep` viene riportato allo step 1.
    5. Se entrambi i file sono presenti:
        1. `loadingExtract` viene impostato a true, il pulsante “Continue” viene disabilitato e viene mostrato un messaggio “Extracting HTTP requests from PCAP...”.
        2. Viene chiamato `pcapService.extractHttpRequestsFromPcap(pcapFile, sslKeysFile)`.
        3. Alla risposta:
            - se la chiamata va a buon fine:
                - il risultato viene interpretato come array (o trasformato in array vuoto se non valido);
                - `requests` viene aggiornato con l’array safe;
                - `selectedRequests` viene resettato a [];
                - `loadingExtract` torna a false;
                - `activeStep` viene impostato a 3;
                - se l’array è vuoto, viene impostato `errorMessage` (“No HTTP requests were extracted from the PCAP.”) e mostrato un alert.
            - se la chiamata fallisce:
                - `loadingExtract` torna a false;
                - viene impostato `errorMessage` con il messaggio backend se disponibile (`error.response.data.error`) oppure un fallback (“Failed to extract HTTP requests from PCAP.”);
                - viene mostrato l’alert di errore, lasciando `activeStep` a 2.
                    
- **Estensioni / varianti**
    - 5a. L’utente tenta di cambiare step mentre `loadingExtract` è true  
        → Il pulsante “Back” è disabilitato, impedendo di uscire dallo step durante l’estrazione.
    - 4a. Entrambi i file risultano mancanti (ad es. per reset precedente)  
        → Viene scelto il primo errore rilevato (es. PCAP mancante) e l’utente viene riportato allo step relativo.

---

**UC-DASH-PCAP-05 – Anteprima in sola lettura delle richieste estratte**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Esaminare in sola lettura le richieste HTTP estratte dal PCAP, con possibilità di aprirne i dettagli completi.
    
- **Precondizioni**
    - L’utente si trova allo step 3 (“Preview extracted requests”).
    - `requests` è stato impostato dal passo di estrazione (può essere vuoto o meno).
        
- **Postcondizioni*
    - L’utente può visualizzare una griglia con la lista delle richieste (se presenti).
    - L’utente può aprire e chiudere un drawer di dettaglio su ogni richiesta.
    - Lo stato del wizard non viene modificato dalle operazioni di anteprima (nessuna selezione o modifica dei dati).
        
- **Scenario principale**
    1. Il wizard è allo step “Preview extracted requests”.
    2. Il sistema mostra una `PcapRequestsDataGrid` in sola lettura:
        - se `requests.length > 0`, ogni riga include almeno: Method, Status, URL, Authority, Body (snippet);
        - se `requests.length === 0`, al posto della griglia appare il messaggio “No HTTP requests are available. Please extract them again from the PCAP.”.
    3. Il pulsante “Continue” è:
        - abilitato solo se `requests.length > 0` e nessuna operazione di controllo tool è in corso;
        - disabilitato se non ci sono richieste.
    4. L’utente clicca sull’icona “View details” di una riga della griglia.
    5. Si apre un drawer laterale che mostra:
        - metadati della richiesta (method, scheme, authority, path, query string grezza);
        - eventuali query params come `name = value`, se presenti;
        - request headers e response headers come lista nome: valore;
        - il body della risposta, visualizzato nel formato salvato (tipicamente Base64) in un riquadro scrollabile;
        - un pulsante “Copy body” abilitato solo se il body è presente.
    6. L’utente può copiare il body negli appunti tramite “Copy body”; eventuali errori di clipboard vengono gestiti internamente e non bloccano l’interfaccia.
    7. L’utente chiude il drawer; la griglia rimane invariata.
- **Estensioni / varianti**
    - 5a. Il body della risposta non è presente  
        → La sezione del body mostra un testo “No body” e il pulsante “Copy body” è disabilitato.
    - 2a. L’utente arriva a questo step con `requests` vuoto (es. estrazione riuscita ma senza risultati)  
        → Viene mostrato il messaggio di assenza dati e l’utente può decidere di tornare indietro e rieseguire l’estrazione.

---

**UC-DASH-PCAP-06 – Selezione delle richieste da inviare all’ontologia**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Selezionare un sottoinsieme delle richieste HTTP estratte da inviare all’ontologia, mantenendo la possibilità di ispezionarle nel dettaglio.
    
- **Precondizioni**
    - L’utente si trova allo step 4 (“Select requests for ontology”).
    - `requests` contiene le richieste estratte (può essere vuoto).
    - `selectedRequests` può essere inizialmente vuoto.
    
- **Postcondizioni**
    - `selectedRequests` contiene la lista delle richieste selezionate.
    - Il pulsante “Continue” viene abilitato solo se:
        - esistono richieste (`requests.length > 0`), e
        - è stata selezionata almeno una richiesta (`selectedRequests.length > 0`).
    
- **Scenario principale**
    1. L’utente passa allo step “Select requests for ontology”.
    2. La UI mostra una `PcapRequestsDataGridSelectable` contenente le stesse richieste di `requests`.
    3. Ogni riga presenta una checkbox per la selezione; il componente mantiene internamente un modello di selezione (ad es. include/exclude).
    4. L’utente seleziona una o più righe.
    5. Ogni cambiamento di selezione scatena una callback `onSelectionChange`, che aggiorna `selectedRequests` nel componente principale con la lista effettiva delle richieste selezionate.
    6. Quando `selectedRequests.length > 0`, il pulsante “Continue” viene abilitato; se la selezione torna a zero, il pulsante viene disabilitato.
    7. L’utente può, anche in questo step, aprire il dettaglio di una singola richiesta tramite il drawer laterale (stessa struttura dello step 3).
    8. Una volta soddisfatto della selezione, l’utente preme “Continue” per passare allo step di conferma e invio.
        
- **Estensioni / varianti**
    - 2a. `requests.length === 0`  
        → Non viene mostrata la griglia; appare il messaggio “No HTTP requests are available. Please extract them again from the PCAP.” e il pulsante “Continue” rimane disabilitato.
    - 4a. L’utente modifica più volte la selezione (aggiunge/rimuove righe)  
        → `selectedRequests` si aggiorna coerentemente e lo stato del pulsante “Continue” segue sempre il numero di selezionate.

---

**UC-DASH-PCAP-07 – Configurazione dell’opzione resolver e invio delle richieste**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Configurare se abilitare il resolver per la ricerca di vulnerabilità e inviare all’ontologia le richieste selezionate, gestendo batching e possibili errori.
    
- **Precondizioni**
    - L’utente si trova allo step 5 (“Confirm and send”).
    - `selectedRequests` contiene zero o più richieste selezionate.
    - `loadingSend` è false.
        
- **Postcondizioni**
    - Se `selectedRequests.length > 0` e l’invio va a buon fine:
        - Le richieste sono mappate in `rawItems` e suddivise in uno o più batch.
        - Per ogni batch valido viene effettuata una chiamata di ingest al backend.
        - I job relativi (richieste e, se attivo, resolver) vengono sottoscritti via WebSocket.
        - Viene mostrata una snackbar di riepilogo X/Y job accettati.
        - Il dialog “Job Summaries” viene aperto.
    - In caso di problemi (nessuna richiesta valida, errori globali):
        - Viene mostrato un messaggio di errore in alert o snackbar.
        - Il wizard rimane coerente e l’utente può correggere e riprovare.
            
- **Scenario principale (invio corretto)**
    1. L’utente entra allo step “Confirm and send” con `selectedRequests.length > 0`.
    2. La UI presenta una griglia read-only con le richieste selezionate, come ulteriore anteprima.
    3. Sotto la griglia è presente una checkbox “Enable resolver to detect potential vulnerabilities.” legata a `activateResolver`.
    4. L’utente decide se abilitare o meno il resolver, selezionando/deselezionando la checkbox; il valore viene memorizzato.
    5. L’utente preme “Send requests”.
    6. Viene eseguito il controllo dello stato del tool (UC-DASH-PCAP-03); se non supera il controllo, l’invio non parte.
    7. Se il tool è utilizzabile e `selectedRequests.length > 0`:
        1. Il sistema imposta `loadingSend = true` e disabilita il pulsante “Send requests”.
        2. Le richieste selezionate vengono mappate in `rawItems`, ciascuna con:
            - id (quello originale o sintetico),
            - request (method, url, headers),
            - response (status, reasonPhrase, headers, body, bodyEncoding),
            - meta.pageUrl.
        3. Viene invocata `makeBatchPayloads` per suddividere `rawItems` in uno o più batch compatibili con i limiti di dimensione.
        4. Se non viene prodotto alcun batch:
            - `loadingSend` torna a false;
            - viene impostato `errorMessage` (“No valid HTTP requests to send.”);
            - l’utente viene riportato allo step 4 per rivedere la selezione.
        5. Se sono disponibili batch:
            - per ciascun batch viene chiamato `httpRequestsService.ingestHttpRequests({ ...batch, activateResolver })`;
            - per ogni risposta:
                - se `res.resRequest.accepted === true` e `jobId` presente, il job viene sottoscritto tramite `subscribeJob`;
                - se `activateResolver` è true e `res.resResolver.accepted === true` con relativo `jobId`, anche questi job vengono sottoscritti;
                - eventuali errori su singoli batch producono una snackbar di warning/error (“Error while sending the request…”) ma non interrompono l’invio degli altri batch.
    8. Terminato l’invio di tutti i batch, il sistema calcola:
        - `ok`: numero di job accettati (incluse eventuali parti resolver se attivo);
        - `total`: numero totale di job considerati.
    9. Viene mostrata una snackbar con un messaggio, ad esempio:
        - “Requests accepted by the backend: X/Y. Waiting for results from the worker...” con severità `success` se X>0, altrimenti `warning`.
    10. Il dialog “Job Summaries” viene aperto (`openJobsDialog = true`) per permettere il monitoraggio (UC-DASH-PCAP-08); `loadingSend` torna a false.
    
- **Estensioni / varianti**
    - 2a. `selectedRequests.length === 0` quando l’utente arriva allo step 5  
        → Viene mostrato il messaggio “No requests selected. Go back and select at least one request.” e il pulsante “Send requests” rimane disabilitato.
    - 5a. L’utente forza l’invio senza richieste (logica di sicurezza)  
        → Viene impostato `errorMessage` (“Please select at least one request before sending.”) e `activeStep` viene riportato allo step 4.
    - 6a. Il controllo tool restituisce “tool_off” o errore  
        → `loadingSend` non viene impostato; lo step resta 5; viene mostrato un alert di errore e “Send requests” viene riabilitato dopo il controllo.
    - 7a. Si verifica un errore globale durante l’invio (non legato a un singolo batch)  
        → `loadingSend` torna a false, viene mostrato un messaggio esplicito (“Failed to send HTTP requests to ontology.” o messaggio backend), il dialog Job Summaries non viene aperto.

---

**UC-DASH-PCAP-08 – Monitoraggio dei job di ingestione tramite dialog “Job Summaries”**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Osservare lo stato di avanzamento dei job di ingestione (e di eventuale resolver) lanciati dal flusso Send PCAP, tramite WebSocket e polling di fallback.
    
- **Precondizioni*
    - L’invio dei batch è stato effettuato (UC-DASH-PCAP-07).
    - Esiste almeno un jobId sottoscritto (richieste e/o resolver).
    - `openJobsDialog === true`.
        
- **Postcondizioni**
    - L’utente visualizza un elenco di job con stato aggiornato (in attesa, completato, fallito).
    - Il sistema aggrega gli eventi di job in riepiloghi sintetici (`jobSummaries`).
    - Il polling di fallback viene arrestato automaticamente quando non ci sono più job da monitorare.
        
- **Scenario principale**
    1. Subito dopo l’invio, si apre il dialog “Job Summaries”.
    2. All’inizializzazione del componente, viene registrato un listener WebSocket tramite `socketService.onJobEvent(callback)`.
    3. Ogni evento ricevuto (es. `completed`, `failed`, `update`) viene aggiunto a `jobEvents`.
    4. Una logica interna costruisce da `jobEvents` una lista di `jobSummaries`, contenenti per ciascun jobId:
        - l’ultimo evento ricevuto (`lastEvent`);
        - lo stato sintetico `completed` / `failed`;
        - il nome della coda (`queue`, es. “http”);
        - eventuale cronologia raw degli eventi.
    5. Il dialog visualizza i job in forma di card:
        - ogni card mostra il jobId, il nome della coda;
        - un’icona di stato (verde se completed, rossa se failed, gialla se ancora in corso);
        - testo “Completed: true/false” e, se rilevante, “Failed: true”.
    6. Se `jobSummaries` è vuoto (es. perché non sono ancora arrivati eventi), il dialog mostra uno spinner centrale per indicare che il sistema è in attesa di aggiornamenti.
    7. Finché `openJobsDialog` è true, viene avviato un meccanismo di polling periodico (es. ogni 3 secondi) che:
        1. legge l’insieme `subscribedJobIdsRef.current`;
        2. per ciascun jobId chiama `httpRequestsService.getHttpIngestResult(id)`;
        3. converte la risposta in un evento sintetico (completed/failed/update) e lo aggiunge a `jobEvents`;
        4. se un job risulta `completed` o `failed`, rimuove il relativo jobId dall’insieme.
    8. Quando tutti i job sottoscritti sono stati processati (insieme vuoto), il polling viene automaticamente interrotto.
    9. Eventuali errori temporanei delle chiamate di polling non bloccano il dialog: possono essere loggati in console ma non producono messaggi bloccanti per l’utente.
        
- **Estensioni / varianti**
    - 5a. È presente un solo job da monitorare  
        → Il dialog mostra comunque una card con lo stesso schema (icona di stato, queue, jobId).
    - 7a. Alcuni job non generano mai eventi WebSocket, ma vengono risolti tramite polling  
        → Il riepilogo finale mostra correttamente completed/failed, anche se lo stato deriva solo dal polling.

---

**UC-DASH-PCAP-09 – Chiusura del dialog “Job Summaries” e reset del wizard**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Chiudere il dialog di monitoraggio job e riportare il wizard Send PCAP allo stato iniziale, pronto per un nuovo flusso.
    
- **Precondizioni**
    - Il dialog “Job Summaries” è aperto (`openJobsDialog === true`).
    - Possono esistere job ancora in corso o già completati.
    - `jobEvents` può contenere uno storico di eventi.

- **Postcondizioni**
    - Il dialog “Job Summaries” è chiuso.
    - Tutti gli ID di job ancora sottoscritti vengono “unsubscribe-ati”.
    - Lo stato del wizard (file, richieste, selezioni, flag) è completamente resettato.
    - L’utente si ritrova nuovamente allo step 0 (“Upload PCAP file”).
        
- **Scenario principale**
    1. Dopo aver consultato lo stato dei job, l’utente preme il pulsante “OK” (o chiude il dialog).
    2. Il sistema imposta `openJobsDialog = false`, causando la chiusura del dialog.
    3. L’applicazione itera su `subscribedJobIdsRef.current`:
        - per ogni jobId tenta di chiamare `socketService.unsubscribeJob(id)`, ignorando eventuali errori.
    4. L’insieme `subscribedJobIdsRef.current` viene svuotato.
    5. `jobEvents` viene resettato a un array vuoto, così che il prossimo invio parta da uno stato pulito.
    6. Il wizard viene riportato allo stato iniziale:
        - `activeStep = 0`;
        - `pcapFile = null`, `sslKeysFile = null`;
        - `requests = []`, `selectedRequests = []`;
        - `activateResolver = false`;
        - `errorMessage = ''`;
        - `loadingExtract = false`, `loadingSend = false`, `checkingTool = false`.
    7. L’utente vede di nuovo lo step 0 con i controlli per caricare un nuovo PCAP.
        
- **Estensioni / varianti**
    - 3a. Alcuni job non sono ancora terminati al momento della chiusura  
        → L’interfaccia smette comunque di ascoltare eventi (unsubscribe + stop polling); i job continueranno lato backend, ma non saranno più monitorati da questa pagina.

---

**UC-DASH-PCAP-10 – Navigazione con pulsante “Back” e gestione degli errori tramite alert globale**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Spostarsi in sicurezza allo step precedente del wizard e ricevere feedback chiaro in caso di errori di validazione o di backend, tramite un unico meccanismo di alert globale.
    
- **Precondizioni**
    - L’utente si trova in uno step del wizard compreso tra 0 e 5.
    - Non è in corso una operazione critica (`loadingExtract`, `loadingSend` o `checkingTool` devono essere false per poter usare “Back”).
    - `errorMessage` può essere vuoto o contenere un messaggio.
        
- **Postcondizioni**
    - Se l’utente utilizza “Back” in condizioni valide:
        - `activeStep` viene decrementato di 1 (mai sotto 0). 
        - `errorMessage` viene azzerato e l’eventuale alert scompare.
    - Quando si verifica un errore:
        - viene impostato un messaggio in `errorMessage`;
        - compare un alert di tipo error nella parte alta della pagina;
        - il layout effettua uno scroll verso l’alto per rendere l’alert visibile.
            
- **Scenario principale (uso del pulsante Back)**
    1. L’utente si trova in uno step successivo allo 0 (ad es. step 3 o 4).
    2. Il pulsante “Back” è visibile e abilitato (nessuna operazione critica in corso).
    3. L’utente preme “Back”.
    4. Il sistema decrementa `activeStep` di 1, portando l’utente allo step precedente.
    5. Se era presente un errore (`errorMessage` non vuoto), il valore viene azzerato e l’alert scompare, così il nuovo step non è “inquinato” da errori precedenti.
        
- **Scenario principale (alert globale di errore)**
    1. Durante uno qualunque degli step, si verifica un errore di validazione o backend (es. file mancante, nessuna request estratta, tool OFF, errore durante estrazione o invio).
    2. Il codice imposta `errorMessage` con un testo descrittivo.
    3. La pagina renderizza un componente Alert in alto, con severità “error” e il testo di `errorMessage`.
    4. Il layout effettua uno scroll verso l’alto per portare immediatamente l’alert in vista.
    5. L’utente può:
        - leggere il messaggio;
        - chiudere l’alert cliccando sulla “X”, che azzera `errorMessage`;
        - correggere la causa (caricare un file valido, modificare la selezione, ripetere l’estrazione, ecc.) e ritentare l’azione.
            
- **Estensioni / varianti**
    - 2a. L’utente tenta di premere “Back” mentre è in corso una estrazione o un invio (`loadingExtract === true` o `loadingSend === true` o `checkingTool === true`)  
        → Il pulsante “Back” risulta disabilitato, impedendo cambi di step durante operazioni critiche.
    - 5a. Si verifica un errore imprevisto in una chiamata di rete  
        → I flag di caricamento vengono riportati a false in un blocco di cleanup; viene impostato un messaggio generico ma chiaro (“Failed to extract HTTP requests from PCAP.”, “Failed to send HTTP requests to ontology.”, ecc.) in `errorMessage`, che appare nell’alert globale senza causare crash o pagine bianche.

---