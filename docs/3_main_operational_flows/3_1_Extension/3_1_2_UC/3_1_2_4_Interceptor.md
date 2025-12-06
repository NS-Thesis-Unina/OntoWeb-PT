# Interceptor - Casi d'uso

---

**UC-EXT-INT-01 – Navigare tra le modalità di Interceptor**

**Attore principale:**  
Utente (penetration tester)

**Obiettivo:**  
Spostarsi tra le tre modalità della sezione Interceptor: Runtime Scan, Send to ontology, Archive.

**Precondizioni:**

- L’estensione è installata e la popup è aperta.

- La sezione **Interceptor** è raggiungibile dalla barra di navigazione globale.

**Scenario principale:**

1. L’utente apre la popup dell’estensione.

2. Dalla barra globale seleziona la sezione **Interceptor** (se non è già attiva).

3. Nella parte alta della sezione vede i pulsanti/schede di sotto-navigazione:
   
   - Runtime Scan
   
   - Send to ontology
   
   - Archive

4. L’utente clicca sulla modalità desiderata (es. **Archive**).

5. Il contenuto centrale viene sostituito con la vista corrispondente.

6. Il pulsante della modalità attiva viene disabilitato o evidenziato come “corrente”.

7. La scelta della sotto-sezione viene memorizzata come ultima pagina per Interceptor sulla scheda corrente.

**Postcondizioni:**

- La modalità selezionata è attiva e visibile.

- L’interfaccia restituisce all’utente una navigazione coerente alla successiva apertura della sezione Interceptor.

**Varianti / Estensioni:**

- 4a. L’utente clicca su **Runtime Scan** senza altre azioni precedenti  
  → La modalità Runtime Scan viene aperta e considerata come vista predefinita per Interceptor.

---

**UC-EXT-INT-02 – Avviare e arrestare una cattura Runtime Interceptor (gestione lock)**

**Attore principale:**  
Utente

**Obiettivo:**  
Avviare la cattura degli eventi HTTP/HTTPS (e canali speciali) sulla sessione di navigazione corrente e arrestarla quando desiderato, rispettando il lock globale di scansione.

**Precondizioni:**

- La popup dell’estensione è aperta sulla scheda del browser interessata.

- L’utente ha selezionato **Interceptor → Runtime Scan**.

- È presente un pulsante di azione (es. “Start interceptor” / “Stop interceptor”).

- Il lock globale di scansione è libero o già posseduto dalla modalità Interceptor Runtime (per l’avvio).

**Scenario principale (avvio):**

1. L’utente si trova nella vista **Interceptor → Runtime Scan**.

2. La UI mostra lo stato corrente della sessione (es. “STOPPED”) e il pulsante “Start interceptor”.

3. Il sistema verifica lo stato del lock globale:
   
   - se libero o già associato a Interceptor Runtime → il pulsante è abilitato;
   
   - se occupato da un altro modulo → il pulsante è disabilitato o accompagnato da un messaggio di blocco (vedi UC-EXT-INT-17).

4. L’utente clicca “Start interceptor”.

5. Il sistema:
   
   - acquisisce il lock globale per Interceptor Runtime;
   
   - avvia la sessione di cattura sulla scheda corrente.

6. La UI aggiorna lo stato della sessione a “RUNNING” e il pulsante diventa “Stop interceptor”.

**Scenario principale (arresto):**

7. A sessione in corso, l’utente clicca “Stop interceptor”.

8. L’interfaccia mostra un overlay o indicatore che segnala “Stopping interceptor…”.

9. Il sistema ferma la cattura runtime e salva i risultati della sessione.

10. Il lock globale viene rilasciato.

11. Lo stato passa a “STOPPED” e il pulsante torna a “Start interceptor”.

12. I risultati dell’ultimo run vengono resi disponibili nella vista dei risultati.

**Postcondizioni:**

- In caso di avvio, una sessione di Runtime Interceptor è attiva e detiene il lock globale.

- In caso di stop, la sessione è terminata, il lock è rilasciato e i risultati sono disponibili per la consultazione.

**Varianti / Estensioni:**

- 3a. Il lock globale è detenuto da un altro modulo (es. Analyzer Runtime)  
  → Il pulsante “Start interceptor” è disabilitato e un messaggio informa che una scansione è già in corso altrove.

- 9a. Si verifica un errore nell’arresto della sessione  
  → La UI mostra un messaggio di errore; l’utente può riprovare lo stop o chiudere/ripristinare Interceptor.

---

**UC-EXT-INT-03 – Monitorare in tempo reale il pannello di stato Runtime Interceptor**

**Attore principale:**  
Utente

**Obiettivo:**  
Tenere sotto controllo l’andamento di una sessione Runtime Interceptor mentre è in esecuzione.

**Precondizioni:**

- È attiva una sessione Runtime Interceptor sulla scheda corrente.

- La vista **Interceptor → Runtime Scan** è aperta.

**Scenario principale:**

1. L’utente si trova su **Runtime Scan** con la sessione in stato “RUNNING”.

2. La UI mostra un pannello di stato contenente:
   
   - stato corrente (RUNNING/STOPPED);
   
   - timestamp di avvio della sessione;
   
   - numero di pagine uniche intercettate;
   
   - numero totale di eventi catturati;
   
   - totale dei byte catturati.

3. Mentre la sessione prosegue, il sistema aggiorna periodicamente i contatori (pagine, eventi, bytes).

4. L’utente osserva l’evoluzione dei numeri per valutare il volume di traffico analizzato.

5. Se necessario, l’utente può decidere di arrestare la sessione tramite il pulsante “Stop interceptor”.

**Postcondizioni:**

- L’utente dispone di un quadro chiaro, aggiornato quasi in tempo reale, della sessione di cattura in corso.

**Varianti / Estensioni:**

- 2a. La sessione è in stato “STOPPED”  
  → Il pannello mostra valori finali (pagine, eventi, bytes) ma non incrementa più i contatori.

---

**UC-EXT-INT-04 – Consultare la sezione Info Output di Interceptor**

**Attore principale:**  
Utente

**Obiettivo:**  
Capire la struttura e il significato dei dati prodotti da Interceptor (request, response, meta, canali speciali, griglie e riepiloghi).

**Precondizioni:**

- L’utente si trova in **Interceptor → Runtime Scan** o **Interceptor → Archive**.

- È disponibile una sezione informativa “Info Output”.

**Scenario principale:**

1. L’utente, trovandosi in Runtime Scan o Archive, individua la sezione “Info Output”.

2. La sezione elenca e descrive le parti principali dell’output:
   
   - Request (url, method, headers, body, bodyEncoding, bodySize, flag di truncation);
   
   - Response (status, statusText, headers, body, flag cache/service worker);
   
   - Meta (pageUrl, tabId, ts);
   
   - Canali speciali (sendBeacon, EventSource, WebSocket) e loro marcatura;
   
   - Raggruppamento per dominio/pagina;
   
   - Colonne principali della griglia (Method, URL, Status, Status Text, Content-Type).

3. L’utente legge la descrizione per comprendere:
   
   - come interpretare le colonne della tabella;
   
   - che cosa rappresentano i body e le relative codifiche;
   
   - come leggere i riepiloghi di sessione.

4. Forte di queste informazioni, l’utente torna alla vista dei risultati e li interpreta in maniera più consapevole.

**Postcondizioni:**

- L’utente ha un modello mentale chiaro dei dati catturati da Interceptor e sa come usarli nell’analisi di sicurezza.

---

**UC-EXT-INT-05 – Caricare automaticamente l’ultima sessione Runtime completata**

**Attore principale:**  
Utente

**Obiettivo:**  
Ritrovare l’ultimo run Interceptor completato e salvato, senza doverlo cercare manualmente nell’archivio.

**Precondizioni:**

- Esiste almeno una sessione Runtime Interceptor completata e salvata nello storage locale.

- L’utente apre la vista **Interceptor → Runtime Scan**.

**Scenario principale:**

1. L’utente seleziona **Interceptor → Runtime Scan** dalla barra globale/sotto-navigazione.

2. Il sistema controlla nello storage locale se esiste un’ultima sessione runtime salvata.

3. Se trovata:
   
   - carica i metadati della sessione (start/stop, pagine, eventi, bytes);
   
   - carica o rende disponibili i dati necessari per la visualizzazione.

4. La UI mostra un messaggio non bloccante (es. “Latest Interceptor run loaded from storage.”).

5. L’utente vede nella stessa schermata:
   
   - il pannello di stato (in STOPPED, con dati finali);
   
   - la sezione dei risultati con i dettagli del run caricato.

6. L’utente può esplorare il run o avviare una nuova sessione Runtime.

**Postcondizioni:**

- L’ultimo run completato è visualizzabile direttamente dalla vista Runtime Scan.

**Varianti / Estensioni:**

- 3a. Non esiste alcuna sessione precedente salvata  
  → L’area dei risultati mostra un messaggio tipo “No previous runtime runs available.” e invita ad avviare una nuova cattura.

- 3b. Si verifica un errore nel caricamento dallo storage  
  → La UI mostra una notifica di errore, ma la vista rimane utilizzabile per l’avvio di una nuova sessione.

---

**UC-EXT-INT-06 – Esplorare i risultati di una sessione Runtime Interceptor**

**Attore principale:**  
Utente

**Obiettivo:**  
Analizzare nel dettaglio il traffico HTTP/HTTPS e i canali speciali catturati in una singola sessione.

**Precondizioni:**

- Una sessione runtime è stata caricata (ultima sessione o selezionata dall’archivio).

- I dati della sessione sono disponibili per la visualizzazione.

**Scenario principale:**

1. L’utente vede i metadati di sessione:
   
   - orario di inizio/fine;
   
   - numero totale di eventi;
   
   - numero di pagine uniche;
   
   - totale dei byte catturati.

2. Sotto i metadati, la UI mostra i risultati raggruppati per dominio o pagina (es. per pageUrl).

3. Ogni dominio/pagina è rappresentato da una sezione collassabile che indica:
   
   - URL o dominio;
   
   - numero di richieste associate.

4. L’utente espande una sezione relativa a una pagina di interesse.

5. All’interno, viene mostrata una tabella di eventi con colonne:
   
   - Method;
   
   - URL (con troncamento e tooltip per il valore completo);
   
   - Status;
   
   - Status Text;
   
   - Content-Type.

6. L’utente scorre la tabella e individua una richiesta sospetta.

7. Clicca sul comando di dettaglio (es. “Show request/response details”).

8. Si apre un dialog con:
   
   - tab “Request” e “Response” con il JSON raw;
   
   - elenco di campi sintetici (dimensioni body, encoding, flag cache/service worker, ecc.);
   
   - eventuali sotto-tabelle per strutture annidate (es. headers, inputs).

9. L’utente può copiare singoli valori o l’intero JSON negli appunti.

10. Dopo aver chiuso il dialog, può ripetere l’operazione su altri eventi o altre pagine.

**Postcondizioni:**

- L’utente ha esaminato in dettaglio uno o più eventi HTTP intercettati, con possibilità di ispezionare request e response.

**Varianti / Estensioni:**

- 4a. L’utente usa il comando globale “Expand All / Collapse All” per espandere o comprimere tutte le sezioni di dominio/pagina.

- 8a. L’utente utilizza l’azione “Export JSON” per scaricare l’intera sessione in un file JSON con timestamp (vedi UC aggiuntivo se necessario).

---

**UC-EXT-INT-07 – Consultare l’archivio Runtime Interceptor**

**Attore principale:**  
Utente

**Obiettivo:**  
Rivedere le sessioni Runtime Interceptor storiche salvate nello storage locale.

**Precondizioni:**

- Esistono una o più sessioni Interceptor salvate in archivio persistente.

- L’utente accede a **Interceptor → Archive**.

**Scenario principale:**

1. L’utente seleziona la sottosezione **Archive** di Interceptor.

2. Il sistema carica la lista delle sessioni runtime salvate.

3. La UI mostra un elenco di riquadri, uno per ogni sessione, ciascuno con:
   
   - orario di inizio e di fine;
   
   - numero di pagine visitate;
   
   - numero totale di eventi;
   
   - totale dei byte catturati.

4. L’utente identifica una sessione di interesse (es. in base alla data).

5. Clicca per espandere la sessione.

6. La UI mostra uno stato di caricamento (es. “Loading run…”).

7. Il sistema recupera dallo storage il dataset completo della sessione (richieste/risposte).

8. Una volta caricato, la vista dettagliata è mostrata con la stessa struttura descritta in UC-EXT-INT-06 (raggruppamento per pagina, tabella eventi, dialog di dettaglio).

9. L’utente può passare a un’altra sessione e ripetere i passi 5–8.

**Postcondizioni:**

- L’utente può navigare tra le sessioni storiche e analizzarne i dettagli.

**Varianti / Estensioni:**

- 3a. Se non ci sono sessioni in archivio, viene mostrato un messaggio esplicito (es. “No runtime runs.”).

- 7a. Se si verifica un errore nel caricamento del dataset di una sessione, la UI:
  
  - mostra un messaggio di errore;
  
  - offre un pulsante “Retry” per riprovare il caricamento.

---

**UC-EXT-INT-08 – Aggiornare l’archivio Interceptor (auto e manuale)**

**Attore principale:**  
Utente

**Obiettivo:**  
Mantenere l’elenco delle sessioni Interceptor archiviate allineato alle sessioni effettivamente salvate.

**Precondizioni:**

- L’utente si trova nella vista **Interceptor → Archive**.

- Sono possibili nuove sessioni runtime nel tempo.

**Scenario principale (aggiornamento automatico):**

1. L’utente completa una nuova sessione Runtime Interceptor (vedi UC-EXT-INT-02).

2. Al termine della sessione, il sistema salva i dati nello storage locale.

3. Se la sottosezione **Archive** è aperta:
   
   - la lista delle sessioni si aggiorna automaticamente per includere il nuovo run;
   
   - la UI può mostrare una notifica non bloccante di conferma.

4. L’utente vede la nuova sessione comparire in cima (o secondo l’ordinamento previsto).

**Scenario alternativo (refresh manuale):**

5. L’utente, da Archive, clicca su un pulsante “Refresh”.

6. Il sistema ricarica dalla memoria locale l’elenco di tutte le sessioni.

7. In caso di successo, viene mostrata una notifica tipo “Archive loaded from storage successfully!”.

8. In caso di errore, viene mostrato un messaggio che segnala il problema.

**Postcondizioni:**

- L’elenco delle sessioni in archivio riflette lo stato aggiornato dello storage locale.

---

**UC-EXT-INT-09 – Cancellare tutte le sessioni dall’archivio Interceptor**

**Attore principale:**  
Utente

**Obiettivo:**  
Effettuare una pulizia completa dell’archivio Runtime Interceptor (wipe totale).

**Precondizioni:**

- L’utente si trova in **Interceptor → Archive**.

- Esistono una o più sessioni salvate in archivio.

**Scenario principale:**

1. L’utente clicca sul comando “Delete All Scans” o equivalente.

2. Il sistema mostra una dialog di conferma che spiega chiaramente che:
   
   - tutte le sessioni runtime Interceptor salvate saranno rimosse;
   
   - l’operazione è distruttiva e non reversibile.

3. L’utente conferma la cancellazione.

4. Il sistema:
   
   - cancella tutte le sessioni dallo storage locale;
   
   - ricarica la lista dell’archivio.

5. La UI mostra una notifica di conferma (es. “All scans deleted successfully from storage.”).

6. L’elenco risulta vuoto e viene mostrato il messaggio “No runtime runs.”.

**Postcondizioni:**

- L’archivio Runtime Interceptor è stato completamente svuotato.

**Varianti / Estensioni:**

- 4a. In caso di errore nella cancellazione massiva, la UI mostra un messaggio esplicito (es. “Error deleting scans from storage.”) e la lista non viene alterata.

---

**UC-EXT-INT-10 – Cancellare una singola sessione Runtime Interceptor**

**Attore principale:**  
Utente

**Obiettivo:**  
Rimuovere dall’archivio una specifica sessione non più rilevante.

**Precondizioni:**

- L’utente si trova in **Interceptor → Archive**.

- Almeno una sessione è presente in lista.

**Scenario principale:**

1. L’utente espande la sessione che desidera eliminare.

2. All’interno della vista dettagliata, individua l’azione “Delete Scan” associata a quel run.

3. Clicca sul pulsante di cancellazione.

4. Il sistema mostra una dialog di conferma, indicando che la singola sessione verrà rimossa.

5. L’utente conferma.

6. Il sistema cancella la sessione dallo storage locale.

7. La lista delle sessioni viene ricaricata, senza il run appena eliminato.

8. Una notifica conferma l’avvenuta cancellazione.

**Postcondizioni:**

- La sessione selezionata è stata rimossa dallo storage locale e non compare più nell’archivio.

**Varianti / Estensioni:**

- 6a. In caso di errore, la UI mostra un messaggio (“Error deleting scan from storage.”) e la sessione resta visibile in elenco.

---

**UC-EXT-INT-11 – Avviare il workflow “Send to ontology”**

**Attore principale:**  
Utente

**Obiettivo:**  
Iniziare il processo guidato che permette di inviare un sottoinsieme di richieste HTTP intercettate verso l’ontologia (GraphDB) e, opzionalmente, al resolver.

**Precondizioni:**

- Esistono scansioni Runtime Interceptor salvate in archivio.

- Il backend Tool è disponibile (stato “Tool On”).

- Non è attivo alcun lock globale di scansione bloccante (vedi UC-EXT-INT-12).

**Scenario principale:**

1. L’utente apre la sezione **Interceptor**.

2. Seleziona la sottosezione **Send to ontology**.

3. Viene mostrato lo **Step 1 – Introduzione**, che spiega:
   
   - che verrà scelta una scansione salvata;
   
   - che si selezionerà un sito/pagina;
   
   - che si sceglieranno le richieste da inviare a GraphDB e, se abilitato, al resolver.

4. L’utente legge l’introduzione.

5. Se le precondizioni (tool e lock) sono soddisfatte, il pulsante “Continue” risulta abilitato.

6. L’utente clicca “Continue” per passare allo step successivo (“Choose a scan”).

**Postcondizioni:**

- Il workflow è stato avviato e l’utente si trova sullo step “Choose a scan” (Step 2).

**Varianti / Estensioni:**

- 5a. Se il Tool è “Tool Off” o il lock globale è occupato, il pulsante “Continue” rimane disabilitato e viene mostrato un messaggio di blocco (gestito in UC-EXT-INT-12).

---

**UC-EXT-INT-12 – Gestire le precondizioni Tool e lock globale in “Send to ontology”**

**Attore principale:**  
Utente

**Obiettivo:**  
Capire quando il flusso “Send to ontology” è bloccato perché il backend non è operativo o perché un’altra scansione detiene il lock globale.

**Precondizioni:**

- L’utente si trova su uno degli step del wizard **Send to ontology**.

- Il backend Tool può essere On/Off o non raggiungibile.

- Il lock globale può essere libero o occupato.

**Scenario principale (Tool non operativo):**

1. L’utente accede a “Send to ontology” (es. Step 1 o successivi).

2. Il sistema verifica lo stato del backend.

3. Se il Tool risulta “Off” o non raggiungibile:
   
   - viene mostrato un avviso (es. banner di warning) che informa che il backend deve essere in esecuzione;
   
   - i pulsanti “Continue” / “Send Requests” risultano disabilitati.

4. L’utente comprende che deve attivare o verificare il backend prima di procedere.

**Scenario alternativo (lock globale occupato):**

5. Un altro modulo (es. Analyzer Runtime) sta eseguendo una scansione e detiene il lock globale.

6. L’utente entra comunque in “Send to ontology”.

7. Il sistema rileva il lock occupato:
   
   - mostra un messaggio che indica che una scansione è in corso altrove (con eventuale label/descrizione);
   
   - disabilita i pulsanti di avanzamento del wizard.

8. L’utente capisce che deve prima fermare o attendere la conclusione della scansione attiva.

**Postcondizioni:**

- Finché Tool o lock non sono in stato idoneo, il wizard non permette di avanzare o di inviare richieste.

- L’utente ha indicazioni chiare sul motivo del blocco.

**Varianti / Estensioni:**

- 3a. Una volta che il Tool viene reso operativo e il lock liberato, il wizard permette di avanzare normalmente agli step successivi.

---

**UC-EXT-INT-13 – Selezionare la scansione e il website in “Send to ontology”**

**Attore principale:**  
Utente

**Obiettivo:**  
Scegliere quale sessione Runtime Interceptor usare come sorgente, e selezionare la pagina/sito di interesse all’interno di quella sessione.

**Precondizioni:**

- Il wizard “Send to ontology” è stato avviato (UC-EXT-INT-11).

- Le precondizioni Tool/lock sono soddisfatte (UC-EXT-INT-12).

- Esistono scansioni salvate in archivio.

**Scenario principale (Step 2 – Choose a scan):**

1. Allo step “Choose a scan”, il sistema avvia il caricamento delle scansioni Interceptor salvate.

2. La UI mostra uno stato di caricamento (spinner) finché la lista non è pronta.

3. Al termine, viene presentato un elenco di scansioni, ciascuna con:
   
   - startedAt / stoppedAt;
   
   - pagesCount;
   
   - totalEvents;
   
   - totalBytes.

4. L’utente seleziona una singola scansione (es. tramite radio button o selezione a riga singola).

5. Finché non c’è una selezione valida, il pulsante “Continue” resta disabilitato.

6. Una volta selezionata la scansione, “Continue” si abilita e l’utente procede allo Step 3 – “Choose a website”.

**Scenario principale (Step 3 – Choose a website):**

7. Il sistema estrae dall’insieme di dati della scansione selezionata l’elenco delle pagine/siti (pageUrl).

8. Viene mostrato nuovamente uno stato di caricamento finché la lista non è pronta.

9. La UI presenta le pagine con:
   
   - URL;
   
   - numero di richieste associate.

10. L’utente seleziona una pagina (website) d’interesse.

11. Finché non è presente una selezione, “Continue” resta disabilitato.

12. L’utente clicca “Continue” e passa allo step successivo (“Select requests”).

**Postcondizioni:**

- È stata selezionata una (e una sola) scansione e un website/pagina all’interno di essa, pronti per la scelta delle richieste.

**Varianti / Estensioni:**

- 3a. Se non ci sono scansioni valide, viene mostrato un messaggio (es. “No scans available to select.”) e non è possibile proseguire.

- 9a. Se la scansione selezionata non contiene pagine, viene mostrato “No websites available to select.” e il pulsante “Continue” rimane disabilitato.

---

**UC-EXT-INT-14 – Selezionare e ispezionare le richieste HTTP da inviare all’ontologia**

**Attore principale:**  
Utente

**Obiettivo:**  
Scegliere, all’interno del website selezionato, le richieste HTTP di interesse e ispezionarle prima dell’invio.

**Precondizioni:**

- È stata scelta una scansione e un website (UC-EXT-INT-13).

- Il wizard si trova agli step “Select requests” e “Confirm and send”.

**Scenario principale (Step 4 – Select requests):**

1. Il sistema carica le richieste associate al website selezionato.

2. Viene mostrata una griglia con, per ogni richiesta:
   
   - Method;
   
   - URL (con troncamento e tooltip);
   
   - Status;
   
   - Status Text;
   
   - Content-Type.

3. Accanto ad ogni riga, sono presenti:
   
   - una checkbox (o meccanismo equivalente) per la selezione multipla;
   
   - un comando di dettaglio (es. icona per “Show request/response details”).

4. L’utente seleziona una o più richieste da includere nel batch.

5. Se vuole approfondire una specifica richiesta, clicca sul comando di dettaglio:
   
   - si apre un dialog con tab “Request” e “Response” (JSON raw);
   
   - sono presenti dati sintetici e sotto-griglie per le strutture annidate;
   
   - l’utente può copiare i dati di interesse.

6. Chiuso il dialog, l’utente continua a selezionare le richieste desiderate.

7. Finché non è selezionata almeno una richiesta, il pulsante “Continue” rimane disabilitato.

8. L’utente clicca “Continue” per spostarsi allo Step 5 – “Confirm and send”.

**Scenario successivo (Step 5 – Confirm and send – parte di selezione):**

9. Nello step “Confirm and send”, viene mostrata una seconda griglia con le richieste selezionate allo step precedente.

10. L’utente può deselezionare alcune richieste (rifinire il set finale) o ispezionarle nuovamente nei dettagli.

11. Finché non è presente almeno una richiesta selezionata nello step corrente, il pulsante “Send Requests” resta disabilitato.

**Postcondizioni:**

- L’utente ha definito un sottoinsieme finale di richieste HTTP da inviare a GraphDB e, opzionalmente, al resolver.

---

**UC-EXT-INT-15 – Abilitare il resolver e inviare i batch di richieste all’ontologia**

**Attore principale:**  
Utente

**Obiettivo:**  
Confermare l’invio delle richieste selezionate a GraphDB, con l’opzione di attivare un resolver per la rilevazione di potenziali vulnerabilità.

**Precondizioni:**

- L’utente si trova allo Step 5 – “Confirm and send” del wizard.

- È presente almeno una richiesta selezionata.

- Il Tool è “On” e il lock globale non è occupato (UC-EXT-INT-12).

**Scenario principale:**

1. L’utente visualizza la lista delle richieste che sta per inviare.

2. Abilita o meno l’opzione di “resolver” tramite un toggle o checkbox dedicato.

3. Verifica che l’insieme delle richieste sia quello desiderato (eventualmente deselezionandone alcune).

4. Clicca sul pulsante “Send Requests”.

5. Il sistema:
   
   - disabilita temporaneamente il pulsante “Back” e l’azione di invio per evitare duplicazioni;
   
   - compone uno o più batch di richieste, in base alla dimensione dei payload, rispettando limiti di dimensione.

6. Per ciascun batch, il sistema invia una richiesta al backend:
   
   - se il resolver è attivo, può creare job separati per la parte di analisi;
   
   - per ogni job ottiene un esito (accettato / rifiutato).

7. L’utente vede uno stato di caricamento (es. “Sending requests…”).

8. Al termine dell’invio, il sistema mostra un messaggio riepilogativo (es. “Requests accepted by the backend: X/Y. Waiting for results from the worker…”).

9. In caso di errori di comunicazione o invio parzialmente fallito, la UI segnala il problema in modo chiaro, indicando che l’utente potrà eventualmente riprovare.

**Postcondizioni:**

- Uno o più job di ingestione (e, se attivo, di resolver) sono stati creati nel backend.

- Viene aperto il dialog di “Job Summaries” per il monitoraggio (UC-EXT-INT-16).

**Varianti / Estensioni:**

- 9a. Se alcuni batch falliscono:
  
  - il messaggio riepilogativo può indicare quante richieste sono state accettate rispetto al totale;
  
  - l’utente può decidere di ripetere l’invio per il sottoinsieme non accettato.

---

**UC-EXT-INT-16 – Monitorare i job “Send to ontology” nel dialog Job Summaries**

**Attore principale:**  
Utente

**Obiettivo:**  
Controllare lo stato dei job creati per l’ingestione delle richieste in GraphDB e, opzionalmente, per il resolver.

**Precondizioni:**

- Almeno un batch di richieste è stato inviato con successo al backend (UC-EXT-INT-15).

- Il backend fornisce eventi o endpoint per interrogare lo stato dei job.

**Scenario principale:**

1. Dopo l’invio dei batch, si apre automaticamente il dialog **“Job Summaries”**.

2. Inizialmente, il dialog può mostrare uno stato di attesa (spinner) in attesa delle prime informazioni.

3. Man mano che il backend restituisce dati (tramite eventi push e/o polling), il dialog viene popolato con una lista di job:
   
   - identificativo del job;
   
   - coda di appartenenza (es. HTTP, resolver);
   
   - stato (completed / failed / in corso).

4. Per ogni job viene mostrato un indicatore visivo (es. icona semaforo) che riflette lo stato.

5. Il sistema continua a:
   
   - ricevere notifica di aggiornamenti via websocket (se disponibili);
   
   - effettuare polling periodico per i job che non hanno ancora uno stato finale.

6. Quando tutti i job risultano **completed** o **failed**, il sistema interrompe automaticamente il polling.

7. L’utente, a lettura completata dei risultati, preme il pulsante “OK”.

8. Alla chiusura del dialog:
   
   - il flusso “Send to ontology” viene resettato allo stato iniziale (step introduttivo);
   
   - event listener e polling vengono annullati;
   
   - le selezioni fatte (scansione, pagina, richieste) vengono azzerate per consentire un nuovo ciclo di invio.

**Postcondizioni:**

- L’utente ha una visione chiara di come il backend ha processato i job di ingestione e di eventuali fallimenti.

- Il wizard è pronto per un nuovo utilizzo.

---

**UC-EXT-INT-17 – Gestire stati di caricamento, errori e notifiche nella sezione Interceptor**

**Attore principale:**  
Utente

**Obiettivo:**  
Comprendere e gestire in modo fluido le fasi di caricamento, gli errori e i feedback informativi durante l’uso di Runtime, Archive e Send to ontology.

**Precondizioni:**

- L’utente sta usando una qualunque sottosezione di Interceptor.

- Possono verificarsi operazioni lente (caricamenti da storage, comunicazione col backend, invio batch).

**Scenario principale (stati di caricamento):**

1. L’utente avvia un’operazione che richiede tempo, ad esempio:
   
   - caricamento dell’ultima sessione runtime;
   
   - caricamento dell’archivio;
   
   - caricamento dettagli di una singola sessione in archivio;
   
   - popolamento degli elenchi “Choose a scan” / “Choose a website”;
   
   - invio delle richieste a GraphDB.

2. Il sistema mostra un overlay o uno spinner con un testo esplicativo (es. “Loading archive…”, “Sending requests…”).

3. Fino alla conclusione dell’operazione, i pulsanti che potrebbero interferire (es. “Send Requests”, “Back”) vengono temporaneamente disabilitati.

4. Una volta completata l’operazione, l’overlay sparisce e la UI mostra i dati o il nuovo stato.

**Scenario principale (errori e notifiche):**

5. Se si verifica un errore di storage (lettura/scrittura) o di comunicazione con il backend:
   
   - la UI mostra un messaggio esplicito (es. “Error loading runs from storage.”, “Error contacting backend tool.”);
   
   - se possibile, viene offerta un’azione di recupero (es. pulsante “Retry”).

6. Per azioni andate a buon fine (caricamento archivi, cancellazioni, completamento di run, invio richieste, ecc.), il sistema mostra notifiche non bloccanti (snackbar/toast) che:
   
   - confermano l’esito positivo;
   
   - non interrompono la possibilità di interagire con la UI.

7. Le notifiche si chiudono automaticamente dopo un intervallo ragionevole o possono essere ignorate dall’utente.

**Postcondizioni:**

- L’utente è costantemente informato sullo stato delle operazioni in Interceptor, senza trovarsi di fronte a blocchi silenziosi o schermate congelate.

- Anche in presenza di errori, l’interfaccia rimane utilizzabile e, laddove possibile, offre percorsi di recupero (retry o nuove azioni).

---
