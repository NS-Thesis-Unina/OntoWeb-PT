# Analyzer View
---

## Ruolo

La **Analyzer View** è la vista del popup dedicata alle funzionalità di **DOM analysis** e **post-processing** degli snapshot raccolti durante la navigazione. È strutturata come un **wrapper di sezione** che:
- espone una **navigazione persistente** (tab-like) tra i moduli Analyzer;
- ospita le sotto-rotte tramite `<Outlet />`;
- mantiene coerenente il contesto UI (titolo, icona, sottosezione corrente).

Dal punto di vista funzionale, la sezione si articola in 4 sottosistemi:
- **One-Time Scan**: snapshot manuale “single-shot” della tab attiva.
- **Runtime Scan**: scansione continua mentre l’utente naviga.
- **Analyze**: invio di snapshot salvati al backend (tool) per analisi ontology-based (BullMQ/Redis).
- **Archive**: consultazione e gestione delle scansioni salvate (per categorie e per run).

---

## Stato principale

### Stato di routing e navigazione (Analyzer wrapper)

Il wrapper `Analyzer` deriva la sottosezione attiva dal `pathname` e aggiorna una label (`subsection`) per la UI di `PageNavigation`.  
I pulsanti della nav sono disabilitati tramite `selectedSubSection(pathname, ...)`, mantenendo un comportamento uniforme “tab = già selezionata”.

**Stati impliciti:**
- sottosezione corrente (derivata da URL);
- disabled state dei bottoni (derivato da URL).

### Stato funzionale ricorrente (tutte le sottoviste)

Nelle sottopagine Analyzer ricorrono pattern di stato comuni:
- `loading`/`Backdrop` per inizializzazione e fetch da storage;
- `Alert` informativi quando una feature non è eseguibile (lock o tool offline);
- risultati “restored” da storage (ripristino all’apertura del popup);
- “busy state” durante stop/start scansioni o submit verso backend.

### Stato di concorrenza: scan lock globale

Sia One-Time che Runtime (e anche le funzioni di Analyze) dipendono da uno **scan lock globale** (`scanLock`) che implementa mutual exclusion tra sottosistemi di scansione:
- acquisizione lock prima dell’avvio (`acquireLock(owner, label)`);
- rilascio al completamento/stop (`releaseLock(owner)`);
- ascolto cambiamenti (`subscribeLockChanges`) per aggiornare UI e bloccare azioni.

---

## Integrazione backend / background

### Background controller (Analyzer runtime / onetime)

La view usa un livello controller (`analyzerReactController`) come API verso background e storage. I pattern principali sono:

- **One-Time Scan**
    - start scan: `sendStartOneTimeScan(tabId)`
    - risultati/errore via eventi: `onMessage({ onScanComplete, onScanError })`
    - restore risultati (priorità):
        1. `getSessionLastResultForTab(tabId)` (session per-tab)
        2. `getSessionLastResult()` (session globale estensione)
        3. `getLocalScanResults()` (persistenza lunga, “archive”)
            
- **Runtime Scan**
    - stato live: `getScanStatus()`
    - start/stop: `sendStartRuntimeScan()` / `sendStopRuntimeScan()`
    - streaming update: `onMessage({ onRuntimeScanUpdate })`
    - completion: `onMessage({ onRuntimeScanComplete })`
    - restore ultima run: `getLastRuntimeResults()` e archivio completo via `getAllRuntimeResults()`

### Backend tool (solo modulo Analyze)

La sottosezione **Analyze** integra un “tool” backend separato (via `toolReactController`) con doppio canale:
- **polling** di health (`startPolling(5000)` + `getHealth()`)
- **WebSocket events** (`onToolUpdate`, `onJobEvent`)

La submission genera un job (BullMQ/Redis) e la UI mostra uno stato aggregato tramite:
- subscribe job: `subscribeJob(jobId)` / `unsubscribeJob(jobId)`
- tracking ibrido:
    - WS events (primario)
    - REST polling fallback su job state (`getJobResult(queue, jobId)`), per resilienza in caso di perdita eventi WS.

---

## UX conventions

Pattern UI ricorrenti nella Analyzer View:

- **Navigation coerente e persistente**
    - `PageNavigation` con titolo, icona e label di sottosezione.
    - bottoni disabilitati quando la rotta è già attiva (comportamento tab-like).

- **Loading chiaro e non invasivo**
    - `Backdrop + CircularProgress` per inizializzazione e restore da storage.
    - overlay separato per “stopping” (Runtime).
        
- **Conflitti espliciti**
    - `Alert` informativi per:
        - lock attivo da altro sottosistema (es: “Another scan is running …”)
        - tool backend offline (Analyze).
            
- **Informazioni “schema” accessibili ma non obbligatorie**
    - `Collapsible` “Info Output” per descrivere struttura Head/Body/Stats senza occupare spazio sempre.
        
- **Result viewers riusabili**
    - risultati renderizzati tramite componenti dedicati (`OneTimeScanResults`, `RuntimeScanResults`), spesso con opzioni come `titleDisabled` e azioni di delete nelle viste Archive.
        
- **Wizard guidati per analisi backend**
    - `Stepper` verticale per rendere esplicito il flusso “selezione → review → submit”.
    - “Continue” disabilitato dinamicamente in base a:
        - tool status
        - scan lock
        - selezioni richieste
        - loading state.

---

## Limiti noti

- **Dipendenza dal lifecycle del popup**: la view è progettata per ripristinare risultati e stato da storage ad ogni apertura; la UI non assume persistenza di stato React tra aperture.
- **Concorrenza vincolata al lock globale**: qualsiasi scansione in corso altrove blocca l’avvio (e in Analyze blocca la procedura se lock attivo), per evitare corse e inconsistenze.
- **Runtime Scan: ownership del lock**: se una runtime scan risulta attiva ma il lock non è allineato, il componente tenta di riallineare acquisendo ownership (meccanismo utile ma che richiede coerenza del lock lato background).
- **Analyze dipende dal backend tool**: senza tool attivo, la UI degrada correttamente (warning + disable), ma la feature è inutilizzabile.
- **Compatibilità snapshot legacy**: alcune viste (es. Archive/Analyze) includono normalizzazioni dei formati storici; ciò introduce complessità e possibili edge-case se arrivano payload incompleti o non canonici.

---