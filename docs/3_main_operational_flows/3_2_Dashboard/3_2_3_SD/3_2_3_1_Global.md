# Global – Sequence Diagrams

---

**SD-EXT-GLOB-01 – Apertura popup e scelta della vista iniziale (Home, contesto salvato, sessione live)**



Descrizione (testuale):  
Questo diagramma mostra cosa accade quando l’utente apre la popup dell’estensione su una scheda del browser. La UI globale:

- chiede al gestore delle sessioni runtime se esista una sessione “live” (Analyzer Runtime o Interceptor) per il tab corrente;

- se esiste, porta l’utente direttamente sulla vista runtime corrispondente, ignorando l’ultima pagina salvata;

- se non esiste alcuna sessione live, prova a recuperare dal conto dello storage l’ultima route associata alla scheda;

- se la route è disponibile e valida, la UI naviga lì; altrimenti viene mostrata la Home di onboarding.

---

**SD-EXT-GLOB-02 – Navigazione tra sezioni principali e sotto-pagine**



Descrizione (testuale):  
Questo diagramma descrive la navigazione “globale” e “interna” all’estensione:

- l’utente usa la barra globale (Home, Technology Stack, Analyzer, Interceptor) per cambiare sezione;

- il router centrale aggiorna l’area contenuto con la sezione selezionata, applicando la sottopagina di default;

- ad ogni cambio di sezione o sottopagina, la UI salva nello storage locale la scelta corrente per la scheda, così da poter riprendere facilmente il contesto alla riapertura della popup.

---

**SD-EXT-GLOB-03 – Avvio scansione con lock globale e gestione del conflitto**



Descrizione (testuale):  
Questo diagramma illustra il comportamento globale del lock di scansione:

- quando l’utente preme “Start scan” in uno dei moduli (Techstack, Analyzer, Interceptor), la vista di scansione chiede al servizio di lock globale di acquisire il lock;

- se il lock è libero (o coerente con il modulo che sta partendo), la scansione viene avviata verso il backend e lo stato UI passa a “scanning/running”; al termine, il modulo rilascia il lock;

- se il lock è già occupato da un altro componente, il servizio nega l’acquisizione, la UI disabilita l’azione e mostra all’utente quale scansione è in corso, eventualmente con una notifica globale.

---

**SD-EXT-GLOB-04 – Cambio tema chiaro/scuro e gestione errori di persistenza**



Descrizione (testuale):  
Questo diagramma rappresenta il flusso di cambio tema globale:

- quando l’utente usa il toggle nella barra globale, il tema viene applicato subito a tutta la UI;

- in parallelo, l’estensione prova a salvare la preferenza nello storage locale;

- se il salvataggio va a buon fine, il tema verrà riapplicato automaticamente nelle aperture successive;

- se il salvataggio fallisce (problemi di storage o permessi), il tema rimane attivo solo per la sessione corrente e l’utente viene informato tramite una notifica non bloccante.

---

**SD-EXT-GLOB-05 – Polling dello stato del Tool (backend) e aggiornamento indicatore globale**



Descrizione (testuale):  
Questo diagramma descrive il ciclo di monitoraggio dello stato del Tool/backend:

- la popup si registra presso un servizio di stato che esegue periodicamente un health-check verso il backend;

- in base alla risposta, il servizio aggiorna la UI globale con uno degli stati sintetici (“Checking”, “Tool On”, “Tool Off”);

- quando lo stato cambia in modo significativo (da On a Off o viceversa), la UI può mostrare una notifica per rendere esplicito all’utente che alcune operazioni (Analyze, Send to ontology, ecc.) potrebbero essere bloccate o di nuovo disponibili.

---

**SD-EXT-GLOB-06 – Notifiche globali non bloccanti (scenario generico)**



Descrizione (testuale):  
Questo diagramma cattura il modello comune di feedback per tutte le sezioni:

- l’utente esegue un’azione (refresh archivio, cancellazione, invio job, ecc.);

- la vista coinvolta interagisce con storage o backend;

- in caso di successo, aggiorna la UI e richiede una notifica di conferma;

- in caso di errore, richiede una notifica di avviso/errore, lasciando comunque la UI utilizzabile;

- le notifiche sono di tipo non bloccante (snackbar/toast) e scompaiono automaticamente dopo un intervallo breve.

---
