# Interceptor - Requisiti Funzionali

---

**FR-EXT-INT-01 – Navigazione interna alla sezione Interceptor**

L’utente deve poter accedere, dalla sezione “Interceptor”, alle tre modalità operative:

- Runtime Scan

- Send to ontology

- Archive

tramite una barra di navigazione dedicata, sempre visibile nella parte superiore della sezione.

Il pulsante corrispondente alla modalità corrente deve risultare disabilitato o comunque evidenziare chiaramente quale sottosezione è attiva, così che l’utente sappia sempre se sta lavorando sulla cattura runtime, sull’invio verso l’ontologia o sulla consultazione dell’archivio Interceptor.

La modalità “Runtime Scan” deve essere considerata la vista predefinita quando l’utente entra in Interceptor senza ulteriori specifiche.

---

**FR-EXT-INT-02 – Avvio e arresto della cattura runtime Interceptor**

Nella sottosezione “Runtime Scan”, l’utente deve poter:

- avviare la cattura runtime degli eventi di rete generati dal browser (in particolare chiamate HTTP/HTTPS effettuate via fetch/XMLHttpRequest, e canali speciali come sendBeacon, EventSource, WebSocket);

- arrestare esplicitamente la cattura tramite lo stesso pulsante (comportamento Start/Stop).

I requisiti sono:

- al click su “Start interceptor”, l’estensione deve richiedere l’avvio della sessione di cattura runtime per il contesto di navigazione corrente;

- al click su “Stop interceptor”, l’estensione deve richiedere l’arresto della sessione in corso, mostrando chiaramente che l’operazione è in fase di completamento (es. overlay di caricamento);

- in caso di problemi nell’avvio o nell’arresto, deve essere mostrato un messaggio esplicito che indichi l’errore e suggerisca all’utente di riprovare o di verificare lo stato del tool.

---

**FR-EXT-INT-03 – Rispetto del lock globale di scansione per Interceptor Runtime**

Prima di avviare una nuova cattura runtime Interceptor, l’estensione deve verificare lo stato del lock globale di scansione:

- se il lock è libero o già posseduto dalla funzionalità “Interceptor Runtime”, la cattura può essere avviata normalmente;

- se il lock è posseduto da un altro componente (Analyzer, Technology Stack o un’altra modalità di scansione), il pulsante di avvio deve risultare disabilitato;

- in tale caso, deve essere visualizzato un messaggio informativo che indichi chiaramente che un’altra scansione è in corso e riporti l’etichetta/descrizione della scansione che detiene il lock.

Quando la cattura runtime Interceptor è attiva:

- deve risultare chiaro che il lock globale è posseduto da Interceptor Runtime;

- l’utente deve essere comunque sempre in grado di arrestare la sessione corrente (pulsante “Stop interceptor”).

Al termine della cattura (completamento normale o errore):

- il lock globale posseduto da Interceptor Runtime deve essere rilasciato automaticamente, così da permettere l’avvio di altre scansioni.

---

**FR-EXT-INT-04 – Pannello di stato live della cattura runtime**

Durante una sessione di Runtime Scan Interceptor, l’interfaccia deve mostrare un pannello di stato che includa almeno:

- stato corrente della sessione, indicato sia testualmente (es. “RUNNING” / “STOPPED”) sia tramite un indicatore visivo (es. pill con colore differenziato);

- data e ora di avvio della sessione;

- numero di pagine uniche intercettate (unique pages);

- numero totale di eventi catturati (total events);

- totale di byte catturati nei body delle richieste/risposte, con formattazione leggibile (es. KB/MB).

Queste informazioni devono aggiornarsi in modo dinamico mentre la sessione è in esecuzione, così da fornire al penetration tester una percezione immediata dell’andamento e del volume dei dati raccolti.

---

**FR-EXT-INT-05 – Descrizione funzionale dell’output Interceptor (Info Output)**

Nella sottosezione “Runtime Scan” e nella sottosezione “Archive”, l’estensione deve fornire una sezione informativa (“Info Output”) che descriva in linguaggio chiaro la struttura dei dati prodotti da Interceptor e come sono organizzati.

Almeno le seguenti categorie devono essere spiegate:

- **Request**
  
  - url: URL assoluto della richiesta (inclusi eventuali schemi extension/http/https/ws/wss);
  
  - method: verbo HTTP o indicatore di canale/protocollo;
  
  - headers: intestazioni richieste, preservando il case originale;
  
  - body: contenuto della richiesta, in forma testuale o Base64;
  
  - bodyEncoding: modalità di codifica del body (text/base64/none);
  
  - bodySize e flag di truncation, per indicare se il body è stato tagliato oltre una certa dimensione.

- **Response**
  
  - status / statusText;
  
  - headers di risposta;
  
  - body con relativa codifica;
  
  - flag che indicano se la risposta proviene dalla cache o da un service worker.

- **Meta**
  
  - pageUrl (pagina richiedente);
  
  - tabId;
  
  - ts (timestamp dell’evento).

- **Canali speciali** (in archivio)
  
  - indicazione che gli eventi di tipologia sendBeacon, EventSource, WebSocket sono inclusi e marcati in modo riconoscibile.

- **Raggruppamento & riepilogo**
  
  - spiegazione che gli eventi sono raggruppati per dominio/pagina;
  
  - indicazione che l’intestazione del riepilogo della sessione mostra start/stop, eventi totali, numero di pagine e byte aggregati.

- **Colonne della griglia**
  
  - Method, URL, Status, Status Text, Content-Type e relative funzioni (es. troncamento intelligente, tooltip con valore completo).

L’obiettivo è permettere all’utente di comprendere rapidamente il significato dei dati visualizzati e il loro utilizzo nell’analisi del traffico applicativo.

---

**FR-EXT-INT-06 – Caricamento automatico dell’ultima sessione runtime completata**

Quando l’utente apre la sottosezione “Runtime Scan”:

- l’estensione deve tentare di caricare automaticamente l’ultima sessione Interceptor completata e salvata nello storage locale del browser;

- se tale sessione esiste, deve essere visualizzata sotto il pannello di stato, con un breve messaggio informativo che segnali il caricamento andato a buon fine (es. “Latest Interceptor run loaded from storage.”);

- in assenza di sessioni precedenti salvate, l’area dei risultati deve indicare chiaramente che non è presente alcun run da mostrare.

Quando una nuova sessione runtime viene completata:

- i risultati della sessione conclusa devono apparire automaticamente nell’area dei risultati, senza richiedere ulteriori azioni manuali;

- l’utente deve ricevere una notifica non bloccante che confermi l’avvenuto completamento e il caricamento della nuova sessione (es. “Interceptor run completed. Results loaded below.”).

---

**FR-EXT-INT-07 – Visualizzazione strutturata dei risultati di una sessione Interceptor**

Per ogni sessione runtime Interceptor (sia quella appena completata, sia quelle richiamate dall’archivio), l’interfaccia deve presentare i risultati in forma strutturata, secondo le seguenti linee:

- **Metadati di sessione**
  
  - data/ora di inizio e fine;
  
  - numero totale di eventi;
  
  - numero di pagine uniche;
  
  - totale dei byte catturati, formattato in unità comprensibili.

- **Raggruppamento per dominio/pagina**
  
  - per ogni dominio o URL di pagina, deve essere mostrata una sezione dedicata, espandibile/comprimibile, che contiene tutti gli eventi associati a quella pagina;
  
  - il titolo della sezione deve riportare l’URL o il dominio e il numero di richieste corrispondenti.

- **Tabella eventi per pagina**
  
  - per ciascuna sezione, gli eventi devono essere esposti in una tabella/griglia interattiva con almeno le colonne:
    
    - Method
    
    - URL (con troncamento e tooltip per visualizzare il valore completo)
    
    - Status
    
    - Status Text
    
    - Content-Type
  
  - la tabella deve permettere all’utente di ispezionare in dettaglio ogni riga/evento tramite un comando dedicato (es. pulsante “Show request/response details”), che apre un dialog con:
    
    - vista raw del JSON di request e response su tab separate;
    
    - elenco di tutti i campi sintetici della riga (es. dimensioni dei body, encoding, flag di cache/Service Worker);
    
    - gestione dei campi che contengono array di oggetti (es. headers, inputs) tramite una seconda tabella annidata;
    
    - possibilità di copiare singoli valori o l’intero JSON negli appunti.

- **Controllo globale di espansione**
  
  - deve essere presente un comando globale “Expand All / Collapse All” che consente di espandere o comprimere tutte le sezioni di dominio/pagina contemporaneamente.

- **Esportazione JSON e cancellazione**
  
  - l’utente deve poter esportare l’intera sessione in formato JSON tramite un’azione esplicita (es. pulsante di download), con nome file univoco che includa almeno il timestamp di inizio scansione;
  
  - dove appropriato (es. vista archivio), deve essere disponibile un’azione per cancellare la sessione specifica, con dialog di conferma.

---

**FR-EXT-INT-08 – Archivio Interceptor delle sessioni Runtime**

La sottosezione “Archive” di Interceptor deve permettere la consultazione delle sessioni runtime salvate in maniera persistente nello storage locale del browser.

I requisiti sono:

- l’utente deve vedere un elenco di tutte le sessioni salvate, ciascuna rappresentata da un riquadro riassuntivo che mostri almeno:
  
  - ora di inizio e di fine;
  
  - numero di pagine visitate;
  
  - numero totale di eventi;
  
  - totale dei byte catturati;

- ogni elemento dell’archivio deve essere espandibile tramite una sezione collassabile; all’apertura:
  
  - l’estensione deve caricare i dettagli completi della sessione (dataset completo di richieste/risposte) dallo storage locale in modo pigro (lazy loading);
  
  - mentre il caricamento è in corso, deve essere mostrato uno stato di attesa (es. spinner e testo “Loading run…”);

- in caso di errore nel caricamento del dataset completo di una sessione (es. run non trovato o problemi di lettura), deve:
  
  - essere visualizzato un messaggio di errore chiaro;
  
  - essere offerto un pulsante di “Retry” per riprovare il caricamento.

Se non sono presenti sessioni nel Runtime Archive, deve essere mostrato un messaggio esplicito (es. “No runtime runs.”).

---

**FR-EXT-INT-09 – Aggiornamento automatico e manuale dell’archivio Interceptor**

L’archivio Runtime Interceptor deve mantenersi aggiornato rispetto alle sessioni reali salvate in locale.

In particolare:

- al caricamento iniziale della sottosezione “Archive”, l’estensione deve recuperare la lista delle sessioni salvate e segnalarne il corretto caricamento con una notifica non bloccante (es. “Archive loaded from storage successfully!”) o, in caso di problemi, con un messaggio di errore;

- quando una nuova sessione runtime viene completata, la lista dell’archivio deve aggiornarsi automaticamente per includere la nuova voce, senza richiedere di riaprire la sezione;

- deve essere disponibile un’azione di “Refresh” manuale che consenta all’utente di forzare il ricaricamento dell’elenco delle sessioni da storage.

---

**FR-EXT-INT-10 – Cancellazione massiva dell’archivio Runtime Interceptor**

Nella sottosezione “Archive”, l’utente deve poter cancellare tutte le sessioni runtime Interceptor salvate in locale tramite un comando dedicato (es. “Delete All Scans”).

I requisiti sono:

- l’azione deve aprire una finestra di conferma che espliciti che l’operazione è distruttiva e che comporta il wipe completo dell’archivio Interceptor;

- in caso di conferma, l’estensione deve:
  
  - cancellare tutte le sessioni dal proprio storage locale;
  
  - ricaricare automaticamente l’archivio;
  
  - notificare l’utente del successo dell’operazione (es. “All scans deleted successfully from storage.”) oppure, in caso di problemi, mostrare un messaggio di errore.

---

**FR-EXT-INT-11 – Cancellazione mirata di una singola sessione Runtime Interceptor**

Per ogni sessione elencata nell’archivio Runtime Interceptor, deve essere disponibile un’azione per cancellare solo quella specifica sessione dal storage locale.

I requisiti sono:

- l’azione deve essere accessibile all’interno della vista dettagliata della sessione (ad esempio come pulsante “Delete Scan” associato al run);

- la cancellazione deve essere protetta da una dialog di conferma;

- in caso di successo, l’archivio deve aggiornarsi automaticamente per rimuovere la sessione cancellata e l’utente deve ricevere una notifica di conferma;

- in caso di errore, deve essere mostrato un messaggio esplicito (es. “Error deleting scan from storage.”).

---

**FR-EXT-INT-12 – Workflow guidato “Send to ontology” (step di base)**

Nella sottosezione “Send to ontology”, l’estensione deve fornire un workflow guidato a step (stepper verticale) per selezionare e inviare un sottoinsieme di richieste HTTP intercettate verso l’ontologia (GraphDB) e, opzionalmente, al resolver di vulnerabilità.

Il flusso deve prevedere almeno i seguenti passi:

- **Step 1 – Introduzione (“Send requests to the ontology”)**
  
  - spiegazione sintetica dello scopo del processo: scegliere una scansione salvata, selezionare un sito/pagina all’interno di quella scansione, scegliere le richieste di interesse e inviarle all’ontologia, con opzione di analisi tramite resolver.

- **Step 2 – “Choose a scan”**
  
  - caricamento da storage locale di tutte le scansioni Runtime Interceptor salvate e rappresentazione in elenco con:
    
    - orario di inizio/fine;
    
    - numero di pagine;
    
    - numero di eventi;
    
    - totale byte catturati;
  
  - possibilità di selezionare una singola scansione da usare come sorgente dei dati.

- **Step 3 – “Choose a website”**
  
  - estrazione, dalla scansione selezionata, delle pagine/siti intercettati;
  
  - visualizzazione in elenco delle pagine, con per ciascuna:
    
    - URL della pagina;
    
    - numero di richieste registrate;
  
  - possibilità di selezionare una singola pagina/website.

- **Step 4 – “Select requests”**
  
  - visualizzazione delle richieste HTTP associate alla pagina selezionata in una tabella a griglia interattiva;
  
  - possibilità per l’utente di selezionare una o più richieste da includere nel successivo invio verso l’ontologia.

- **Step 5 – “Confirm and send”**
  
  - visualizzazione delle richieste precedentemente selezionate (nuova griglia che consente eventualmente di escludere alcune richieste);
  
  - opzione per abilitare il resolver per la ricerca di potenziali vulnerabilità;
  
  - azione finale per inviare le richieste confermate al backend.

L’utente deve poter navigare avanti (“Continue” / “Send Requests”) e indietro (“Back”) tra gli step, con il ripristino appropriato di liste e selezioni al ritorno agli step precedenti.

---

**FR-EXT-INT-13 – Precondizioni per l’utilizzo di “Send to ontology” (tool e lock)**

Prima di permettere all’utente di proseguire nel workflow “Send to ontology”, l’estensione deve verificare le seguenti precondizioni:

- **Stato del backend tool**
  
  - il backend (Tool / Engine che integra GraphDB e resolver) deve risultare operativo (“Tool On”);
  
  - se il tool è “Tool Off” o non raggiungibile, deve comparire un avviso in evidenza (es. banner di warning) che informi l’utente che il backend deve essere in esecuzione;
  
  - in tale situazione, il pulsante “Continue” / “Send Requests” deve risultare disabilitato in tutti gli step.

- **Lock globale di scansione**
  
  - se è attiva una scansione in un qualsiasi componente dell’estensione (Analyzer, Techstack, Interceptor Runtime, ecc.) e il lock globale è occupato, “Send to ontology” deve rimanere bloccato;
  
  - deve essere mostrato un messaggio che indichi che una scansione è in corso in un altro componente, con eventuale label/descrizione;
  
  - finché il lock è occupato, i pulsanti di avanzamento nella procedura devono restare disabilitati.

Solo quando:

- il backend è in stato “Tool On”;

- non è presente alcun lock di scansione attivo;

- e sono soddisfatte le condizioni specifiche di ciascun step (scansione, website e richieste selezionate, liste caricate, nessun invio in corso),

il pulsante “Continue” / “Send Requests” deve risultare abilitato.

---

**FR-EXT-INT-14 – Selezione della scansione e del website nel workflow “Send to ontology”**

Per gli step “Choose a scan” e “Choose a website” il comportamento atteso è:

- **Choose a scan**
  
  - l’estensione deve caricare dal proprio archivio locale tutte le scansioni Interceptor persistenti, filtrando eventuali voci non valide o chiavi interne non utilizzabili;
  
  - deve essere mostrato uno stato di caricamento (spinner) finché la lista non è pronta;
  
  - se non esistono scansioni idonee, deve comparire un messaggio esplicito (es. “No scans available to select.”);
  
  - al termine del caricamento, l’utente deve poter selezionare una singola scansione, identificata dal suo metadata (startedAt, stoppedAt, pagesCount, totalEvents, totalBytes), tramite checkbox o meccanismo equivalente.

- **Choose a website**
  
  - una volta scelta la scansione, l’estensione deve estrarre l’elenco delle pagine/siti presenti nel dataset di quella scansione;
  
  - finché l’elenco non è pronto, deve essere mostrato uno stato di caricamento;
  
  - se non sono presenti pagine disponibili, deve essere mostrato un messaggio esplicito (es. “No websites available to select.”);
  
  - l’utente deve poter selezionare una singola pagina, visualizzando almeno:
    
    - URL della pagina;
    
    - numero di richieste intercettate su quella pagina.

In entrambi gli step, il pulsante di avanzamento (“Continue”) deve restare disabilitato finché l’elenco è in caricamento o finché non è stata effettuata una selezione valida.

---

**FR-EXT-INT-15 – Selezione e ispezione delle richieste HTTP da inviare all’ontologia**

Negli step “Select requests” e “Confirm and send” il sistema deve offrire una tabella interattiva (griglia) per la selezione e l’ispezione delle richieste HTTP.

I requisiti sono:

- **Visualizzazione richieste**
  
  - la griglia deve mostrare, per ogni richiesta, almeno:
    
    - Method;
    
    - URL (con troncamento e tooltip per la visualizzazione completa);
    
    - Status;
    
    - Status Text;
    
    - Content-Type;

- **Selezione multipla**
  
  - l’utente deve poter selezionare più richieste contemporaneamente (es. tramite checkbox per riga);
  
  - la selezione attiva deve essere propagata allo step successivo, che permette una ulteriore conferma/rifinitura.

- **Ispezione dettagliata**
  
  - per ogni riga, deve essere disponibile un comando che apra un dialog di dettaglio con:
    
    - visualizzazione raw del JSON di request e response (tab separati);
    
    - elenco di tutti i campi sintetici associati alla riga;
    
    - gestione delle strutture annidate (array di oggetti) tramite sotto-griglie dedicate;
    
    - funzioni di copia negli appunti per i singoli campi e per i blocchi JSON.

- **Conferma finale**
  
  - nello step “Confirm and send”, la stessa griglia deve permettere di selezionare un sottoinsieme finale delle richieste da inviare (potendo eventualmente escludere alcune richieste già selezionate nello step precedente).

Il pulsante di avanzamento deve essere abilitato solo se è presente almeno una richiesta selezionata nello step corrente.

---

**FR-EXT-INT-16 – Opzione di resolver e invio dei batch di richieste all’ontologia**

All’ultimo step (“Confirm and send”), l’utente deve poter:

- visualizzare e perfezionare la lista delle richieste che saranno effettivamente inviate;

- abilitare o meno un’opzione di “resolver” per la rilevazione best-effort di potenziali vulnerabilità sulle richieste selezionate, prima dell’inserimento in GraphDB;

- avviare l’invio vero e proprio delle richieste verso il backend.

I requisiti sono:

- l’estensione deve comporre uno o più batch di richieste in base alle dimensioni dei payload, per restare entro limiti di dimensione massima ragionevoli;

- per ciascun batch inviato al backend:
  
  - deve ricevere un esito di accettazione o rifiuto del job di ingestione;
  
  - se il resolver è attivo, deve gestire anche eventuali job separati dedicati al resolver;

- al termine dell’invio, l’interfaccia deve mostrare un messaggio riepilogativo che indichi quante richieste (e, se il resolver è attivo, quanti job complessivi) sono state accettate rispetto al totale (es. “Requests accepted by the backend: X/Y. Waiting for results from the worker…”);

- in caso di errori di comunicazione o di invio, deve essere mostrato un messaggio esplicito, senza interrompere in modo irreversibile il flusso (l’utente deve poter riprovare);

- durante l’operazione di invio:
  
  - il pulsante principale deve indicare visivamente il caricamento/invio in corso;
  
  - il pulsante “Back” deve risultare disabilitato fino al termine della fase di invio.

Alla fine dell’invio, deve aprirsi automaticamente il dialog dedicato al riepilogo dei job (Job Summaries).

---

**FR-EXT-INT-17 – Monitoraggio e riepilogo dei job “Send to ontology”**

Per i job generati dal flusso “Send to ontology” (sia di ingestione delle richieste che di resolver), l’estensione deve fornire un riepilogo in tempo quasi reale tramite un dialog denominato “Job Summaries”.

I requisiti sono:

- il dialog deve elencare, per ciascun job:
  
  - identificativo del job;
  
  - coda di appartenenza (es. coda HTTP, resolver, ecc.);
  
  - stato di completamento (completed / failed / in corso);

- per ogni job deve essere mostrato un indicatore visivo (es. icona a semaforo) che segnali se il job è completato con successo, fallito o ancora in elaborazione;

- finché non sono disponibili informazioni, il dialog deve mostrare un indicatore di attesa (es. spinner);

- il sistema deve raccogliere eventi relativi ai job sia tramite notifiche push (es. websocket) sia tramite interrogazioni periodiche (polling REST), aggiornando la lista dei job ogni volta che arrivano nuove informazioni;

- quando tutti i job tracciati risultano in stato completed o failed, il sistema deve interrompere automaticamente il polling periodico, evitando richieste superflue al backend;

- premendo il pulsante “OK” nel dialog:
  
  - il flusso deve essere resettato allo stato iniziale (step introduttivo);
  
  - le sottoscrizioni ai job devono essere annullate;
  
  - le selezioni effettuate (scansioni, pagine, richieste) devono essere cancellate, in modo da permettere all’utente di avviare un nuovo ciclo di invio.

---

**FR-EXT-INT-18 – Gestione degli stati di caricamento, errori e feedback in Interceptor**

Per tutte le sottosezioni di Interceptor (Runtime Scan, Send to ontology, Archive), l’estensione deve gestire in maniera coerente:

- **Stati di caricamento**
  
  - uso di overlay o indicatori di progresso (spinner, backdrop) quando si:
    
    - carica lo stato iniziale della cattura runtime;
    
    - caricano scansioni dall’archivio;
    
    - caricano i dettagli di una singola sessione;
    
    - popolano liste di scansioni e websites nel wizard;
    
    - attendono gli esiti di invio verso l’ontologia.

- **Errori di storage o comunicazione**
  
  - segnalazione esplicita di eventuali errori nel leggere o scrivere dallo storage locale;
  
  - segnalazione di problemi di comunicazione con il backend (tool non raggiungibile, job non accettati, ecc.);
  
  - presenza, dove possibile, di azioni di recupero semplici (es. pulsanti “Retry”).

- **Notifiche non bloccanti**
  
  - uso di notifiche (snackbar/toast) per:
    
    - confermare il caricamento di un run dall’archivio;
    
    - confermare il completamento di una sessione runtime e il relativo caricamento dei risultati;
    
    - confermare la cancellazione di singole o tutte le sessioni dall’archivio;
    
    - informare l’utente su esiti positivi/negativi dell’invio verso l’ontologia;
  
  - tali notifiche non devono impedire la prosecuzione dell’attività e devono chiudersi automaticamente dopo un intervallo ragionevole.

In questo modo, il penetration tester ha sempre visibilità sullo stato delle operazioni in corso nella sezione Interceptor, senza ambiguità né blocchi silenziosi.

---
