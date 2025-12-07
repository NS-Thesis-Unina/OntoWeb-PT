# Analyzer - Requisiti Funzionali
---

**FR-EXT-AN-01 – Navigazione interna alla sezione Analyzer**

L’utente deve poter accedere, dalla sezione “Analyzer”, alle quattro modalità operative:
- One-Time Scan
- Runtime Scan
- Analyze
- Archive

Tramite una barra di navigazione dedicata, sempre visibile nell’intestazione della sezione Analyzer.

Il pulsante corrispondente alla modalità corrente deve risultare disabilitato o comunque evidenziare in modo chiaro quale sottosezione è attiva, così che l’utente sappia sempre se sta lavorando su una scansione one-shot, su una runtime, sul flusso di analisi o sulla consultazione dell’archivio.

---

**FR-EXT-AN-02 – Sotto-navigazione Analyze (One-Time / Runtime)**

All’interno della sottosezione “Analyze” di Analyzer, l’utente deve poter scegliere in modo esplicito se analizzare:
- risultati di One-Time Scan;
- risultati di Runtime Scan.

La UI deve:
- presentare una sotto-navigazione a schede/pulsanti (“One-Time Scan”, “Runtime Scan”);
- disabilitare la scheda relativa alla vista già attiva;
- considerare, in assenza di sottopercorsi più specifici, la modalità “One-Time Scan” come default per la route “Analyze”.

---

**FR-EXT-AN-03 – Sotto-navigazione Archive (One-Time / Runtime)**

All’interno della sottosezione “Archive” di Analyzer, l’utente deve poter scegliere tra:
- archivio delle One-Time Scan;
- archivio delle Runtime Scan.

La UI deve:
- mostrare due pulsanti/schede (“One-Time Scan”, “Runtime Scan”);
- disabilitare la voce corrispondente alla vista corrente;
- usare l’archivio One-Time come default quando l’utente apre “Archive” senza specificare il tipo di archivio.

---

**FR-EXT-AN-04 – Avvio One-Time Scan Analyzer sulla scheda corrente**

Dalla sottosezione “One-Time Scan” di Analyzer, l’utente deve poter avviare una scansione one-shot della pagina aperta nella scheda del browser corrente. La UI deve:
- identificare automaticamente la scheda attiva senza richiedere input aggiuntivi (URL o tabId);
- indicare chiaramente quando una scansione è in corso (stato “scanning”, pulsante disabilitato e testo di avanzamento);
- gestire il caso in cui non sia disponibile alcuna scheda attiva (es. nessuna tab trovata) mostrando un messaggio di errore chiaro;
- in caso di errore di avvio o durante l’elaborazione, mostrare un feedback esplicito che inviti l’utente a riprovare.

---

**FR-EXT-AN-05 – Caricamento automatico dell’ultimo risultato One-Time Analyzer**

Quando l’utente apre la sottosezione “One-Time Scan” di Analyzer, l’estensione deve tentare di caricare automaticamente l’ultimo risultato disponibile, seguendo una gerarchia di priorità:
1. ultimo risultato associato alla scheda corrente (sessione per tab);
2. ultimo risultato di sessione globale (per Analyzer One-Time);
3. ultimo risultato persistente archiviato localmente (storico One-Time Analyzer).

Se un risultato viene trovato, l’utente deve:
- vederlo immediatamente visualizzato senza dover lanciare una nuova scansione;
- ricevere un breve messaggio che indichi la provenienza (sessione per tab, sessione globale, archivio locale);
- poter comunque eseguire una nuova scansione, che andrà a sovrascrivere il contesto di lavoro corrente.

---

**FR-EXT-AN-06 – Rispetto del lock globale di scansione per One-Time Analyzer**

Prima di avviare una nuova One-Time Scan Analyzer, l’estensione deve verificare lo stato del lock globale di scansione:
- se il lock è libero o già posseduto dalla modalità One-Time di Analyzer, la scansione può essere avviata;
- se il lock è posseduto da un’altra funzionalità (Technology Stack, Runtime Analyzer, Interceptor, ecc.), il pulsante di avvio deve risultare disabilitato e la UI deve mostrare un messaggio che indichi quale scansione è attualmente in corso (utilizzando l’etichetta associata al lock).

L’utente deve percepire che la funzionalità One-Time di Analyzer è coordinata con le altre e non può essere eseguita in conflitto con altre scansioni attive.

---

**FR-EXT-AN-07 – Rilascio automatico del lock One-Time Analyzer a fine scansione**

Al termine di una One-Time Scan Analyzer, sia in caso di successo che di errore, il lock globale detenuto da questa funzionalità deve essere rilasciato automaticamente, così da:
- consentire all’utente di avviare subito nuove scansioni (Analyzer, Techstack o Interceptor);
- evitare situazioni di blocco permanente in cui i pulsanti restano disabilitati anche dopo la fine della scansione.

L’utente non deve mai dover intervenire manualmente per “sbloccare” il sistema.

---

**FR-EXT-AN-08 – Info Output per One-Time Analyzer (descrizione Head/Body/Stats)**

Nella sottosezione “One-Time Scan” di Analyzer deve essere presente una sezione informativa (“Info Output”) che descriva in linguaggio chiaro la struttura dei dati prodotti dalla scansione, almeno per le seguenti macro-aree:
- **Head**: title, meta, links, scripts (distinzione tra esterni e inline);
- **Body**: forms, iframes, links, immagini, audio/video, headings (h1–h6), liste;
- **Stats**: numero totale di elementi, profondità massima del DOM, conteggio dei tag.

L’obiettivo è permettere al penetration tester di capire rapidamente cosa rappresentano gli output e come possono essere usati per l’analisi tecnica e di sicurezza.

---

**FR-EXT-AN-09 – Visualizzazione strutturata dei risultati One-Time Analyzer**

Per ogni risultato One-Time Analyzer (nuovo o caricato), l’interfaccia deve presentare i dati in modo strutturato e navigabile, includendo almeno:
- metadati principali (data/ora, dominio, tabId, URL);
- sezione “Head” con:
  - title della pagina;
  - tabella dei meta (name/property, content);
  - tabella dei link (rel, href);
  - tabella degli script (informazione su inline code e src);
- sezione “Body” con tabelle separate per:
  - forms (method, action, insiemi di campi/inputs);
  - iframes (src, title);
  - links (testo e href);
  - immagini (alt, src);
  - audio e video (src, eventuali flag/attributi);
  - headings (h1–h6, con elenco di testi per ciascun livello);
  - liste (tipo di lista e contenuto degli elementi);
- sezione “Stats” con:
  - profondità del DOM;
  - numero totale di elementi;
  - mappa dei tag con relative occorrenze (tagCount).

L’utente deve poter:
- espandere/comprimere separatamente le macro-sezioni Head, Body e Stats;
- applicare un comando globale “Expand All / Collapse All” che agisca su tutte le sezioni;
- esportare l’intero risultato in JSON con un nome file che includa almeno il timestamp della scansione;
- cancellare, dove previsto, il singolo snapshot tramite un’azione dedicata con dialog di conferma.

---

**FR-EXT-AN-10 – Avvio, arresto e controllo del Runtime Scan Analyzer**

Dalla sottosezione “Runtime Scan” di Analyzer, l’utente deve poter:
- avviare una scansione runtime che monitora in continuo le pagine caricate durante la navigazione;
- interrompere esplicitamente la scansione runtime tramite lo stesso comando (pulsante Start/Stop);
- vedere in qualunque momento se la scansione runtime è in stato “RUNNING” o “STOPPED”.

Durante la richiesta di stop, l’interfaccia deve:
- indicare che è in corso l’arresto (es. overlay di attesa);
- disabilitare temporaneamente le azioni che potrebbero interferire fino alla conferma di stop.

---

**FR-EXT-AN-11 – Rispetto del lock globale di scansione per Runtime Analyzer**

Il Runtime Scan di Analyzer deve rispettare il lock globale di scansione:
- se una scansione runtime Analyzer è già attiva, il lock deve risultare posseduto da questa modalità;
- se il Runtime Scan non è attivo e un altro modulo detiene il lock, il pulsante di avvio deve essere disabilitato e deve comparire un messaggio che indica quale scansione è in corso;
- l’utente deve sempre poter arrestare una runtime Analyzer già attiva, anche se il lock è detenuto da questa stessa funzionalità.

All’avvio di una nuova sessione runtime, se non c’è un lock coerente con la situazione, la funzionalità deve acquisire il lock globale in modo trasparente per l’utente.

---

**FR-EXT-AN-12 – Pannello di stato live della Runtime Scan Analyzer**

Durante una Runtime Scan attiva, l’interfaccia deve mostrare un pannello di stato che includa almeno:
- stato corrente (RUNNING / STOPPED) con indicatore visivo;
- timestamp di inizio della sessione;
- numero di pagine uniche analizzate finora;
- numero totale di snapshot effettuati.

I contatori devono aggiornarsi in tempo reale (o quasi) man mano che vengono analizzate nuove pagine, in modo da permettere al penetration tester di percepire l’avanzamento e la copertura.

---

**FR-EXT-AN-13 – Caricamento e visualizzazione dell’ultimo run Runtime Analyzer**

Aprendo la sottosezione “Runtime Scan”, l’estensione deve:
- caricare automaticamente dai dati persistenti l’ultima sessione runtime salvata (se esiste);
- mostrare un messaggio informativo quando un run viene caricato dall’archivio;
- visualizzare, per l’ultimo run, un riepilogo comprendente:
  - orario di inizio e fine;
  - numero totale di pagine visitate;
  - numero totale di scansioni effettuate.

Per ciascuna pagina (URL) del run, l’utente deve poter espandere un blocco che contiene tutti gli snapshot della pagina, ciascuno rappresentato come un risultato One-Time Analyzer (head/body/stats), con la possibilità di esplorare i singoli passaggi di navigazione.

---

**FR-EXT-AN-14 – Archivio One-Time Analyzer organizzato per contesto**

La sezione “Archive → One-Time Scan” di Analyzer deve consentire di consultare le One-Time Scan salvate, organizzandole almeno nei seguenti gruppi:
- **Current Tab**: ultimo snapshot relativo alla scheda in cui è aperta l’estensione;
- **Other Tabs (this session)**: snapshot riferiti ad altre schede attualmente aperte nel browser;
- **Last Global Session Run**: ultimo risultato one-shot salvato a livello di sessione globale Analyzer;
- **Local Saved**: archivio persistente di snapshot storici (multipli), ordinati temporalmente (più recenti per primi).

Per ciascun gruppo l’utente deve poter:
- verificare rapidamente se sono presenti risultati (incluso il numero di elementi per “Other Tabs” e “Local Saved”);
- espandere i singoli snapshot ed esaminarli tramite la stessa UI di visualizzazione One-Time (head/body/stats).

In assenza di dati per un gruppo specifico, deve essere mostrato un messaggio esplicito (es. “No current tab snap.”).

---

**FR-EXT-AN-15 – Aggiornamento dinamico dell’archivio One-Time Analyzer**

L’archivio One-Time Analyzer deve:
- aggiornarsi automaticamente quando viene completata una nuova One-Time Scan (lo snapshot deve comparire nel gruppo pertinente senza necessità di riaprire la sezione);
- offrire un’azione di “Refresh” manuale che ricarichi tutti i gruppi da storage;
- mostrare un breve messaggio informativo quando il caricamento da storage va a buon fine o segnala un errore in caso contrario.

---

**FR-EXT-AN-16 – Cancellazione selettiva e massiva delle One-Time Scan archiviate**

Dalla sezione “Archive → One-Time Scan”, l’utente deve poter:
- cancellare un singolo snapshot dall’archivio persistente tramite un’azione dedicata associata al risultato, con dialog di conferma;
- cancellare tutti gli snapshot persistenti in un’unica operazione (“Delete All”), con:
  - conferma esplicita della natura distruttiva dell’azione;
  - ricarica automatica dell’archivio dopo la cancellazione;
  - messaggio di conferma oppure di errore.

Questi comandi devono agire sull’archivio locale (persistente) senza compromettere la stabilità della sessione in corso.

---

**FR-EXT-AN-17 – Archivio Runtime Analyzer: elenco sessioni salvate**

La sezione “Archive → Runtime Scan” di Analyzer deve mostrare tutte le sessioni runtime salvate in archivio persistente, ognuna caratterizzata da:
- timestamp di inizio (startedAt);
- timestamp di fine (stoppedAt);
- numero di pagine visitate;
- numero totale di scansioni effettuate.

Per ciascuna sessione, l’utente deve poter espandere un blocco che:
- mostra le stesse informazioni di riepilogo;
- consente di esplorare il dataset per URL e relativi snapshot tramite la UI di Runtime Scan Results (raggruppata per pagina, con le singole navigazioni renderizzate come risultati One-Time).

Se non sono presenti sessioni salvate, deve comparire un messaggio esplicito (es. “No runtime snaps.”).

---

**FR-EXT-AN-18 – Refresh e cancellazione delle sessioni Runtime archiviate**

Nell’archivio Runtime Analyzer, l’utente deve:
- poter forzare un “Refresh” manuale per ricaricare l’elenco delle sessioni da storage;
- vedere l’archivio aggiornarsi automaticamente al completamento di una nuova Runtime Scan;
- poter cancellare una singola sessione dall’archivio persistente tramite un’azione specifica sul run, con dialog di conferma;
- poter cancellare tutte le sessioni archiviate (“Delete All”) in un colpo solo, con conferma e successivo ricaricamento dell’elenco.

In entrambi i casi (singola o massiva), l’interfaccia deve dare feedback sul successo o sull’eventuale errore di cancellazione.

---

**FR-EXT-AN-19 – Workflow guidato di Analyze per One-Time Analyzer**

Nella sezione “Analyze → One-Time Scan”, l’estensione deve fornire un workflow guidato a step (stepper verticale) per inviare al backend un risultato One-Time salvato. Il flusso deve prevedere almeno:
- **Step 1 – Introduzione**: descrizione dello scopo (analisi di HTML, script, form e iframe tramite ontologia e regole per individuare potenziali vulnerabilità);
- **Step 2 – Selezione dello snapshot**: caricamento da archivio locale della lista di One-Time Scan salvate, ordinata dal risultato più recente, con per ciascuna voce:
  - data e ora;
  - tabId;
  - dominio/URL sintetico;
- **Step 3 – Review & Submit**: anteprima completa del risultato selezionato (tramite la UI One-Time Scan Results) e azione per inviare lo snapshot al backend (“Send Scan”).

L’utente deve poter tornare agli step precedenti (Back), con reset opportuno delle liste e delle selezioni quando si torna indietro.

---

**FR-EXT-AN-20 – Verifica precondizioni (stato tool + lock) per Analyze Analyzer**

Prima di permettere all’utente di proseguire negli step del flusso “Analyze” (sia One-Time che Runtime), l’estensione deve verificare:

- **Stato del backend tool**:
  - se il backend non risulta pienamente operativo (stato equivalente a “Tool Off”), la UI deve mostrare un avviso e i pulsanti “Continue” / “Send Scan” devono essere disabilitati;

- **Stato del lock globale di scansione**:
  - se un’altra scansione (Analyzer, Techstack, Interceptor) è in corso e detiene il lock, l’interfaccia deve avvisare l’utente e bloccare l’avanzamento nel wizard di Analyze.

Solo quando il backend è operativo e nessun’altra scansione blocca il sistema, il pulsante di prosecuzione deve risultare abilitato, a condizione che sia stata effettuata la selezione richiesta dallo step corrente.

---

**FR-EXT-AN-21 – Invio snapshot One-Time Analyzer al backend e feedback di esito**

All’ultimo step del flusso “Analyze → One-Time Scan”, quando l’utente conferma l’azione di invio:
- lo snapshot selezionato (HTML, form, iframes, scripts) deve essere inviato al backend mantenendo una struttura coerente;
- l’interfaccia deve mostrare un feedback immediato sull’accettazione del job da parte del backend (job accettato/in coda vs rifiutato);
- in caso di accettazione, l’utente deve essere informato che l’analisi è stata presa in carico e che si attendono i risultati dal worker;
- in caso di rifiuto o errore di comunicazione, deve essere mostrato un messaggio chiaro che spieghi che il backend non ha accettato la richiesta o che si è verificato un problema.

---

**FR-EXT-AN-22 – Monitoraggio e riepilogo job di Analyze One-Time**

Per i job generati dal flusso “Analyze → One-Time Scan”, l’estensione deve presentare un riepilogo sintetico in un dialog dedicato (“Job Summaries”), che includa per ciascun job almeno:
- identificativo del job;
- coda di appartenenza (es. coda Analyzer);
- stato di completamento (completed / failed / in corso).

Il dialog deve:
- aggiornarsi automaticamente man mano che arrivano eventi dal backend o dalle interrogazioni di polling;
- smettere di interrogare il backend quando tutti i job monitorati risultano completati o falliti;
- offrire un’azione di reset che chiuda il dialog, annulli le sottoscrizioni ai job e riporti il wizard allo stato iniziale, consentendo di avviare una nuova analisi.

---

**FR-EXT-AN-23 – Workflow guidato di Analyze per Runtime Analyzer (run, pagina, snapshot)**

Nella sezione “Analyze → Runtime Scan”, l’estensione deve guidare l’utente in un flusso a step per selezionare un singolo snapshot, derivato da una sessione runtime, da inviare al backend. Il flusso deve prevedere almeno:
- **Step 1 – Introduzione**: spiegazione dell’analisi di snapshot presi da run runtime (HTML, script, form, iframe) rispetto all’ontologia;
- **Step 2 – Selezione del run**: elenco delle sessioni runtime salvate (con data di inizio/fine, pagine e scansioni) da cui scegliere il run di interesse;
- **Step 3 – Selezione della pagina**: elenco delle pagine (URL) incluse nel run scelto, con indicazione del numero di snapshot disponibili per ogni URL;
- **Step 4 – Selezione dello snapshot**: elenco degli snapshot per la pagina selezionata, ciascuno esplorabile tramite una vista One-Time (head/body/stats) incorporata in un riquadro espandibile;
- **Step 5 – Review & Submit**: visualizzazione completa dello snapshot prescelto e azione finale di invio al backend.

Ad ogni passo, il pulsante “Continue” deve essere abilitato solo se l’utente ha effettuato una scelta valida (run, pagina, snapshot), tenendo conto anche delle precondizioni generali sullo stato del tool e del lock globale.

---

**FR-EXT-AN-24 – Invio snapshot da Runtime Analyzer al backend e Job Summaries**

Al termine del flusso “Analyze → Runtime Scan”, quando l’utente invia lo snapshot selezionato:
- i dati (HTML, form, iframe, scripts) relativi a quello specifico snapshot devono essere inviati al backend con la stessa struttura usata per le One-Time Scan;
- devono valere le stesse regole di feedback di esito: conferma di accettazione/rifiuto del job, messaggi di errore in caso di problemi di comunicazione;
- il sistema deve monitorare lo stato dei job (tramite eventi e/o polling) e visualizzare un dialog “Job Summaries” analogo a quello utilizzato per la modalità One-Time, con elenco di job, stato completed/failed e possibilità di reset del flusso.

---

**FR-EXT-AN-25 – Gestione stati di caricamento, errori e feedback informativi in Analyzer**

Per tutte le sottosezioni di Analyzer (One-Time Scan, Runtime Scan, Analyze, Archive), l’estensione deve:
- mostrare uno stato di caricamento chiaro quando sta recuperando dati da storage o dal backend (es. overlay con indicatore di progresso);
- gestire in modo esplicito gli errori di lettura/scrittura su storage o i problemi di comunicazione con il backend, con messaggi comprensibili all’utente;
- utilizzare notifiche non bloccanti (es. snackbar/toast) per confermare azioni riuscite (caricamento archivi, cancellazioni, accettazione di job) o per avvisare di errori recuperabili.

In questo modo il penetration tester ha sempre visibilità sullo stato delle operazioni in corso nell’area Analyzer, senza ambiguità né blocchi silenziosi.

---
