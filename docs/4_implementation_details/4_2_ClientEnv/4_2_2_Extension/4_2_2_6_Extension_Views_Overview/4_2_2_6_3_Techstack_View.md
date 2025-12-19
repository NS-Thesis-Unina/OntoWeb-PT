# TechStack View
---

## Ruolo

La **TechStack View** è la sezione del popup dedicata all’identificazione e gestione dello **stack tecnologico** di una pagina web. Fornisce:
- una **shell di navigazione** stabile (wrapper `TechStack`);
- tre sotto-viste specializzate (**Scan**, **Analyze**, **Archive**);
- componenti di presentazione risultati (`ScanResults`) pensati per essere riusati in più contesti (scan live, preview in analyze, archivio).

A livello architetturale la UI non esegue la detection: orchestra controller e backend/engine.
- **React UI → techStackReactController → background → TechStackEngine**
- Per l’analisi ontology-based: **React UI → toolReactController → backend (resolver/analyzer)**

---

## Navigazione e routing (TechStack wrapper)

Il componente `TechStack`:
- legge la rotta corrente (`pathname`) tramite React Router;
- traduce la rotta in una label umana (`subsection`) mostrata nella top-bar;
- renderizza i pulsanti-tab con stato `disabled` quando la sezione è già attiva;
- delega la sotto-rotta con `<Outlet />`.

**Mappatura rotta → sottosezione:**
- `/techstack` → **Scan** (default)
- `/techstack/analyze` → **Analyze**
- `/techstack/archive` → **Archive**

---

## Scan (One-time TechStack scan)

### Obiettivo

Esegue un **one-time scan** dello stack della pagina corrente e visualizza i risultati. Il componente:
- tenta di **ripristinare l’ultimo risultato disponibile** (tab/session/local);
- consente di avviare una nuova scansione;
- reagisce agli eventi background (`onScanComplete`, `onScanError`);
- mostra l’output tramite `<ScanResults />`.

### Stato UI e dati

- `loading`: overlay iniziale durante il restore del risultato precedente.
- `loadSource`: origine del restore (`session_by_tab`, `session`, `local`, oppure `scan`).
- `scanning`: scan in corso (gestisce stato del bottone).
- `results`: payload normalizzato `{ meta, results }` arricchito con `domain` e `date`.
- `globalLock`: stato del lock globale.

### Lock globale (mutual exclusion)

La scansione è protetta da `scanLock` per prevenire esecuzioni concorrenti tra strumenti.

- owner: `OWNERS.TECHSTACK_ONETIME`
- start:
    - `acquireLock(OWNER, 'Techstack One-Time')`
    - se lock già occupato → snackbar warning + blocco avvio
- completion/error:
    - `releaseLock(OWNER)`
- UI:
    - `Alert` informativa quando un altro tool possiede il lock
    - bottone disabilitato se `disabledByLock || scanning`

### Restore risultato (gerarchia)

All’avvio:
1. legge `tabId` corrente (`getCurrentTabId`)
2. carica `loadLastAvailable(tabId)` che può provenire da:
    - **Tab sessionStorage**
    - **sessionStorage globale**
    - **localStorage persistente**
3. arricchisce `meta` con:
    - `domain = getDomainAccurate(meta.url)`
    - `date = formatWhen(meta.timestamp)`
4. snackbar “loaded from …” in base alla sorgente.

### Documentazione in UI

Sezione `Collapsible` “Info Output” che spiega categorie principali:
- Technologies
- SecureHeaders
- WAF
- Cookies
- Storage
- Raw

---

## Analyze (Invio scan al backend per analisi ontology-based)

### Obiettivo

Workflow guidato (Stepper) per:
1. caricare snapshot TechStack salvati in locale,
2. selezionare uno snapshot,
3. fare preview e **inviare al backend** per analisi (resolver + vulnerabilità),
4. tracciare i job BullMQ con eventi websocket e polling REST di fallback.

### Stati e vincoli globali

- `scanLock`: se esiste un lock attivo, l’analisi è bloccata (Alert + disable continue).
- `toolStatus`: `checking | tool_on | tool_off`
    - calcolato da health payload (`payload.ok` e componenti `up`)
    - polling: `toolReactController.startPolling(5000)`
    - WS: `onToolUpdate`, `onJobEvent`
    - UI: `Alert` warning quando tool offline.

### Stepper e logica “Continue”

- `activeStep` su 3 step (0..2)
- `continueDisabled` si attiva se:
    - tool off oppure lock attivo
    - step 1: nessuna scan selezionata o lista vuota o loading
- `handleNext`:
    - step 0 → `loadScansFromLocalStorage()`
    - step 2 → `sendScan()`
- `handleReset`:
    - reset stepper, pulizia eventi e unsubscribe jobs.

### Caricamento snapshot locali + normalizzazione

`loadScansFromLocalStorage()`:
- usa `techStackReactController.getLocalResults()`
- normalizza formati storici/varianti tramite `normalizeSnapshot()` in `{ meta, results }`
- ordina per timestamp decrescente (più recenti prima)
- produce lista `{ key, ts, snap }` per UI.

### Invio al backend e job tracking

`sendScan()`:

- chiama `toolReactController.analyzeTechstack({...snap.results, mainDomain: snap.meta.url})`
- se `accepted`:
    - snackbar success
    - subscribe del jobId (una sola volta) via `subscribeJob(jobId)`
- apre sempre dialog “Job Summaries” a fine invio.

**Job tracking ibrido:**
- WebSocket: accumula `jobEvents` con `onJobEvent`
- Aggregazione: `jobSummaries` per `jobId` (stato completed/failed)
- Poll REST (solo con dialog aperto):
    - `getJobResult('techstack', id)` ogni 3s
    - genera eventi sintetici `completed/failed/update`
    - rimuove job dalla lista quando terminale.

---

## Archive (Gestione snapshot salvati)

### Obiettivo

Mostra e organizza i risultati TechStack in base al contesto di storage:
- **Current tab**: ultimo scan della tab attiva (session storage per tab)
- **Other tabs**: scans di altre tab aperte
- **Session (Global)**: ultimo scan globale di sessione
- **Local**: archivio persistente cross-session

Offre azioni di:
- refresh manuale
- delete singolo snapshot
- delete-all (wipe completo)

### Stato UI e dati

- `loading`: overlay durante caricamento.
- `currentTabSnap`: snapshot normalizzato corrente.
- `otherTabsSnaps`: lista snapshot normalizzati da altre tab aperte.
- `sessionSnap`: snapshot globale.
- `localSnaps`: lista `{ key, ts, snap }` per archivio persistente.
- `openDeleteAllScans`: dialog delete-all.

### Caricamento (load)

`load()` esegue:
1. `getCurrentTabId()` per tab attiva
2. legge `browser.storage.session.get('techstack_lastByTab')` per snapshot per tab
3. filtra solo tab realmente aperte (`browser.tabs.query({})`)
4. costruisce:
    - current tab snap
    - other tabs snaps (sort per timestamp desc)
5. legge session globale: `getSessionLastResult()`
6. legge local: `getLocalResults()` + normalizzazione + sort desc
7. snackbar di successo o errore.

### Auto-refresh

Si registra a `techStackReactController.onMessage({ onScanComplete: () => load() })` per aggiornare l’archivio quando un nuovo scan termina.

### Delete

- singolo: `deleteResultById('techstackResults_<timestamp>')`
- all: `clearAllResults()`  
    Conferma via `DeleteScanDialog`.

---

## Presentazione risultati: ScanResults + componenti Collapsible

### ScanResults (renderer centrale)

È il componente che **standardizza la visualizzazione** di un risultato TechStack `{ meta, results }`.

Mostra:
- Metadata: Date, Domain, TabId, URL
- Sezioni collapsible:
    - **Technologies** (lista “name - version”)
    - **Secure Headers** (`CollapsibleSecureHeaders`)
    - **WAFs** (lista)
    - **Cookies** (`CollapsibleDataGrid` con colonne name/value/domain/httpOnly)
    - **LocalStorage** (`CollapsibleDataGrid` key/value)
    - **SessionStorage** (`CollapsibleDataGrid` key/value)
    - **Raw**: inspector JSON (react-inspector) con tema coerente (dark/light)

### Expand/Collapse All (pattern resetKey)

`ScanResults` implementa un “toggle all” che:
- aggiorna `allOpen`
- incrementa `resetKey` per forzare **remount** dei Collapsible e propagare lo stato globale.  
    Questo evita incoerenze quando alcuni collapsible mantengono stato interno.

### Azioni in testata (opzionali)

- Delete scan (con dialog) se `deleteDisable=false`
- Export JSON via `DownloadJsonButton`
- Expand/Collapse All

### CollapsibleSecureHeaders

Visualizza per ogni header:
- nome header
- descrizione
- lista URL dove è stato rilevato  
    Gestisce empty state (“No Secure Headers”).

---

## Convenzioni UX

- **Top navigation coerente** (PageNavigation): titolo “Technology Stack”, icona `LayersIcon`, sottosezione dinamica.
- **Feedback utente**:
    - snackbar per load source e fine scan
    - overlay loader su restore e su operazioni lunghe
    - alert per lock e tool offline (analyze)
- **Robustezza sui formati**:
    - normalizzazione snapshot in analyze e archive per compatibilità con versioni precedenti.
- **Sezioni ispezionabili**:
    - output diviso per categorie con collapsible + datagrid/inspector per dettagli.

---

## Limiti noti

- **Dipendenza da scanLock**: Scan e Analyze sono bloccati se un altro componente sta scansionando.
- **Tool backend richiesto in Analyze**: senza backend online l’intero workflow viene disabilitato.
- **Variabilità dei formati storici**: gestita via `normalizeSnapshot`, ma richiede attenzione quando evolve lo schema dati.
- **Aggiornamenti job non garantiti via WS**: per questo è presente polling REST quando il dialog è aperto.

---