# Global - Requisiti Funzionali

---

**FR-EXT-GLOB-01 – Navigazione principale tra le sezioni**

L’utente deve poter raggiungere in modo immediato, da qualsiasi schermata della popup, le quattro sezioni principali dell’estensione:

- Home

- Technology Stack

- Analyzer

- Interceptor

tramite una barra di navigazione globale sempre visibile nella parte superiore dell’interfaccia.

Il pulsante corrispondente alla sezione corrente deve risultare disabilitato o comunque evidenziare chiaramente quale area è attiva, così che l’utente abbia sempre consapevolezza di “dove si trova” all’interno dell’estensione.

---

**FR-EXT-GLOB-02 – Struttura gerarchica delle pagine e sotto-pagine**

L’utente deve poter navigare all’interno di ciascuna sezione tramite una struttura coerente di pagine e sotto-pagine:

- ogni sezione (Technology Stack, Analyzer, Interceptor) deve avere un’intestazione (Page Navigation) con titolo, icona e area per azioni contestuali;

- le diverse modalità operative (es. One-Time / Runtime / Archive) devono essere accessibili tramite una sotto-navigazione dedicata (SubPage Navigation), visibile sotto l’intestazione di sezione.

L’organizzazione gerarchica deve risultare intuitiva e omogenea tra le varie sezioni, così che l’utente riconosca velocemente dove avvia una scansione, dove consultare uno storico, dove inviare dati all’engine, ecc.

---

**FR-EXT-GLOB-03 – Ripresa del contesto per ciascuna scheda del browser**

Quando l’utente riapre la popup dell’estensione su una scheda del browser già utilizzata in precedenza:

- l’interfaccia deve riprendere automaticamente “l’ultima pagina significativa” visitata per quella specifica scheda (es. la vista Analyzer One-Time, l’archivio dell’Interceptor, la pagina TechStack), evitando di riportare sempre l’utente alla Home;

- questa ripresa deve essere gestita in modo indipendente per ogni scheda: schede diverse possono trovarsi su sezioni e sotto-pagine differenti.

Se non esiste alcuna pagina precedente salvata per la scheda corrente, la popup deve aprirsi sulla pagina Home per garantire un punto di ingresso chiaro.

---

**FR-EXT-GLOB-04 – Priorità alle sessioni “live” (Analyzer runtime / Interceptor)**

Quando l’utente ha una scansione “live” in corso su una scheda del browser:

- se è attiva una scansione runtime dell’Analyzer, aprendo la popup l’utente deve essere portato automaticamente alla vista di runtime dell’Analyzer, così da poter monitorare e controllare la sessione in tempo reale;

- se è attivo l’Interceptor, aprendo la popup l’utente deve essere portato automaticamente alla sezione Interceptor, sulla vista di cattura in tempo reale.

Questo comportamento deve avere priorità sulla semplice ripresa dell’ultima pagina visitata: in presenza di una sessione “viva” la UI deve rendere immediatamente accessibile la schermata più rilevante per quella sessione.

---

**FR-EXT-GLOB-05 – Coordinamento dei flussi di scansione tramite lock globale**

L’estensione deve coordinare i flussi di scansione tra le diverse funzionalità (Techstack, Analyzer, Interceptor) affinché:

- l’utente non possa avviare simultaneamente più scansioni incompatibili tra loro (es. un runtime Interceptor e una runtime Analyzer in conflitto), evitando stati incoerenti o comportamenti imprevedibili;

- se una scansione è in corso ed è il “proprietario” del lock, le altre sezioni devono riflettere lo stato di blocco (es. pulsanti disabilitati, messaggi di “scan in corso”);

- il blocco debba essere rilasciato automaticamente dopo un tempo massimo di inattività ragionevole, così che l’utente possa recuperare la possibilità di avviare nuove scansioni anche se il popup è stato chiuso o se qualcosa è andato storto.

Da prospettiva utente, questo si traduce in: “se ho già una scansione lunga in corso, l’estensione me lo segnala e impedisce di avviarne un’altra che la manderebbe in conflitto; se qualcosa si blocca, dopo un po’ posso comunque ripartire”.

---

**FR-EXT-GLOB-06 – Gestione tema chiaro/scuro a livello globale**

L’utente deve poter scegliere, in modo centralizzato, se utilizzare l’estensione in modalità:

- tema scuro (dark);

- tema chiaro (light);

tramite un controllo sempre disponibile nella barra di navigazione (dark/light button).

I requisiti sono:

- il cambio tema deve essere immediatamente applicato all’intera UI (tutte le sezioni e sotto-pagine);

- la preferenza dell’utente deve essere ricordata tra un utilizzo e l’altro dell’estensione (persistenza della scelta), senza doverla reimpostare a ogni apertura della popup;

- il logo e gli elementi grafici principali devono adattarsi al tema selezionato, mantenendo buona leggibilità.

---

**FR-EXT-GLOB-07 – Indicatore di stato del “Tool” (engine backend)**

Dalla barra di navigazione globale, l’utente deve poter vedere in tempo quasi reale lo stato operativo del backend (Tool / Engine) tramite un indicatore testuale e visivo, con almeno i seguenti stati:

- Checking: il sistema sta verificando lo stato del backend;

- Tool On: tutti i componenti critici dell’engine sono operativi (“up”) e l’utente può aspettarsi che le richieste di analisi vengano elaborate;

- Tool Off: uno o più componenti risultano non disponibili; l’utente sa che potrebbero verificarsi errori o code non processate.

L’indicatore deve aggiornarsi periodicamente e automaticamente (polling) senza richiedere azioni manuali da parte dell’utente, e usare colori/icona coerenti con lo stato (ad es. neutro/giallo per checking, verde per on, rosso per off).

---

**FR-EXT-GLOB-08 – Home page di onboarding e accesso rapido alle tre funzionalità**

All’apertura iniziale dell’estensione (o in assenza di stato precedente per la scheda):

- l’utente deve visualizzare una pagina Home che spiega brevemente lo scopo dell’estensione e ne evidenzia l’uso esclusivo su target autorizzati;

- la Home deve presentare, in modo chiaro e cliccabile, tre “card” o blocchi che introducono e portano direttamente alle tre funzioni principali:
  
  - Technology Stack
  
  - Analyzer
  
  - Interceptor

Ogni card deve fornire una descrizione sintetica della funzionalità e un’azione di navigazione verso la sezione corrispondente, così da fungere da punto di ingresso naturale ai flussi operativi dell’utente.

---

**FR-EXT-GLOB-09 – Feedback non bloccante e notifiche globali**

L’estensione deve essere in grado di fornire feedback all’utente tramite notifiche non bloccanti (snackbar/toast), ad esempio per:

- confermare l’avvio di una scansione o l’invio di dati verso l’engine;

- segnalare esiti positivi (successo) o errori (es. impossibilità a contattare il backend);

- mostrare brevi messaggi informativi legati ad azioni dell’utente.

Tali notifiche devono:

- comparire in una posizione coerente dell’interfaccia;

- non impedire la prosecuzione dell’attività (l’utente può continuare a navigare);

- chiudersi automaticamente dopo un intervallo ragionevole o essere facilmente ignorabili.

---

**FR-EXT-GLOB-10 – Degrado controllato in caso di problemi di persistenza locale**

In caso di problemi nell’accesso allo storage del browser (es. impossibilità di leggere/scrivere stato di tema, ultima rotta, lock):

- l’estensione deve comunque rimanere utilizzabile, permettendo all’utente di navigare tra le sezioni e avviare le funzionalità di base;

- eventuali funzionalità di “comodità” collegate allo storage (ripresa della pagina per tab, tema ricordato, lock persistito) possono non funzionare, ma senza bloccare o rompere il rendering dell’interfaccia.

Da prospettiva utente: “se il browser non permette di salvare le preferenze, l’estensione continua a funzionare, magari tornando al tema e alla pagina di default, ma senza impedirmi di lavorare.”

---
