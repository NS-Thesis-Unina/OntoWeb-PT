# Techstack - Casi d'uso

---

**UC-EXT-TS-01 – Avviare una scansione Technology Stack sulla scheda corrente**

**Attore principale:** Utente (penetration tester)

**Obiettivo:** Ottenere un’istantanea delle tecnologie e delle configurazioni di sicurezza della pagina attualmente aperta nel browser.

**Precondizioni:**

- L’estensione è installata e la popup è aperta.

- Esiste almeno una scheda attiva del browser con una pagina caricata.

- Nessun altro modulo sta detenendo il lock globale di scansione in modo incompatibile (oppure il lock è già di Techstack).

**Scenario principale:**

1. L’utente apre l’estensione sulla scheda del browser che vuole analizzare.

2. Dalla barra di navigazione globale seleziona la sezione **Technology Stack**.

3. Si trova sulla sottosezione **Scan** (o la seleziona se non è quella attiva).

4. La UI mostra il pulsante per avviare la scansione (es. “Scan current tab”) e, se presente, il risultato precedente.

5. L’utente clicca sul pulsante di avvio scansione.

6. Il sistema verifica il lock globale:
   
   - se disponibile o già posseduto da Techstack, avvia la scansione;
   
   - in caso contrario mostra un messaggio che indica quale altro modulo sta eseguendo una scansione.

7. Durante la scansione, il pulsante risulta disabilitato e la UI evidenzia che l’operazione è in corso.

8. Al termine:
   
   - il lock viene rilasciato;
   
   - i risultati della scansione vengono mostrati nella vista di dettaglio Techstack;
   
   - l’utente può eventualmente rieseguire una nuova scansione.

**Postcondizioni:**

- I risultati della scansione sono disponibili per la visualizzazione nella sottosezione **Scan** e memorizzati secondo le politiche di sessione/archivio.

**Varianti / Estensioni:**

- 6a. Se il lock è detenuto da un altro componente, la scansione non parte: il pulsante rimane disabilitato finché il lock non viene rilasciato.

- 8a. In caso di errore di avvio o durante la scansione, la UI mostra un messaggio esplicito e non aggiorna i risultati.

---

**UC-EXT-TS-02 – Visualizzare automaticamente l’ultimo risultato disponibile**

**Attore principale:** Utente

**Obiettivo:** Ritrovare e consultare rapidamente l’ultimo esito di una scansione Techstack associata al contesto corrente, senza rilanciare una nuova scansione.

**Precondizioni:**

- Esistono risultati Techstack salvati in uno dei contesti (tab corrente, sessione globale, archivio locale).

**Scenario principale:**

1. L’utente apre l’estensione sulla scheda target.

2. Seleziona la sezione **Technology Stack** e la sottosezione **Scan**.

3. Il sistema, in background, cerca l’ultimo risultato secondo la priorità:
   
   - ultimo risultato per la scheda corrente;
   
   - ultimo risultato di sessione globale;
   
   - ultimo risultato presente nell’archivio locale.

4. Se un risultato viene trovato, la UI:
   
   - carica e visualizza il dettaglio del risultato;
   
   - mostra una notifica o un messaggio breve che indica la provenienza del dato.

5. L’utente può esaminare il risultato o decidere di eseguire una nuova scansione.

**Postcondizioni:**

- L’ultimo risultato utile è visibile nella vista **Scan** senza interventi manuali aggiuntivi.

**Varianti / Estensioni:**

- 3a. Se non viene trovato alcun risultato, l’area dei risultati resta vuota o mostra un testo che invita ad avviare una prima scansione.

---

**UC-EXT-TS-03 – Esplorare i risultati Techstack nella vista Scan**

**Attore principale:** Utente

**Obiettivo:** Comprendere tecnologie, header di sicurezza, WAF, cookie e storage della pagina analizzata, tramite una vista strutturata.

**Precondizioni:**

- È presente un risultato Techstack caricato nella sottosezione **Scan** (da nuova scansione o da caricamento automatico).

**Scenario principale:**

1. L’utente visualizza il risultato Techstack corrente.

2. La UI mostra:
   
   - un pannello di metadati (data/ora, dominio, tabId, URL);
   
   - sezioni dedicate a tecnologie rilevate, secure headers, WAF, cookies, storage, raw data.

3. L’utente espande e comprime le sezioni di interesse (es. solo “Secure Headers” e “Cookies”).

4. Se necessario, utilizza l’azione globale “Expand All / Collapse All” per aprire o chiudere in blocco tutte le sezioni.

5. L’utente scorre e analizza i dati presentati, supportandosi con la descrizione informativa (“Info Output”) per capire il significato dei campi.

**Postcondizioni:**

- L’utente ha una vista completa e navigabile del profilo tecnologico e di sicurezza della pagina analizzata.

**Varianti / Estensioni:**

- 4a. L’utente passa al tema chiaro/scuro dal global toggle; la vista si adatta mantenendo leggibilità e coerenza grafica.

---

**UC-EXT-TS-04 – Esportare un risultato Techstack in JSON**

**Attore principale:** Utente

**Obiettivo:** Scaricare i risultati di una scansione Techstack per analisi esterne o archiviazione offline.

**Precondizioni:**

- Nella sottosezione **Scan** o **Archive** è presente un risultato Techstack visualizzabile.

**Scenario principale:**

1. L’utente, dalla vista dettagliata di un risultato Techstack, individua l’azione “Download / Export JSON”.

2. Clicca sul pulsante di download.

3. Il sistema genera il file JSON, includendo i metadati e il dataset dettagliato.

4. Il browser avvia il download del file con un nome univoco (es. contenente il timestamp della scansione).

5. L’utente salva o apre il file sul proprio sistema.

**Postcondizioni:**

- Il file JSON è disponibile sul dispositivo dell’utente per ulteriori analisi o conservazione.

**Varianti / Estensioni:**

- 3a. In caso di errore nella generazione o nel download, la UI mostra un messaggio esplicito che invita a riprovare.

---

**UC-EXT-TS-05 – Consultare l’archivio Techstack per contesto**

**Attore principale:** Utente

**Obiettivo:** Rivedere le scansioni Technology Stack storiche, organizzate per scheda/sessione/archivio locale.

**Precondizioni:**

- Esistono uno o più snapshot Techstack salvati in archivio.

**Scenario principale:**

1. L’utente apre l’estensione e seleziona la sezione **Technology Stack**.

2. Seleziona la sottosezione **Archive**.

3. Il sistema carica l’archivio e presenta i risultati suddivisi almeno nei gruppi:
   
   - Current tab;
   
   - Other tabs;
   
   - Session (Global);
   
   - Local.

4. Per ogni gruppo, l’utente vede se sono presenti o meno risultati e, se presenti:
   
   - l’elenco degli snapshot (con riepilogo: data/ora, dominio, pagine/eventi/bytes se applicabile).

5. L’utente espande uno snapshot di interesse.

6. La UI visualizza i dettagli dello snapshot utilizzando la stessa struttura della vista **Scan**.

7. L’utente naviga tra diversi snapshot ripetendo i passi 5–6 per gruppi diversi.

**Postcondizioni:**

- L’utente ha una panoramica storica delle scansioni Techstack e può approfondire qualsiasi snapshot archiviato.

**Varianti / Estensioni:**

- 3a. Se un gruppo non contiene dati, viene mostrato un messaggio dedicato (es. “Current tab scan empty”).

- 3b. È possibile lanciare un “Refresh” manuale dell’archivio per ricaricare i dati da storage.

---

**UC-EXT-TS-06 – Eliminare uno o più snapshot dall’archivio Techstack**

**Attore principale:** Utente

**Obiettivo:** Pulire l’archivio Techstack eliminando snapshot non più rilevanti, singolarmente o in blocco.

**Precondizioni:**

- L’utente si trova nella sottosezione **Archive** di Technology Stack.

- Esistono snapshot nel gruppo “Local” (archivio persistente).

**Scenario principale (cancellazione singola):**

1. L’utente identifica uno snapshot specifico nel gruppo “Local”.

2. Clicca sull’azione “Delete” associata a quello snapshot.

3. Il sistema mostra una dialog di conferma che esplicita la natura distruttiva dell’operazione.

4. L’utente conferma la cancellazione.

5. Il sistema elimina lo snapshot dal proprio storage e ricarica l’archivio.

6. Una notifica conferma la cancellazione avvenuta.

**Scenario alternativo (cancellazione massiva):**

1. L’utente clicca su “Delete All” per il gruppo persistente.

2. Viene mostrata una dialog di conferma che avverte che tutti gli snapshot locali saranno rimossi.

3. L’utente conferma.

4. Il sistema cancella tutti gli snapshot persistenti Techstack, ricarica l’archivio e mostra un messaggio di conferma.

**Postcondizioni:**

- Gli snapshot selezionati o l’intero archivio Techstack persistente risultano effettivamente rimossi dalla UI e dallo storage.

**Varianti / Estensioni:**

- 5a. In caso di errore nella cancellazione, la UI mostra un messaggio di errore e non altera la lista visualizzata.

---

**UC-EXT-TS-07 – Avviare il workflow di analisi Techstack tramite backend/ontologia**

**Attore principale:** Utente

**Obiettivo:** Inviare un risultato Techstack già acquisito al backend (Tool / Ontologia) per ulteriori analisi e correlazioni.

**Precondizioni:**

- Esistono uno o più snapshot Techstack salvati in archivio locale.

- Il backend Tool è in stato operativo (“Tool On”).

- Nessun altro modulo detiene il lock globale di scansione.

**Scenario principale:**

1. L’utente apre la sezione **Technology Stack**.

2. Seleziona la sottosezione **Analyze**.

3. Un breve testo introduttivo spiega lo scopo dell’analisi rispetto all’ontologia.

4. L’utente clicca su “Continue” per passare allo step successivo.

5. Il sistema carica l’elenco delle scansioni Techstack memorizzate localmente.

6. L’utente seleziona uno snapshot dall’elenco (es. in base a data/ora e dominio).

7. Proseguendo allo step successivo, la UI mostra l’anteprima completa del risultato selezionato (come nella vista Scan).

8. L’utente conferma l’invio cliccando su “Send Scan”.

**Postcondizioni:**

- Lo snapshot selezionato viene inviato al backend, che lo accoda per l’analisi.

**Varianti / Estensioni:**

- 5a. Se non sono presenti scansioni in archivio, la UI informa l’utente e il pulsante di avanzamento resta disabilitato.

- 2a. Se il Tool risulta “Tool Off” o è presente un lock di scansione attivo, il wizard segnala il blocco e non permette di avanzare.

---

**UC-EXT-TS-08 – Monitorare lo stato dei job di analisi Techstack**

**Attore principale:** Utente

**Obiettivo:** Verificare se l’analisi Techstack inviata al backend è stata presa in carico, completata o fallita.

**Precondizioni:**

- Almeno un job di analisi Techstack è stato inviato con successo al backend.

- Il backend Tool fornisce eventi o API per interrogare lo stato dei job.

**Scenario principale:**

1. Dopo aver inviato uno snapshot (UC-EXT-TS-07), l’utente viene informato che le richieste sono state accettate e che il sistema attende il risultato del worker.

2. Si apre (o è disponibile) un dialog “Job Summaries”.

3. Il dialog mostra una lista dei job associati agli invii effettuati, indicando:
   
   - ID job;
   
   - coda (es. “techstack”);
   
   - stato (completed / failed / in corso).

4. Mentre il dialog è aperto:
   
   - il sistema riceve eventi in tempo reale dal backend;
   
   - in parallelo, esegue un polling periodico per aggiornare eventuali job mancanti.

5. Quando tutti i job risultano completed o failed, il polling viene interrotto.

6. L’utente chiude il dialog con un pulsante (es. “OK”), che:
   
   - resetta il flusso di Analyze;
   
   - annulla eventuali sottoscrizioni ai job;
   
   - permette di avviare una nuova analisi con un altro snapshot, se desiderato.

**Postcondizioni:**

- L’utente ha una visione chiara dello stato dei job Techstack e può eventualmente riavviare il flusso Analyze.

**Varianti / Estensioni:**

- 4a. Se alcuni job non producono eventi websocket, il loro stato viene comunque aggiornato tramite polling REST periodico.

- 3a. Se non sono ancora disponibili dati per nessun job, il dialog mostra uno stato di attesa (es. spinner).

---

**UC-EXT-TS-09 – Gestire blocchi e errori durante le operazioni Techstack**

**Attore principale:** Utente

**Obiettivo:** Comprendere perché un’azione Techstack (scansione, analisi, accesso ad archivio) non è disponibile o non va a buon fine, e come procedere.

**Precondizioni:**

- L’utente sta usando una delle sottosezioni Techstack (Scan, Archive, Analyze).

**Scenario principale:**

1. L’utente tenta di:
   
   - avviare una nuova scansione;
   
   - avanzare nel wizard di Analyze;
   
   - caricare l’archivio.

2. Il sistema incontra una condizione di blocco o errore, ad esempio:
   
   - lock globale già detenuto da un altro modulo;
   
   - Tool in stato “Tool Off” o non raggiungibile;
   
   - errore di lettura/scrittura dallo storage locale.

3. La UI mostra un messaggio chiaro, specificando:
   
   - se il blocco è dovuto a una scansione in corso altrove (con eventuale label della scansione);
   
   - se il problema è legato al backend (tool non in esecuzione);
   
   - se è avvenuto un errore generico di storage.

4. I pulsanti coinvolti nell’azione (es. “Scan”, “Continue”, “Send Scan”) vengono disabilitati finché la condizione non rientra.

5. L’utente può:
   
   - interrompere o attendere la conclusione della scansione che detiene il lock;
   
   - avviare il backend Tool se è sotto il suo controllo;
   
   - riprovare l’azione in un secondo momento.

**Postcondizioni:**

- L’utente è consapevole della causa del blocco e di come sbloccare o aggirare la situazione, senza trovarsi in deadlock silenziosi.

---
