## Analyzer – Casi d’uso
---

**UC-EXT-AN-01 – Navigare tra le modalità di Analyzer**

**Attore principale:** 
Utente (penetration tester)

**Obiettivo:** 
Spostarsi tra le diverse modalità operative di Analyzer: One-Time Scan, Runtime Scan, Analyze, Archive.

**Precondizioni:**
- L’estensione è installata e la popup è aperta.
- L’utente ha selezionato la sezione **Analyzer** dalla barra di navigazione globale.

**Scenario principale:**
1. L’utente apre la sezione **Analyzer**.
2. Nella parte alta della sezione vede la sotto-navigazione con i pulsanti: **One-Time Scan**, **Runtime Scan**, **Analyze**, **Archive**.
3. L’utente clicca sulla modalità desiderata (es. “Runtime Scan”).
4. La vista centrale viene aggiornata mostrando il contenuto specifico della modalità scelta.
5. Il pulsante della modalità attiva viene disabilitato o evidenziato come corrente.
6. La scelta della sottosezione viene salvata come ultimo contesto utilizzato per Analyzer nella scheda corrente.

**Postcondizioni:**
- L’utente si trova nella modalità Analyzer selezionata, pronta per essere utilizzata.
- La sottosezione attiva è memorizzata per eventuale ripresa del contesto.

**Varianti / Estensioni:**
- 3a. L’utente clicca sulla modalità già attiva  
  → L’interfaccia non cambia contenuto; lo stato rimane invariato.

---

**UC-EXT-AN-02 – Avviare una One-Time Scan Analyzer sulla scheda corrente**

**Attore principale:** 
Utente

**Obiettivo:** 
Effettuare una scansione puntuale (one-shot) della pagina attualmente aperta, ottenendo una fotografia di head, body e statistiche DOM.

**Precondizioni:**
- L’estensione è aperta.
- Esiste una scheda attiva del browser con una pagina caricata.
- La sezione **Analyzer → One-Time Scan** è aperta.
- Il lock globale di scansione è libero o già assegnato alla modalità One-Time Analyzer.

**Scenario principale:**
1. L’utente apre **Analyzer** e seleziona **One-Time Scan** se non è già attiva.
2. La UI mostra il pulsante per avviare la scansione (es. “Scan current tab”) e, se presente, l’ultimo risultato caricato.
3. L’utente clicca sul pulsante di avvio scansione.
4. Il sistema verifica il lock globale:
   - se è disponibile o già posseduto da Analyzer One-Time, prosegue;
   - altrimenti blocca l’avvio e mostra un messaggio informativo.
5. La scansione parte e il pulsante viene disabilitato; viene mostrato uno stato di avanzamento (“scanning…”).
6. Al termine, i dati raccolti (head, body, stats) vengono salvati e mostrati nella vista dei risultati.
7. Il lock globale viene rilasciato automaticamente.

**Postcondizioni:**
- Un nuovo snapshot One-Time Analyzer è disponibile e visibile nella sottosezione **One-Time Scan**, e memorizzato secondo le politiche di sessione/archivio.

**Varianti / Estensioni:**
- 2a. Quando l’utente entra in **One-Time Scan**, il sistema carica automaticamente l’ultimo risultato disponibile (per tab, sessione globale, archivio locale) se presente.
- 4a. Se il lock globale è già detenuto da un altro modulo, il pulsante resta disabilitato e viene mostrato un messaggio che indica quale scansione è in corso.
- 6a. In caso di errore durante la scansione, la UI mostra un messaggio esplicito e non aggiorna i risultati.

---

**UC-EXT-AN-03 – Esplorare i risultati di una One-Time Scan Analyzer**

**Attore principale:** 
Utente

**Obiettivo:** 
Analizzare in dettaglio la struttura della pagina (head, body, stats) dopo una One-Time Scan.

**Precondizioni:**
- Un risultato One-Time Analyzer è caricato nella vista **Analyzer → One-Time Scan**.

**Scenario principale:**
1. L’utente visualizza il risultato One-Time corrente.
2. La UI mostra:
   - metadati (data/ora, dominio, URL, tabId);
   - sezione **Head** (title, meta, link, scripts);
   - sezione **Body** (forms, iframes, links, immagini, audio/video, headings, liste);
   - sezione **Stats** (numero elementi, profondità DOM, conteggi per tag).
3. L’utente espande o collassa le macro-sezioni (Head, Body, Stats) secondo necessità.
4. Se vuole, utilizza l’azione “Expand All / Collapse All” per aprire o chiudere tutte le sezioni.
5. L’utente scorre i dati, incrociandoli con la sezione informativa (“Info Output”) per capirne il significato.
6. Se necessario, esporta il risultato in JSON tramite il pulsante di download.

**Postcondizioni:**
- L’utente ha una panoramica chiara e strutturata della pagina analizzata, pronta per ulteriori verifiche di sicurezza.

**Varianti / Estensioni:**
- 6a. Dalla stessa vista, se l’opzione è disponibile, l’utente può cancellare lo snapshot tramite un comando con dialog di conferma.
- 3a. Il passaggio da tema chiaro a scuro tramite il toggle globale non altera la leggibilità dei dati.

---

**UC-EXT-AN-04 – Avviare e fermare una Runtime Scan Analyzer**

**Attore principale:** 
Utente

**Obiettivo:** 
Monitorare in modo continuativo le pagine visitate durante la navigazione, acquisendo snapshot multipli (runtime).

**Precondizioni:**
- L’estensione è aperta e la sezione **Analyzer → Runtime Scan** è attiva.
- Il lock globale di scansione è libero o già associato a Analyzer Runtime (per avvio).
- Per lo stop: una sessione runtime Analyzer è attiva.

**Scenario principale (avvio):**
1. L’utente apre **Analyzer → Runtime Scan**.
2. La UI mostra un pulsante “Start runtime scan” (o equivalente) e, se presente, l’ultimo run salvato.
3. L’utente clicca su “Start”.
4. Il sistema verifica il lock globale:
   - se libero o compatibile, acquisisce il lock per Analyzer Runtime;
   - altrimenti blocca l’operazione e mostra il motivo.
5. La sessione Runtime viene avviata; lo stato passa a “RUNNING” e vengono azzerati i contatori.
6. Il pulsante cambia comportamento diventando “Stop runtime scan”.

**Scenario principale (stop):**
1. L’utente clicca su “Stop runtime scan”.
2. L’interfaccia mostra che è in corso lo stop (overlay di attesa, pulsanti temporaneamente disabilitati).
3. Il sistema chiude la sessione runtime, salva i dati (pagine, snapshot, metadati).
4. Lo stato passa a “STOPPED” e il lock globale viene rilasciato.
5. Il risultato del run appena concluso viene caricato in UI e reso esplorabile.

**Postcondizioni:**
- Viene creata o aggiornata una sessione runtime Analyzer, salvata in storage, visualizzabile anche in **Archive → Runtime Scan**.
- Il lock globale torna disponibile dopo la chiusura della sessione.

**Varianti / Estensioni:**
- 4a. Se il lock globale è detenuto da un altro modulo, il pulsante “Start” è disabilitato o mostra un avviso.
- 7a. Se lo stop incontra errori, la UI ne dà evidenza e invita a riprovare o a verificare stato e storage.

---

**UC-EXT-AN-05 – Monitorare lo stato live di una Runtime Scan Analyzer**

**Attore principale:** 
Utente

**Obiettivo:** 
Seguire in tempo reale l’andamento di una sessione runtime Analyzer (copertura e volume dati).

**Precondizioni:**
- Una sessione Runtime Analyzer è attiva (stato “RUNNING”).
- L’utente si trova in **Analyzer → Runtime Scan** sulla scheda associata.

**Scenario principale:**
1. L’utente ha avviato una Runtime Scan o riapre la popup con una sessione runtime già in corso.
2. La vista Runtime mostra un pannello di stato con:
   - stato corrente (RUNNING);
   - timestamp di inizio;
   - numero di pagine uniche analizzate;
   - numero totale di snapshot effettuati.
3. Man mano che l’utente naviga tra le pagine del sito target, i contatori si aggiornano dinamicamente.
4. L’utente può decidere in qualunque momento di fermare la sessione (vedi UC-EXT-AN-04).
5. Alla fine, il pannello viene aggiornato con le statistiche definitive (start/end, total pages, total scans).

**Postcondizioni:**
- L’utente ha un quadro aggiornato in tempo quasi reale sull’andamento della scansione runtime.

---

**UC-EXT-AN-06 – Caricare e consultare l’ultima sessione Runtime Analyzer**

**Attore principale:** 
Utente

**Obiettivo:** 
Rivedere l’ultima sessione runtime completata, organizzata per pagine e snapshot.

**Precondizioni:**
- Almeno una sessione runtime Analyzer è stata conclusa e salvata in storage.
- L’utente è in **Analyzer → Runtime Scan** oppure **Analyzer → Archive → Runtime Scan**.

**Scenario principale (da Runtime Scan):**
1. L’utente apre **Analyzer → Runtime Scan** senza avere una sessione in corso.
2. Il sistema carica automaticamente l’ultima sessione runtime salvata.
3. La UI mostra un messaggio informativo (es. “Last runtime run loaded from storage”).
4. L’utente vede il riepilogo: orario di inizio/fine, numero pagine, numero snapshot.
5. Sotto il riepilogo, la sessione è visualizzata per pagine (URL); ciascuna pagina è espandibile.
6. Espandendo una pagina, l’utente vede l’elenco degli snapshot associati, ognuno rappresentato tramite la vista One-Time (head/body/stats).
7. L’utente può esplorare ciascuno snapshot per capire come la pagina è cambiata durante la navigazione.

**Postcondizioni:**
- L’ultima sessione runtime è facilmente consultabile senza dover andare esplicitamente nell’archivio.

**Varianti / Estensioni:**
- 2a. Se non sono disponibili sessioni precedenti, la UI mostra un messaggio (es. “No runtime runs found.”).

---

**UC-EXT-AN-07 – Consultare l’archivio delle One-Time Scan Analyzer**

**Attore principale:** 
Utente

**Obiettivo:** 
Recuperare e consultare gli snapshot One-Time Analyzer storici, organizzati per contesto (tab corrente, altre tab, sessione globale, locale).

**Precondizioni:**
- Esistono snapshot One-Time salvati in uno o più contesti.

**Scenario principale:**
1. L’utente apre **Analyzer → Archive**.
2. All’interno dell’archivio, seleziona la sotto-scheda **One-Time Scan**.
3. Il sistema carica l’archivio e presenta i gruppi:
   - Current Tab;
   - Other Tabs (this session);
   - Last Global Session Run;
   - Local Saved.
4. Per ogni gruppo, la UI mostra se ci sono risultati e quanti.
5. L’utente espande un gruppo di interesse (es. Local Saved).
6. Viene visualizzato l’elenco degli snapshot, con metadati (data/ora, dominio, tabId).
7. L’utente espande uno snapshot, che viene mostrato usando la stessa UI della vista One-Time (head/body/stats).
8. L’utente può ripetere l’operazione per altri snapshot o altri gruppi.

**Postcondizioni:**
- L’utente dispone di una vista storica e contestualizzata delle proprie One-Time Scan.

**Varianti / Estensioni:**
- 3a. Se un gruppo non contiene dati, viene mostrato un testo esplicito (es. “No current tab snap.”).
- 2a. L’utente può usare un pulsante “Refresh” per ricaricare i dati da storage (con notifica di esito).

---

**UC-EXT-AN-08 – Cancellare snapshot One-Time dall’archivio Analyzer**

**Attore principale:** 
Utente

**Obiettivo:** 
Gestire lo spazio e la rilevanza dei dati, eliminando singoli snapshot o tutti gli snapshot persistenti One-Time.

**Precondizioni:**
- L’utente è in **Analyzer → Archive → One-Time Scan**.
- Esistono snapshot nel gruppo “Local Saved”.

**Scenario principale (cancellazione singola):**
1. L’utente individua uno snapshot specifico nel gruppo “Local Saved”.
2. Clicca sul pulsante “Delete” relativo a quello snapshot.
3. Il sistema mostra una dialog di conferma.
4. L’utente conferma la cancellazione.
5. Lo snapshot viene rimosso dallo storage e l’archivio viene ricaricato.
6. Una notifica conferma l’operazione.

**Scenario alternativo (cancellazione massiva):**
1. L’utente clicca su “Delete All” nella sezione delle One-Time persistenti.
2. Viene mostrata una dialog che avvisa che tutti gli snapshot locali saranno rimossi.
3. L’utente conferma.
4. Il sistema elimina tutti gli snapshot persistenti One-Time, ricarica l’archivio e mostra un messaggio di conferma.

**Postcondizioni:**
- Gli snapshot selezionati (o l’intero archivio One-Time locale) sono stati rimossi sia dallo storage sia dalla UI.

**Varianti / Estensioni:**
- 5a. In caso di errore in fase di cancellazione, viene mostrato un messaggio esplicito e la lista rimane invariata.

---

**UC-EXT-AN-09 – Consultare e gestire l’archivio delle Runtime Scan Analyzer**

**Attore principale:** 
Utente

**Obiettivo:** 
Rivedere le sessioni runtime passate e, se necessario, eliminarle.

**Precondizioni:**
- Sono presenti sessioni runtime Analyzer salvate in storage.

**Scenario principale (consultazione):**
1. L’utente apre **Analyzer → Archive**.
2. Seleziona la sotto-scheda **Runtime Scan**.
3. Il sistema carica l’elenco delle sessioni salvate, ciascuna con:
   - timestamp di inizio e fine;
   - numero di pagine visitate;
   - numero di scansioni effettuate.
4. L’utente vede un riquadro per ogni sessione.
5. Espandendo un riquadro, l’estensione carica i dettagli completi del run (per pagina, con gli snapshot come viste One-Time).
6. L’utente esplora gli snapshot delle pagine di interesse.

**Scenario alternativo (cancellazione):**
1. Per una singola sessione, l’utente clicca su “Delete Scan” nella vista dettagliata.
2. Viene aperta una dialog di conferma; l’utente conferma.
3. Il sistema rimuove la sessione dallo storage e aggiorna la lista.
4. Per cancellare tutte le sessioni, l’utente clicca su “Delete All”, conferma nella dialog, e il sistema esegue un wipe completo delle sessioni runtime.

**Postcondizioni:**
- Le sessioni runtime sono consultabili e gestibili in modo granulare o massivo.

**Varianti / Estensioni:**
- 3a. Se non esistono sessioni runtime, viene mostrato un messaggio (es. “No runtime snaps.”).
- 2a. È disponibile un pulsante “Refresh” per ricaricare la lista da storage, con notifica di esito.

---

**UC-EXT-AN-10 – Avviare il workflow “Analyze → One-Time Scan”**

**Attore principale:** 
Utente

**Obiettivo:** 
Inviare un risultato One-Time Analyzer salvato al backend per analisi basata su ontologia/regole.

**Precondizioni:**
- Esistono snapshot One-Time in archivio locale.
- Il backend Tool è in stato “Tool On”.
- Nessun’altra scansione detiene il lock globale.

**Scenario principale:**
1. L’utente apre **Analyzer → Analyze**.
2. La sotto-navigazione interna di Analyze è impostata di default su **One-Time Scan**.
3. Lo step 1 del wizard mostra una breve introduzione sullo scopo dell’analisi.
4. L’utente clicca su “Continue”.
5. Lo step 2 carica la lista delle One-Time salvate (Local Saved).
6. L’utente seleziona uno snapshot dall’elenco (in base a data, tabId, dominio).
7. Cliccando nuovamente su “Continue”, passa allo step 3.
8. Lo step 3 mostra l’anteprima completa dello snapshot (head/body/stats) usando la UI One-Time.
9. L’utente clicca su “Send Scan” per inviare i dati al backend.

**Postcondizioni:**
- Lo snapshot selezionato è inviato al backend come job di analisi.

**Varianti / Estensioni:**
- 5a. Se la lista è vuota, il pulsante “Continue” rimane disabilitato e la UI informa l’utente che non ci sono snapshot disponibili.
- 3a. Se lo stato del Tool è “Off” o un lock di scansione è attivo, i pulsanti di avanzamento sono disabilitati e un messaggio spiega il motivo.
- L’utente può usare il pulsante “Back” per tornare agli step precedenti e cambiare selezione.

---

**UC-EXT-AN-11 – Monitorare i job “Analyze → One-Time Scan”**

**Attore principale:** 
Utente

**Obiettivo:** 
Verificare in che stato si trovano i job di analisi creati inviando snapshot One-Time al backend.

**Precondizioni:**
- Almeno un job è stato generato da **Analyze → One-Time Scan** e accettato dal backend.

**Scenario principale:**
1. Dopo l’invio, la UI informa che il job è stato accettato ed è in lavorazione.
2. Si apre (o viene messo a disposizione) un dialog **Job Summaries**.
3. Il dialog elenca i job con:
   - ID;
   - coda (es. Analyzer);
   - stato (in corso / completed / failed).
4. Il sistema riceve aggiornamenti:
   - tramite eventi (websocket o equivalenti);
   - tramite polling periodico sulle API del backend.
5. Lo stato dei job viene aggiornato man mano che avanzano.
6. Quando tutti i job sono in stato completed o failed, il polling viene automaticamente interrotto.
7. L’utente chiude il dialog con un pulsante (es. “OK”), che resetta il wizard e le sottoscrizioni in modo da permettere un nuovo invio.

**Postcondizioni:**
- L’utente ha visibilità sull’esito dei job di analisi One-Time e può ripetere il flusso con altri snapshot.

---

**UC-EXT-AN-12 – Workflow “Analyze → Runtime Scan” (run → pagina → snapshot)**

**Attore principale:** 
Utente

**Obiettivo:** 
Selezionare un singolo snapshot derivato da una sessione runtime e inviarlo al backend per analisi.

**Precondizioni:**
- Esistono sessioni runtime Analyzer salvate in archivio.
- Il Tool è in stato “Tool On”.
- Nessun lock globale di scansione impedisce l’operazione.

**Scenario principale:**
1. L’utente apre **Analyzer → Analyze** e seleziona la sotto-scheda **Runtime Scan**.
2. Lo step 1 del wizard spiega che si andrà a scegliere uno snapshot da un run runtime.
3. L’utente clicca su “Continue”.
4. Step 2 – Selezione del run:
   - il sistema carica la lista delle sessioni runtime (start/end, pagine, scansioni);
   - l’utente ne seleziona una.
5. L’utente clicca su “Continue”.
6. Step 3 – Selezione della pagina:
   - viene mostrato l’elenco delle pagine (URL) incluse nel run, con conteggio snapshot per pagina;
   - l’utente sceglie una pagina.
7. L’utente clicca su “Continue”.
8. Step 4 – Selezione dello snapshot:
   - vengono mostrati tutti gli snapshot di quella pagina, ciascuno esplorabile come vista One-Time embedded;
   - l’utente seleziona uno snapshot specifico.
9. L’utente clicca su “Continue”.
10. Step 5 – Review & Submit:
    - viene mostrata la vista completa dello snapshot scelto;
    - l’utente clicca su “Send Scan” per inviare i dati al backend.

**Postcondizioni:**
- Lo snapshot selezionato (derivato da un run runtime) è inviato al backend come job di analisi.

**Varianti / Estensioni:**
- 4a. Se non esistono runtime run salvati, il wizard mostra un messaggio e non consente di avanzare oltre lo step 2.
- 6a. Se per il run selezionato non ci sono pagine valide, viene mostrato un messaggio esplicito.
- 8a. Se per la pagina scelta non ci sono snapshot, lo step 4 non abilita il pulsante di continuazione.
- In ogni step, il pulsante “Continue” è abilitato solo se c’è una selezione valida e le precondizioni (Tool On, no lock) sono soddisfatte.

---

**UC-EXT-AN-13 – Monitorare i job “Analyze → Runtime Scan”**

**Attore principale:** 
Utente

**Obiettivo:** 
Vedere l’avanzamento e l’esito dei job generati dall’analisi di snapshot runtime.

**Precondizioni:**
- L’utente ha completato il wizard **Analyze → Runtime Scan** e uno o più job sono stati accettati dal backend.

**Scenario principale:**
1. Dopo l’invio, la UI conferma che i job sono stati creati.
2. Si apre il dialog **Job Summaries**, analogo a quello per One-Time.
3. Il dialog mostra:
   - ID job;
   - coda;
   - stato (in corso / completed / failed).
4. Il sistema aggiorna lo stato tramite eventi e/o polling.
5. Una volta che tutti i job risultano completati o falliti, il sistema interrompe il polling.
6. L’utente clicca su “OK”:
   - il wizard viene resettato allo stato iniziale;
   - le sottoscrizioni ai job vengono disattivate;
   - le selezioni run/pagina/snapshot vengono azzerate.

**Postcondizioni:**
- L’utente ha il quadro completo degli esiti dei job di analisi runtime e può ripetere il flusso con altri snapshot.

---

**UC-EXT-AN-14 – Gestire errori, blocchi e feedback in Analyzer**

**Attore principale:** 
Utente

**Obiettivo:** 
Comprendere e gestire le situazioni in cui operazioni Analyzer (scansioni, analisi, caricamenti) sono bloccate o falliscono.

**Precondizioni:**
- L’utente sta lavorando in una sottosezione di Analyzer (One-Time, Runtime, Analyze, Archive).

**Scenario principale (generico):**
1. L’utente tenta un’operazione:
   - avviare una One-Time Scan;
   - avviare/fermare una Runtime Scan;
   - avanzare nel wizard di Analyze;
   - caricare archivi o run.
2. Il sistema incontra un problema, ad esempio:
   - lock globale occupato da un altro modulo;
   - Tool non operativo (Tool Off o non raggiungibile);
   - errori di storage (lettura/scrittura).
3. L’interfaccia mostra un messaggio chiaro che indica la natura del problema:
   - “Another scan is currently running (label…)”;
   - “Backend tool appears to be offline”;
   - “Error reading archive from storage”.
4. I pulsanti coinvolti (Scan, Start/Stop, Continue, Send Scan) vengono disabilitati finché la condizione non viene meno.
5. L’utente può:
   - fermare la scansione che detiene il lock (se è in un’altra sezione);
   - avviare il backend Tool, se ne ha il controllo;
   - riprovare l’azione in un secondo momento.
6. Quando la condizione critica rientra, i pulsanti tornano disponibili e l’utente può ripetere l’operazione.

**Postcondizioni:**
- L’utente ha sempre un’indicazione esplicita del motivo per cui un’azione Analyzer non è disponibile o fallisce, senza trovarsi in situazioni di blocco silenzioso.

---
