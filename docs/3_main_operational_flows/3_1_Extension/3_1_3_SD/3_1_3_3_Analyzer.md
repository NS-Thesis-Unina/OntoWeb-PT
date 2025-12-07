# Analyzer - Sequence Diagrams
---

**SD-EXT-AN-01 – Avvio One-Time Scan Analyzer sulla scheda corrente**

![SD-EXT-AN-01](../../../images/3_main_operational_flows/3_1_Extension/3_1_1_SD/3_1_3_3_Analyzer/SD-EXT-AN-01.png)

Descrizione (alto livello):  

Questo diagramma rappresenta il flusso completo di una One-Time Scan in Analyzer sulla scheda corrente. Quando l’utente entra nella vista One-Time, il controller prova prima a caricare automaticamente l’ultimo risultato utile (per tab, per sessione globale o dall’archivio locale) e lo mostra, indicando la provenienza. Quando l’utente avvia una nuova scansione, il controller tenta di acquisire il lock globale; se disponibile, recupera la scheda attiva, invoca il componente di scansione (content/background), salva il risultato nei vari contesti (tab, sessione, locale) e aggiorna la UI. In caso di errori (assenza di tab, problemi di scansione, lock occupato) la UI mostra messaggi espliciti e disabilita l’azione se necessario.

---

**SD-EXT-AN-02 – Runtime Scan Analyzer: avvio, stato live e stop**

![SD-EXT-AN-02](../../../images/3_main_operational_flows/3_1_Extension/3_1_1_SD/3_1_3_3_Analyzer/SD-EXT-AN-02.png)

Descrizione (alto livello):  

Questo diagramma descrive il ciclo di vita di una Runtime Scan in Analyzer. All’apertura della vista, il controller verifica se esiste una sessione runtime attiva: se sì, ripristina lo stato live; altrimenti tenta di caricare l’ultimo run salvato. Quando l’utente avvia una nuova sessione, viene acquisito il lock globale, viene creata una sessione runtime e viene avviato il componente di scansione continua. Ogni nuova pagina o snapshot genera aggiornamenti verso il manager di sessione e la UI, che mostra contatori live. Alla richiesta di stop, la UI mostra uno stato di attesa, il controller ferma il runtime scanner, chiude la sessione, salva i dati in locale, rilascia il lock e visualizza il run appena concluso.

---

**SD-EXT-AN-03 – Archivio Analyzer: caricamento, consultazione e cancellazione (One-Time e Runtime)**

![SD-EXT-AN-03](../../../images/3_main_operational_flows/3_1_Extension/3_1_1_SD/3_1_3_3_Analyzer/SD-EXT-AN-03.png)

Descrizione (alto livello):  

Questo diagramma copre il comportamento dell’archivio Analyzer sia per le One-Time che per le Runtime. All’ingresso nella vista Archive, la UI chiede al controller di caricare i dati dal local storage; i risultati vengono organizzati per contesto (per le One-Time) o come lista di sessioni (per le Runtime). L’utente può espandere gruppi e snapshot, che vengono recuperati dal dataset già caricato o, nel caso delle Runtime, tramite un caricamento lazy dei dettagli del run. Sono previsti i flussi per la cancellazione singola e massiva (Delete / Delete All), con dialog di conferma, ricarica dell’archivio e notifiche di successo o errore sia per le One-Time sia per le Runtime.

---

**SD-EXT-AN-04 – Workflow Analyze Analyzer (One-Time / Runtime) e monitoraggio job**

![SD-EXT-AN-04](../../../images/3_main_operational_flows/3_1_Extension/3_1_1_SD/3_1_3_3_Analyzer/SD-EXT-AN-04.png)

Descrizione (alto livello):  

Questo diagramma sintetizza il comportamento del wizard “Analyze” di Analyzer sia per i risultati One-Time sia per quelli derivati da sessioni Runtime. All’ingresso, il controller verifica lo stato del tool backend e del lock globale, abilitando o meno la navigazione negli step. In base alla modalità selezionata (One-Time o Runtime), vengono caricati gli elementi selezionabili dal local storage (lista di snapshot One-Time o lista di run runtime, con step successivi per pagina e snapshot). Una volta scelto lo snapshot, la UI ne mostra la preview completa e l’utente può inviarlo al backend. Prima dell’invio vengono nuovamente controllate le precondizioni; se tutto è OK, il backend accoda uno o più job di analisi e viene avviato un monitoraggio tramite il JobMonitor, che interroga il backend e aggiorna il dialog “Job Summaries” fino al completamento/fallimento di tutti i job. Alla chiusura del dialog, il wizard viene resettato per consentire un nuovo ciclo di Analyze.

---
