# Interceptor View
---

## Ruolo

La **Interceptor View** è la vista del popup dedicata alla **cattura runtime del traffico** (HTTP e canali affini) dal contesto pagina, e alla successiva **selezione / ispezione / invio** dei dati verso il backend “Ontology”. La vista è strutturata come una **sezione con navigazione persistente** (wrapper `Interceptor`) che:
- espone una top navigation coerente (tab-like) tra i moduli Interceptor;
- mostra la sottosezione corrente (label dinamica) accanto al titolo;
- delega il rendering delle sotto-rotte tramite `<Outlet />`.

La sezione Interceptor è composta da 3 moduli:
- **Runtime Scan**: avvio/stop dell’intercettazione live + preview dell’ultima run.
- **Send to Ontology**: wizard per selezionare richieste da run salvate e inviarle al backend (con opzione resolver).
- **Archive**: consultazione e gestione delle run salvate (caricamento lazy del dataset completo).

---

## Stato principale

### Stato di routing e navigazione (Interceptor wrapper)

Il wrapper `Interceptor` deriva la sottosezione dalla `pathname` e aggiorna `subsection` per `PageNavigation`.

**Mappatura rotta → label:**
- `/interceptor` → `Runtime Scan` (default)
- `/interceptor/send` → `Send to Ontology`
- `/interceptor/archive` → `Archive`

I bottoni in alto sono disabilitati via `selectedSubSection(pathname, 'interceptor', ...)`, mantenendo un comportamento “tab = già selezionata”.

---

## Runtime Scan (Live Capture)

### Obiettivo

Gestisce una sessione di intercettazione runtime in background (start/stop), mostrando:
- stato live (RUNNING/STOPPED),
- contatori incrementali (pagine, eventi, bytes),
- “last run” caricata automaticamente da storage,
- risultati dettagliati delegati a `RuntimeScanResults`.

### Stato UI e dati

- `loading`: overlay iniziale per status + restore run.
- `status`: snapshot live `{ active, startedAt, totalEvents, pagesCount, totalBytes }`.
- `stopping`: overlay durante lo stop.
- `lastRun`: ultimo run completato `{ key, run }`.
- `globalLock`: snapshot del lock globale (scanLock).

### Lock globale (mutual exclusion)

Usa `scanLock` per garantire **una sola scansione alla volta** in tutta l’estensione:
- start: `acquireLock(OWNERS.INTERCEPTOR_RUNTIME, 'Interceptor Runtime')`
- stop/completion: `releaseLock(OWNERS.INTERCEPTOR_RUNTIME)`
- sync lock su mount e durante runtime: se `status.active` ma lock mancante o di altro owner, tenta acquisizione per riallineare.
- UI: `Alert` informativa se un altro componente possiede il lock e Interceptor non è attivo.

### Integrazione con background

`interceptorReactController` fornisce:
- `getStatus()` per bootstrap/refresh
- `start({...})` e `stop()` per controllo runtime
- `getLastKey()` per individuare la run più recente
- `onMessage({ onUpdate, onComplete })` per:
    - aggiornamenti incrementali (`onUpdate`)
    - completion (`onComplete`) con ricarica del run da `browser.storage.local`

### Persistenza

La run completa viene letta da `browser.storage.local` tramite la key restituita dal background (`interceptorRun_<ts>`). La vista carica automaticamente la run più recente in basso.

---

## Send to Ontology (Wizard)

### Obiettivo

Workflow guidato per:
1. selezionare una run salvata,
2. selezionare un sito/pagina (gruppo) dentro la run,
3. selezionare uno o più eventi HTTP (DataGrid con checkbox),
4. confermare e inviare al backend (GraphDB) con batch payload,
5. tracciare i job BullMQ (ingest + opzionale resolver).

### Stato tool backend e robustezza

- `toolStatus`: `tool_on` / `tool_off` derivato da health payload.
- polling: `toolReactController.startPolling(5000)` + `getHealth()`
- websocket: `onToolUpdate`, `onJobEvent`
- UI: `Alert` warning quando tool offline → stepper bloccato.

### Lock globale

Il wizard è bloccato se esiste `scanLock` attivo (un’altra scansione sta girando altrove). Mostra `Alert` dedicata e disabilita “Continue”.

### Stepper e regole “Continue disabled”

`continueDisabled` dipende da:
- tool online (`tool_on`)
- lock assente
- selezioni minime per step:
    - step scan: scan selezionata
    - step website: website selezionato
    - step requests: almeno 1 riga selezionata
    - step conferma: almeno 1 request confermata + non in invio

### Selezione richieste e UI di ispezione

Usa `DataGridSelectableInterceptor` per:
- normalizzare gli eventi in righe (colonne Method/URL/Status/Content-Type…)
- selezionare più richieste restituendo gli **oggetti originali** (`__original`)
- ispezionare row con dialog (tabs Request/Response + JSON raw + nested arrays + copy-to-clipboard)

### Invio e batching

- prepara payload: `makeBatchPayloads(selected, graphConfig, sizeLimits)`
- invia: `toolReactController.ingestHttp({ payload..., activateResolver })`
- se resolver attivo: attende e sottoscrive anche i job resolver quando presenti.

### Job tracking (ibrido WS + REST)

- WS: accumula `onJobEvent`
- subscribe: `toolReactController.subscribeJob(jobId)`
- fallback REST: `toolReactController.getJobResult('http', jobId)` (poll ogni 3s mentre dialog è aperto)
- dialog “Job Summaries”: aggrega gli eventi per `jobId` con stato `completed/failed`.

---

## Archive (Run storage browser)

### Obiettivo

Elenca tutte le run salvate in local storage, con:
- metadata iniziale (start/stop, events, pages, bytes),
- sezioni collapsible per ogni run,
- caricamento **lazy** del dataset completo solo quando una run viene espansa,
- delete singolo run e delete-all.

### Caricamento metadata + validazione

- `interceptorReactController.listRuns()` restituisce `{ key, meta }`.
- filtra:
    - sentinel `interceptorRun_lastKey`
    - chiavi non `interceptorRun_*`
    - meta incompleto (guard `hasValidMeta`).

### Lazy loading per run

Componente `RunResultsByKey`:
- legge `browser.storage.local.get(keyId)` **solo quando renderizzato/espanso**
- gestisce error state + retry
- passa `{ key, run }` a `RuntimeScanResults` per rendering uniforme.

### Azioni archivio

- refresh manuale + auto-refresh su `onComplete`
- delete all: `interceptorReactController.clearAllRuns()`
- delete singolo: `interceptorReactController.deleteRunById(interceptorRun_<timestamp>)`
- conferme via `DeleteScanDialog`.

---

## Presentazione risultati: RuntimeScanResults + CollapsibleDataGridInterceptor

### RuntimeScanResults (riusabile: runtime e archive)

- mostra metadata globali della run (start/stop/events/pages/bytes)
- raggruppa per “domainUrl” (chiavi di `run.dataset`)
- per ogni domainUrl crea righe DataGrid (`buildRows`) e usa `CollapsibleDataGridInterceptor`

### CollapsibleDataGridInterceptor (ispezione profonda)

- DataGrid paginata con colonna azioni “view details”
- dialog principale con tabs Request/Response + JSON raw
- rendering “All fields” con:
    - valori semplici + Copy
    - array di oggetti → nested DataGrid con preview item
- progettata per dataset grandi e strutture profondamente annidate.

---

## Convenzioni UX

- **Navigazione persistente** (PageNavigation): titolo, icona (`PodcastsIcon`), sottotitolo, bottoni disabilitati quando attivi.
    
- **Feedback immediato**:
    - Backdrop in caricamento e in stop
    - Snackbar informativi (load, complete, delete…)
        
- **Conflitti espliciti**:
    - Alert per lock attivo
    - Alert per backend tool offline
        
- **Documentazione in-view**:
    - Collapsible “Info Output” (runtime e archive) per schema dati.
        
- **Robustezza**:
    - validazione meta in archive
    - retry su load run
    - job tracking ibrido (WS + polling).

---

## Limiti noti

- **Dipendenza dal lock globale**: blocca start runtime e operazioni “Send to Ontology” quando un altro componente detiene il lock.
    
- **Payload potenzialmente grande**: per mitigare, Archive carica i dataset completi in modo lazy e l’invio fa batching con limiti di byte.
    
- **Affidabilità eventi job**: gli eventi WS possono arrivare tardi o mancare → per questo esiste polling REST mentre il dialog è aperto.
    
- **Varianza strutturale dei dati**: molte UI sono “defensive” e auto-derivano colonne/campi per gestire eventi con forma non uniforme.

---