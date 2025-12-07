# Techstack - Requisiti Funzionali
---

**FR-EXT-TS-01 – Avvio scansione Technology Stack sulla scheda corrente**

L’utente deve poter avviare, dalla sottosezione “Scan” di Technology Stack, una scansione one-shot della pagina aperta nella scheda del browser corrente.  
La UI deve:
- identificare automaticamente la scheda attiva senza richiedere input aggiuntivi;
- indicare chiaramente quando una scansione è in corso (stato “scanning”, pulsante disabilitato e eventuale messaggio di avanzamento);
- in caso di errore di avvio o di esecuzione, mostrare un messaggio esplicito che inviti l’utente a riprovare o a verificare lo stato del tool.

---

**FR-EXT-TS-02 – Caricamento automatico dell’ultimo risultato disponibile**

Quando l’utente apre la sezione Technology Stack in modalità “Scan”, l’estensione deve tentare automaticamente di caricare l’ultimo risultato di scansione disponibile per il contesto corrente, seguendo una gerarchia di priorità:
1. ultimo risultato associato alla scheda corrente (sessione per tab);
2. ultimo risultato di sessione globale;
3. ultimo risultato persistente archiviato localmente.

Se un risultato viene trovato, l’utente deve:
- vederlo immediatamente visualizzato nella UI, senza dover avviare una nuova scansione;
- ricevere un breve messaggio che indica da dove è stato recuperato il risultato (sessione per tab, sessione globale, archivio locale);
- poter comunque lanciare una nuova scansione, sovrascrivendo il contesto precedente.

---

**FR-EXT-TS-03 – Rispetto del lock globale di scansione per Techstack**

Prima di avviare una nuova scansione Technology Stack, l’estensione deve verificare lo stato del lock globale di scansione:
- se il lock è libero o già posseduto dalla funzionalità Techstack One-Time, la scansione può essere avviata;
- se il lock è posseduto da un altro componente (Analyzer, Interceptor o altro), il pulsante di avvio deve risultare disabilitato e la UI deve mostrare un messaggio chiaro che indica quale scansione è attualmente in corso (utilizzando l’etichetta/label del lock).

L’utente deve percepire che esiste un coordinamento tra le varie funzioni di scansione e che non è possibile avviarne più di una incompatibile nello stesso momento.

---

**FR-EXT-TS-04 – Rilascio automatico del lock Techstack a fine scansione**

Al termine di una scansione Technology Stack (sia in caso di successo che di errore), l’estensione deve rilasciare automaticamente il lock globale posseduto dal modulo Techstack, così da:
- consentire all’utente di avviare subito altre scansioni (Techstack o di altri moduli);
- evitare situazioni di “blocco permanente” in cui i pulsanti restano disabilitati anche dopo la fine della scansione.

L’utente non deve mai essere costretto a intervenire manualmente per “sbloccare” la situazione.

---

**FR-EXT-TS-05 – Descrizione funzionale dei risultati di Techstack (Info Output)**

Nella sottosezione “Scan”, l’estensione deve fornire una sezione informativa (“Info Output”) che spieghi in linguaggio chiaro quali tipologie di dati vengono prodotte dalla scansione Technology Stack, almeno per le seguenti categorie:
- tecnologie rilevate (librerie, framework, servizi);
- Secure Headers (intestazioni HTTP di sicurezza rilevate e loro significato generale);
- WAF (Web Application Firewall / CDN identificati);
- cookies (in particolare dominio e flag HttpOnly);
- storage (contenuti di localStorage e sessionStorage);
- raw data (output grezzo per analisi approfondite).

L’obiettivo è permettere al penetration tester di capire rapidamente che cosa sta guardando e come usare le informazioni a supporto delle proprie verifiche.

---

**FR-EXT-TS-06 – Visualizzazione strutturata e navigabile dei risultati di scansione**

Per ogni risultato Techstack (nuovo o caricato), l’interfaccia deve presentare i dati in forma strutturata e suddivisa in sezioni espandibili:
- metadati principali (data/ora, dominio, tabId, URL);
- elenco delle tecnologie rilevate (nome e versione quando disponibile);
- Secure Headers con nome, descrizione e lista degli URL in cui sono stati osservati;
- WAF e servizi equivalenti;
- cookies, con griglia che evidenzi almeno nome, valore, dominio, flag HttpOnly;
- contenuti di localStorage e sessionStorage (chiave/valore);
- sezione “Raw” per visualizzare l’output completo in formato JSON navigabile.

L’utente deve poter:
- espandere/comprimere singole sezioni;
- applicare un comando globale “Expand All / Collapse All” per aprire o chiudere tutte le sezioni contemporaneamente;
- visualizzare i dati in modo coerente con il tema scelto (chiaro/scuro).

---

**FR-EXT-TS-07 – Esportazione e cancellazione di singoli risultati Techstack**

Dove appropriato (es. vista risultati, archivio):

- l’utente deve poter esportare un risultato Techstack in formato JSON tramite un’azione esplicita (es. pulsante di download), con nome file univoco che includa almeno il timestamp della scansione;

- l’utente deve poter cancellare un singolo snapshot di scansione, previa conferma tramite dialog dedicata, così da tenere l’archivio pulito e ridurre rumore.

In caso di errore nella cancellazione o esportazione, la UI deve informare chiaramente l’utente che l’operazione non è riuscita.

---

**FR-EXT-TS-08 – Archivio Techstack organizzato per contesto (tab, sessione, locale)**

La sottosezione “Archive” di Technology Stack deve permettere all’utente di consultare in modo organizzato la storia delle scansioni Techstack, suddivisa almeno in quattro gruppi:
- Current tab: ultimo snapshot relativo alla scheda corrente;
- Other tabs: snapshot delle altre schede attualmente aperte;
- Session (Global): risultato globale di sessione;
- Local: archivio persistente di scansioni (potenzialmente multiple, ordinate temporalmente).

Per ciascun gruppo l’utente deve poter:
- vedere rapidamente se sono presenti o meno dei risultati (incluso il numero di elementi per “Other tabs” e “Local”);
- espandere un singolo risultato per visualizzarlo tramite la stessa UI di ScanResults;
- cancellare i singoli risultati dal gruppo locale.

In assenza di dati per una sezione, deve essere mostrato un messaggio esplicito (es. “Current tab scan empty”).

---

**FR-EXT-TS-09 – Aggiornamento dell’archivio a seguito di nuove scansioni**

Quando viene completata una nuova scansione Techstack:
- la sezione “Archive” deve poter riflettere automaticamente la presenza del nuovo snapshot (senza richiedere di riaprire l’estensione);
- l’utente deve poter forzare un “Refresh” manuale dell’archivio tramite un’azione dedicata;
- in caso di aggiornamento andato a buon fine, l’interfaccia deve poter mostrare un breve messaggio informativo (es. “Archive loaded from storage successfully!”).

L’obiettivo è che il penetration tester trovi sempre nello storico le scansioni più recenti, senza confusione tra versioni vecchie e nuove.

---

**FR-EXT-TS-10 – Cancellazione massiva dell’archivio Techstack**

L’utente deve poter cancellare in un’unica operazione tutti gli snapshot di Techstack memorizzati nell’archivio persistente (“Local”) mediante un comando di “Delete All”, con:
- una finestra di conferma che espliciti che l’operazione è distruttiva (wipe completo dell’archivio);
- il ricaricamento automatico dell’archivio dopo la cancellazione;
- un messaggio che confermi l’avvenuta eliminazione o segnali un eventuale errore.

Questo requisito serve a permettere all’utente di ripulire il contesto tra diverse campagne di test o tra diversi clienti.

---

**FR-EXT-TS-11 – Workflow guidato per l’analisi Techstack tramite backend/ontologia**

Nella sottosezione “Analyze”, l’estensione deve fornire un workflow guidato a step (stepper) per inviare un risultato Techstack già acquisito al backend (tool/engine) per l’analisi basata su ontologia e regole:
- Step 1: presentare lo scopo generale del processo (analisi della tecnologia rispetto all’ontologia e alle potenziali vulnerabilità);
- Step 2: permettere all’utente di caricare l’elenco delle scansioni disponibili in archivio locale e di selezionarne una, con informazioni riassuntive (data, tabId, dominio);
- Step 3: mostrare in anteprima il risultato selezionato (tramite ScanResults) e offrire il comando per inviarlo al backend (“Send Scan”).

Il pulsante di prosecuzione (“Continue” / “Send Scan”) deve essere abilitato solo quando le precondizioni sono soddisfatte (tool disponibile, nessun lock di scansione attivo, snapshot selezionato dove richiesto).

---

**FR-EXT-TS-12 – Verifica precondizioni e blocchi per l’analisi Techstack**

La sottosezione “Analyze” deve verificare e rispettare le seguenti precondizioni prima di consentire il proseguimento del flusso:
- lo stato del backend tool: se non è “Tool On” (tutti i componenti “up”), la UI deve mostrare un avviso e impedire di proseguire con l’invio;
- lo stato del lock globale di scansione: se è attivo un’altra scansione in qualsiasi componente, la funzionalità di analisi deve risultare bloccata e deve essere mostrato un messaggio che spiega quale scan è attualmente in esecuzione.

In presenza di queste condizioni non soddisfatte, i pulsanti “Continue” / “Send Scan” devono risultare disabilitati.

---

**FR-EXT-TS-13 – Invio snapshot Techstack al backend e gestione esito**

Quando l’utente conferma l’ultimo step (“Send Scan”), l’estensione deve:
- inviare lo snapshot Techstack selezionato al backend, mantenendo la struttura dei risultati;
- mostrare un feedback immediato sull’accettazione o meno del job da parte del backend (job enqueued / rejected);
- in caso di accettazione, attivare il monitoraggio dello stato del job (tramite eventi in tempo reale e/o interrogazioni periodiche) e informare l’utente che si sta attendendo il risultato del worker;
- in caso di errore di invio, segnalare esplicitamente che il backend non ha accettato la scansione o che si è verificato un problema di comunicazione.

---

**FR-EXT-TS-14 – Monitoraggio e riepilogo dei job di analisi Techstack**

Per i job Techstack inviati al backend, l’estensione deve essere in grado di presentare all’utente un riepilogo sintetico dello stato dei job elaborati, includendo almeno per ciascun job:
- identificativo del job;
- coda di appartenenza (es. “techstack”);
- stato di completamento (completed / failed / in corso).

Queste informazioni devono essere visualizzate in un dialog dedicato (“Job Summaries”) che:
- si aggiorna automaticamente man mano che arrivano nuovi eventi o risposte dai servizi di polling;
- interrompe il polling quando tutti i job tracciati risultano completati o falliti;
- consente, al termine, di resettare il flusso per eseguire una nuova analisi.

In questo modo il penetration tester può verificare in modo trasparente se e come l’analisi Techstack è stata elaborata dal backend.

---
