# Global - Casi d'uso

---

**UC-EXT-GLOB-01 – Navigazione tra le sezioni principali dalla barra globale**

- **Attore principale**  
  Utente (penetration tester) che utilizza la popup dell’estensione.

- **Obiettivo**  
  Spostarsi rapidamente tra le quattro macro-sezioni: Home, Technology Stack, Analyzer, Interceptor.

- **Precondizioni**
  
  - L’estensione è installata e abilitata nel browser.
  
  - La popup è aperta su una qualunque vista.

- **Postcondizioni minime garantite**
  
  - La sezione selezionata diventa la sezione attiva.
  
  - La barra di navigazione riflette la nuova sezione (pulsante disabilitato/evidenziato).
  
  - Lo stato “ultima sezione visitata” per la scheda corrente viene aggiornato.

- **Scenario principale**
  
  1. L’utente apre la popup dell’estensione.
  
  2. La barra globale mostra i pulsanti: Home, Technology Stack, Analyzer, Interceptor.
  
  3. L’utente clicca su uno dei pulsanti (es. Analyzer).
  
  4. L’interfaccia passa alla sezione selezionata, rendendo visibile la relativa intestazione (Page Navigation) e il contenuto specifico.
  
  5. Il pulsante della sezione attiva viene disabilitato o visualmente evidenziato come “corrente”.
  
  6. La scelta viene memorizzata come ultima sezione visitata per quella scheda del browser.

- **Estensioni / varianti**
  
  - 3a. L’utente clicca sulla sezione già attiva  
    → L’interfaccia rimane sulla stessa vista, senza cambiamenti di stato rilevanti.

---

**UC-EXT-GLOB-02 – Navigazione tra pagine e sotto-pagine di una sezione**

- **Attore principale**  
  Utente.

- **Obiettivo**  
  Navigare in modo coerente tra la pagina principale di una sezione e le relative sotto-pagine (es. Scan / Analyze / Archive), tramite Page Navigation e sub-navigazione.

- **Precondizioni**
  
  - Una sezione è attiva (es. Analyzer).
  
  - L’interfaccia mostra l’intestazione di sezione (Page Navigation) con spazio per la sotto-navigazione.

- **Postcondizioni**
  
  - La sotto-pagina selezionata è caricata e mostrata.
  
  - Il pulsante della sotto-pagina corrente risulta disabilitato o evidenziato.
  
  - La route/sottosezione corrente viene memorizzata come “ultima pagina visitata” per quella sezione e scheda.

- **Scenario principale**
  
  1. L’utente si trova in una sezione che espone più modalità operative (es. Analyzer: One-Time, Runtime, Analyze, Archive).
  
  2. Nella parte alta della sezione, vede la sotto-navigazione con i pulsanti delle modalità disponibili.
  
  3. L’utente clicca su una modalità (es. “Runtime Scan”).
  
  4. L’interfaccia sostituisce il contenuto centrale con la vista corrispondente alla modalità scelta.
  
  5. Il pulsante della modalità attiva viene disabilitato o visualmente evidenziato.
  
  6. L’informazione sulla sotto-pagina attiva viene memorizzata per la ripresa del contesto.

- **Estensioni / varianti**
  
  - 3a. L’utente seleziona una modalità che richiede precondizioni (es. tool on, nessun lock attivo)  
    → La vista viene comunque caricata; eventuali azioni interne (es. pulsanti di avvio) potranno risultare disabilitate a causa delle precondizioni non soddisfatte.

---

**UC-EXT-GLOB-03 – Ripresa del contesto per la scheda corrente**

- **Attore principale**  
  Utente.

- **Obiettivo**  
  Quando riapre la popup su una scheda già utilizzata in precedenza, ritrovare automaticamente l’ultima pagina/sottopagina di lavoro senza doverla cercare manualmente.

- **Precondizioni**
  
  - L’utente ha già utilizzato l’estensione su quella scheda del browser e ha navigato almeno una volta in una sezione specifica.
  
  - Le informazioni di stato per tab sono state salvate correttamente (route o pagina logica).

- **Postcondizioni**
  
  - Alla riapertura della popup, l’utente viene portato alla stessa sezione/sotto-pagina usata in precedenza, salvo eccezioni (sessioni live, errori di storage).
  
  - In caso di impossibilità di recupero, viene mostrata la Home.

- **Scenario principale**
  
  1. L’utente chiude la popup mentre si trova, ad esempio, su Analyzer → One-Time Scan.
  
  2. Dopo qualche tempo, riapre la popup sulla stessa scheda del browser.
  
  3. L’estensione recupera dallo storage locale l’ultima route/pagina associata a quella scheda.
  
  4. L’interfaccia apre direttamente Analyzer → One-Time Scan.
  
  5. L’utente ritrova il contesto di lavoro dov’era stato lasciato.

- **Estensioni / varianti**
  
  - 3a. Non esiste alcuno stato precedente per la scheda corrente  
    → La popup si apre sulla Home di onboarding.
  
  - 3b. Il dato salvato è corrotto o non leggibile  
    → La popup ripiega sulla Home di onboarding (vedi UC-EXT-GLOB-11).

---

**UC-EXT-GLOB-04 – Apertura della popup con una sessione “live” in corso**

- **Attore principale**  
  Utente.

- **Obiettivo**  
  Dare priorità alla schermata di controllo di una sessione live (Analyzer Runtime o Interceptor) rispetto alla semplice ripresa dell’ultima pagina visitata.

- **Precondizioni**
  
  - Una scansione runtime Analyzer o una cattura Interceptor è attiva per la scheda corrente.
  
  - Il lock globale di scansione indica come owner Analyzer Runtime o Interceptor Runtime.
  
  - L’utente apre la popup sulla stessa scheda in cui la sessione è attiva.

- **Postcondizioni**
  
  - L’utente viene portato direttamente alla vista di runtime corrispondente (Analyzer → Runtime Scan oppure Interceptor → Runtime Scan).
  
  - L’utente può monitorare o arrestare la sessione live.

- **Scenario principale**
  
  1. L’utente avvia una Runtime Scan (Analyzer o Interceptor) e chiude la popup.
  
  2. La scansione continua in background.
  
  3. L’utente riapre la popup sulla stessa scheda.
  
  4. L’estensione verifica la presenza di una sessione runtime attiva associata a quella scheda.
  
  5. Se la trova, ignora l’ultima pagina generica salvata per la scheda e apre direttamente la vista runtime relativa al modulo che sta eseguendo la scansione.
  
  6. L’utente vede i contatori in tempo reale e i comandi per fermare la sessione.

- **Estensioni / varianti**
  
  - 4a. Nessuna sessione live è attiva per la scheda corrente  
    → Si applica UC-EXT-GLOB-03 (ripresa contesto) o, in mancanza di stato, la Home.

---

**UC-EXT-GLOB-05 – Avvio di una nuova scansione con lock globale libero**

- **Attore principale**  
  Utente.

- **Obiettivo**  
  Avviare una nuova scansione (Techstack, Analyzer One-Time, Analyzer Runtime, Interceptor Runtime) quando il sistema è libero da altri processi incompatibili.

- **Precondizioni**
  
  - L’utente si trova nella vista di scansione di uno dei moduli (es. Techstack → Scan).
  
  - Il lock globale di scansione non è assegnato oppure è già assegnato allo stesso modulo/modalità che si sta per avviare.

- **Postcondizioni**
  
  - Il lock globale viene acquisito dal modulo/modalità che avvia la scansione.
  
  - La scansione parte e l’interfaccia mostra lo stato di “scanning / running”.
  
  - Lo stato del lock è coerente con il modulo attivo.

- **Scenario principale (generico)**
  
  1. L’utente apre la vista di scansione (es. Analyzer → One-Time Scan).
  
  2. Il sistema verifica lo stato del lock globale (nessun owner o owner compatibile).
  
  3. L’utente clicca il pulsante di avvio della scansione.
  
  4. L’estensione tenta di acquisire il lock globale per quella modalità.
  
  5. L’acquisizione va a buon fine.
  
  6. La scansione viene avviata; l’interfaccia aggiorna lo stato (pulsante disabilitato, indicatori di avanzamento, ecc.).
  
  7. Al termine, il modulo rilascerà il lock (comportamento descritto nei casi d’uso specifici dei moduli).

- **Estensioni / varianti**
  
  - 4a. L’acquisizione del lock fallisce perché nel frattempo un altro modulo ha avviato una scansione  
    → Il modulo visualizza un messaggio di lock occupato e non avvia la scansione (vedi UC-EXT-GLOB-06).

---

**UC-EXT-GLOB-06 – Tentativo di avvio scansione con lock globale occupato**

- **Attore principale**  
  Utente.

- **Obiettivo**  
  Impedire l’avvio di una nuova scansione quando un’altra funzionalità detiene già il lock globale, informando chiaramente l’utente.

- **Precondizioni**
  
  - Una scansione è in corso (in uno qualunque dei moduli) e detiene il lock globale.
  
  - L’utente apre una vista di scansione di un altro modulo o modalità incompatibile.

- **Postcondizioni**
  
  - Nessuna nuova scansione viene effettivamente avviata.
  
  - L’utente comprende quale scansione è in corso e perché non può avviarne un’altra.

- **Scenario principale**
  
  1. È in corso una Runtime Scan Interceptor che possiede il lock globale.
  
  2. L’utente apre Analyzer → One-Time Scan e tenta di avviare una nuova analisi.
  
  3. Il sistema verifica lo stato del lock e rileva che è posseduto da Interceptor Runtime.
  
  4. Il pulsante di avvio risulta disabilitato oppure, se cliccato, viene mostrato un messaggio di errore/avviso.
  
  5. L’interfaccia comunica all’utente che una scansione è già in corso, indicando il modulo/label del lock.
  
  6. L’utente comprende che deve prima terminare la scansione corrente (o attendere il rilascio automatico) prima di avviarne una nuova.

---

**UC-EXT-GLOB-07 – Cambio tema chiaro/scuro e persistenza della scelta**

- **Attore principale**  
  Utente.

- **Obiettivo**  
  Passare dal tema chiaro al tema scuro (e viceversa) e mantenere la preferenza tra un utilizzo e l’altro dell’estensione.

- **Precondizioni**
  
  - L’estensione espone un controllo di toggle del tema nella barra globale (dark/light button).
  
  - Lo storage locale è disponibile per salvare la preferenza, salvo eventuali errori gestiti (vedi UC-EXT-GLOB-11).

- **Postcondizioni**
  
  - Il tema della UI cambia immediatamente su tutte le sezioni e sotto-pagine.
  
  - La scelta viene salvata per essere riapplicata alla prossima apertura della popup.

- **Scenario principale**
  
  1. L’utente apre la popup in tema chiaro.
  
  2. Nella barra globale vede un pulsante/controllo per il tema.
  
  3. L’utente attiva il toggle per passare al tema scuro.
  
  4. L’interfaccia applica immediatamente il tema scuro a tutti i componenti (navbar, card, tabelle, ecc.).
  
  5. La preferenza viene salvata in storage locale.
  
  6. Alla successiva apertura della popup, l’estensione legge la preferenza e applica direttamente il tema scuro.

- **Estensioni / varianti**
  
  - 5a. Non è possibile salvare la preferenza per problemi di storage  
    → Il tema viene comunque applicato per la sessione corrente, ma alla prossima apertura si tornerà al tema di default (vedi UC-EXT-GLOB-11).

---

**UC-EXT-GLOB-08 – Consultazione dello stato del Tool (backend engine)**

- **Attore principale**  
  Utente.

- **Obiettivo**  
  Comprendere rapidamente se il backend (Tool / Engine) è operativo, in fase di verifica o non disponibile, tramite l’indicatore globale.

- **Precondizioni**
  
  - L’estensione è connessa a un backend che espone un endpoint di health-check.
  
  - È attivo il meccanismo di polling e listener degli eventi Tool On/Off.

- **Postcondizioni**
  
  - L’utente può leggere in qualunque momento uno stato sintetico (“Checking”, “Tool On”, “Tool Off”).
  
  - Lo stato è aggiornato periodicamente e riflette la reale disponibilità del backend.

- **Scenario principale**
  
  1. L’utente apre la popup.
  
  2. La barra globale mostra un indicatore testuale/visivo con lo stato iniziale (es. “Checking”).
  
  3. Il sistema effettua una prima chiamata di health-check al backend.
  
  4. Alla risposta:
     
     - se tutti i componenti sono up → lo stato diventa “Tool On”;
     
     - se uno o più componenti non sono disponibili → lo stato diventa “Tool Off”.
  
  5. A intervalli regolari, il sistema ripete il controllo aggiornando l’indicatore.
  
  6. L’utente ha sempre un riferimento rapido per capire se operazioni come “Analyze” o “Send to ontology” saranno possibili.

---

**UC-EXT-GLOB-09 – Atterraggio sulla Home di onboarding e accesso rapido alle funzionalità**

- **Attore principale**  
  Utente.

- **Obiettivo**  
  Offrire, alla prima apertura (o in assenza di stato salvato per la scheda), una Home che spieghi il senso dell’estensione e permetta di entrare rapidamente nelle tre aree principali.

- **Precondizioni**
  
  - È la prima volta che l’estensione viene aperta su quella scheda, oppure non esiste alcuno stato di navigazione precedente.
  
  - Non sono attive sessioni live associate a quella scheda.

- **Postcondizioni**
  
  - La Home viene visualizzata.
  
  - L’utente può passare rapidamente alle sezioni Technology Stack, Analyzer o Interceptor tramite card o pulsanti dedicati.

- **Scenario principale**
  
  1. L’utente apre la popup sulla scheda corrente per la prima volta.
  
  2. L’estensione non trova uno stato precedente per la scheda.
  
  3. L’interfaccia mostra la Home di onboarding, con:
     
     - una breve descrizione dello scopo e dei limiti d’uso (es. solo target autorizzati);
     
     - tre card cliccabili: Technology Stack, Analyzer, Interceptor.
  
  4. L’utente clicca su una delle card (es. Interceptor).
  
  5. L’estensione naviga alla sezione corrispondente (es. Interceptor → Runtime Scan di default).
  
  6. La scelta viene memorizzata come nuova “ultima pagina” per la scheda.

- **Estensioni / varianti**
  
  - 3a. Una sessione runtime è attiva per la scheda  
    → Si applica UC-EXT-GLOB-04, quindi non si mostra la Home ma la vista live.

---

**UC-EXT-GLOB-10 – Ricezione di feedback non bloccante (notifiche globali)**

- **Attore principale**  
  Utente.

- **Obiettivo**  
  Ricevere conferme, avvisi o errori relativi alle azioni svolte, senza bloccare l’interazione con la UI.

- **Precondizioni**
  
  - Il sistema utilizza un componente di notifica (es. snackbar/toast) condiviso tra le sezioni.

- **Postcondizioni**
  
  - Ogni azione significativa (caricamento archivi, cancellazioni, invio job al backend, errori di connessione) può generare un messaggio sintetico.
  
  - L’utente viene informato, ma può continuare a interagire con la UI.

- **Scenario principale (esempio generico)**
  
  1. L’utente esegue un’azione, ad esempio “Refresh archive” in qualunque sezione.
  
  2. Il sistema contatta lo storage o il backend per recuperare i dati.
  
  3. In caso di successo, viene mostrata una notifica di conferma (es. “Archive loaded from storage successfully!”).
  
  4. In caso di errore, viene mostrata una notifica di warning/error (es. “Error loading runs from storage.”).
  
  5. La notifica si chiude automaticamente dopo un intervallo breve o può essere ignorata dall’utente.

---

**UC-EXT-GLOB-11 – Degrado controllato in caso di problemi di persistenza locale**

- **Attore principale**  
  Utente.

- **Obiettivo**  
  Garantire che l’estensione resti utilizzabile anche se l’accesso allo storage locale (tema, ultima route, lock persistito, ecc.) fallisce o è limitato.

- **Precondizioni**
  
  - Il browser non permette accesso stabile allo storage locale (o si verificano errori di lettura/scrittura).
  
  - L’estensione tenta comunque di leggere/scrivere preferenze e stato di navigazione.

- **Postcondizioni**
  
  - L’interfaccia rimane operativa (è possibile navigare, avviare scansioni, usare le funzionalità core).
  
  - Alcune funzionalità “di comodità” (ripresa della pagina, persistenza del tema, ricordo di alcune preferenze) possono non funzionare o tornare ai default.

- **Scenario principale**
  
  1. L’estensione prova a leggere la preferenza di tema o l’ultima route per la scheda corrente.
  
  2. La lettura fallisce (eccezione, permesso negato, dato corrotto, ecc.).
  
  3. Il codice intercetta l’errore e ripiega su valori di default (es. tema di default, Home come pagina iniziale).
  
  4. L’utente può comunque usare l’estensione normalmente, anche se alcune preferenze non vengono ricordate.
  
  5. Eventuali errori critici possono essere segnalati tramite notifica, ma senza bloccare il rendering principale.

- **Estensioni / varianti**
  
  - 3a. Salvataggio della preferenza di tema fallisce  
    → Il cambio tema vale solo per la sessione corrente; alla prossima apertura si torna al default.
  
  - 3b. Salvataggio della “ultima pagina visitata” fallisce  
    → Alla riapertura, l’utente viene portato alla Home invece che alla vista precedente.

---
