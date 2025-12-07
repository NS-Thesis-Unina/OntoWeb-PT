# Analyzer
---
## Panoramica

Il sottosistema **Analyzer** dell’estensione si occupa di osservare e strutturare il contenuto HTML/DOM/JS delle pagine visitate dal penetration tester. Opera in due modalità principali:
- **One-Time Scan**: snapshot singolo della pagina corrente.
- **Runtime Scan**: raccolta continua di snapshot mentre l’utente naviga.

Inoltre espone:
- una sezione **Analyze**, che prende snapshot salvati (one-time o runtime) e li invia al Tool backend per l’analisi ontologica (coda `analyzer` su BullMQ);
- una sezione **Archive**, che gestisce l’archivio locale di questi snapshot.

Analyzer è organizzato in più layer cooperanti:
- **UI React** (componenti della popup/pannello)
- **Controller React** (`AnalyzerReactController`)
- **Background controller** (`AnalyzerBackgroundController`)
- **Engine** (`AnalyzerEngine`, con la logica “pesante” lato estensione)
- **Content script** iniettati nelle pagine
- Storage `browser.storage.local` / `browser.storage.session`

---

## Responsabilità principali

- Eseguire **one-time scan** di DOM/HTML/JS della pagina corrente.
- Eseguire **runtime scan** continuo mentre l’utente naviga (snapshot per ogni pagina visitata).
- Gestire la sezione **Analyze**:
  - selezione di snapshot (one-time o runtime);
  - invio di questi snapshot al Tool backend per la risoluzione ontologica (job `sast-analyze` sulla coda `analyzer`).
- Gestire la sezione **Archive**:
  - elencare gli snapshot salvati;
  - cancellare singole voci o svuotare gli archivi;
  - mantenere riferimenti “veloci” all’ultimo risultato per tab (`analyzer_lastByTab`) e globale (`analyzer_lastResult`).
- Coordinarsi con gli altri sottosistemi dell’estensione tramite il **lock globale** (`scanLock`), per evitare scansioni concorrenti incompatibili.

---

## Componenti interni

### UI React

- Componente radice `Analyzer` che ospita le sottosezioni:
  - `OneTimeScanAnalyzer`
  - `RuntimeScanAnalyzer`
  - `AnalyzeAnalyzer` (con `SendOneTimeScanAnalyzer` e `SendRuntimeScanAnalyzer`)
  - `ArchiveAnalyzer`
- Usa:
  - **React Router** (`<Outlet />`) per il routing interno;
  - **Material UI** (Button, Stepper, Dialog, Alert, ecc.) per la UI;
  - **notistack** per le notifiche;
  - il modulo `scanLock` per rispettare il lock globale durante le scansioni.

La UI si limita a orchestrare i flussi e a presentare i risultati; non esegue alcuna analisi “pesante”.

### Controller React — `AnalyzerReactController`

- Registra un listener su `browser.runtime.onMessage` e inoltra gli eventi verso i componenti React:
  - `analyzer_scanComplete`
  - `analyzer_runtimeScanUpdate`
  - `analyzer_runtimeScanComplete`
  - `analyzer_scanError`

- Espone metodi per la UI:
  - `sendStartOneTimeScan(tabId)`
  - `sendStartRuntimeScan()`, `sendStopRuntimeScan()`
  - `getScanStatus()`
  - `getLastRuntimeResults()`
  - `getLocalScanResults()`, `getAllRuntimeResults()`
  - API di delete/clear sugli archivi:
    - `deleteOneTimeResultById`, `clearAllOneTimeResults`
    - `deleteRuntimeResultById`, `clearAllRuntimeResults`

È un layer di **message passing**: non implementa analisi, solo inoltro di comandi ed eventi tra React e background.

### Background controller — `AnalyzerBackgroundController`

- È il punto di ingresso nel background per tutti i messaggi `analyzer_*` provenienti dalla UI.

- Deleghe principali verso `AnalyzerEngine`:
  - `runOneTimeScan(tabId, cb)`
  - `startRuntimeScan({ onUpdate, onComplete })`
  - `stopRuntimeScan()`
  - `getRuntimeStatus()`
  - `getLocalScanResults()`, `getLastRuntimeResults()`, `getAllRuntimeResults()`
  - `deleteOneTimeResultById`, `clearAllOneTimeResults()`
  - `deleteRuntimeResultById`, `clearAllRuntimeResults()`

- Re-invia verso la UI gli eventi:
  - `analyzer_scanComplete`
  - `analyzer_scanError`
  - `analyzer_runtimeScanUpdate`
  - `analyzer_runtimeScanComplete`

Non contiene logica di analisi, ma solo routing tra UI e engine.

### Engine — `AnalyzerEngine`

Qui vive la logica “pesante” del sottosistema:

- **Iniezione content script**:
  - One-Time:
    - verifica che l’URL della tab sia iniettabile (http/https);
    - inietta `content_script/analyzer/analyzer_onetime_injected.js`.
  - Runtime:
    - registra listener su `browser.tabs.onUpdated`;
    - all’avvenuto “complete” su URL http/https, inietta `content_script/analyzer/analyzer_runtime_injected.js`.

- **Parsing HTML via Cheerio** (`processHtml(html)`):
  - Head:
    - `title`, `meta`, `links`, `scripts` (src + inline).
  - Body:
    - forms, iframes, links, images, media (video/audio), liste, headings h1–h6.
  - Stats:
    - `totalElements`, profondità massima dell’albero DOM, `tagCount`.

- **Gestione runtime scan**:
  - stato interno:
    - `_runtimeActive`, `_runtimeStartedAt`
    - `_runtimeDataset = { url: [ { meta, results, html } ] }`
    - `_runtimeTotalScans`
  - callback:
    - `_runtimeCallbacks.onUpdate(url, totals)`
    - `_runtimeCallbacks.onComplete({ key, run })`.

- **Storage**:
  - `browser.storage.local`:
    - `analyzerResults_<timestamp>`: snapshot one-time (`{ meta, results, html }`).
    - `analyzerRuntime_<timestamp>`: run runtime completo (`{ startedAt, stoppedAt, dataset, ... }`).
    - `analyzerRuntime_lastKey`: puntatore all’ultimo run.

  - `browser.storage.session`:
    - `analyzer_lastResult`: ultimo snapshot globale one-time.
    - `analyzer_lastByTab`: mappa tabId → ultimo snapshot one-time per tab.

- **Listener da content script**:
  - `analyzer_scanResult` (one-time):
    - invocato da `analyzer_onetime_injected.js`;
    - parse HTML → salvataggio local/session → callback a `runOneTimeScan`.
  - `analyzer_runtimeScanResult` (runtime):
    - invocato da `analyzer_runtime_injected.js`;
    - se `_runtimeActive`, aggiorna dataset e chiama `onUpdate`.

- **API di cleanup/archivio**:
  - one-time:
    - `getLocalScanResults()`
    - `deleteOneTimeResultById(resultKey)`
    - `clearAllOneTimeResults()`
  - runtime:
    - `getLastRuntimeResults()`
    - `getAllRuntimeResults()`
    - `deleteRuntimeResultById(runtimeKey)`
    - `clearAllRuntimeResults()`.

### Content script

- `analyzer_onetime_injected.js`:
  - eseguito una sola volta sul tab target;
  - cattura `document.documentElement.outerHTML`;
  - invia al background:
    - `{ type: 'analyzer_scanResult', data: { html } }`.
    
- `analyzer_runtime_injected.js`:
  - eseguito a ogni reiniezione durante runtime scan;
  - cattura:
    - `html`, `location.href`, `document.title`, `Date.now()`;
  - invia al background:
    - `{ type: 'analyzer_runtimeScanResult', data: { html, url, title, timestamp } }`.

Entrambi sono volutamente **leggerissimi**: nessuna logica di parsing, solo raccolta dati in-page.

---

## Tecnologie usate

- **webextension-polyfill** (`browser`) per API cross-browser.
- **Cheerio** per il parsing HTML lato background.
- **React**, **React Router**, **Material UI**, **notistack** per la UI.
- `browser.storage.local` / `browser.storage.session` per la persistenza locale.
- Modulo condiviso **`scanLock`** per la mutua esclusione tra scansioni.
- **`toolReactController`** (lato UI) per integrazione col Tool backend nella sezione Analyze.

---

## Interfacce esposte

### UI React ↔ Background

**Comandi dalla UI verso il background:**
- `analyzer_startOneTimeScan { tabId }`
- `analyzer_startRuntimeScan`
- `analyzer_stopRuntimeScan`
- `analyzer_getScanStatus`
- `analyzer_getLocalScanResults`
- `analyzer_getLastRuntimeResults`
- `analyzer_getAllRuntimeResults`
- `analyzer_deleteOneTimeResultById { resultKey }`
- `analyzer_clearAllOneTimeResults`
- `analyzer_deleteRuntimeResultById { runtimeKey }`
- `analyzer_clearAllRuntimeResults`

**Eventi dal background verso la UI:**
- `analyzer_scanComplete { data: { meta, results, html } }`
- `analyzer_scanError { message }`
- `analyzer_runtimeScanUpdate { url, totals }`
- `analyzer_runtimeScanComplete { key, run }`

### Content script ↔ Background
- `analyzer_scanResult { html }`
- `analyzer_runtimeScanResult { html, url, title, timestamp }`

---

## Flussi di dati principali

### One-Time Scan
1. UI (`OneTimeScanAnalyzer`) acquisisce il lock (`OWNERS.ANALYZER_ONETIME`).
2. Identifica il tab attivo e invia `analyzer_startOneTimeScan { tabId }`.
3. `AnalyzerEngine.runOneTimeScan`:
   - controlla che l’URL sia http/https;
   - inietta `analyzer_onetime_injected.js`;
   - attende `analyzer_scanResult` oppure timeout.
4. Il content script invia `html` al background.
5. L’engine:
   - `processHtml(html)` → `{ meta, results }`;
   - salva `analyzerResults_<timestamp>` in local;
   - aggiorna `analyzer_lastResult` e `analyzer_lastByTab` in session;
   - invoca il callback di `runOneTimeScan`.
6. Il background emette `analyzer_scanComplete` verso la UI.
7. La UI mostra i risultati e rilascia il lock.

### Runtime Scan
1. UI (`RuntimeScanAnalyzer`) acquisisce il lock (`OWNERS.ANALYZER_RUNTIME`) e invia `analyzer_startRuntimeScan`.
2. `AnalyzerEngine.startRuntimeScan`:
   - inizializza `_runtimeDataset`, `_runtimeTotalScans`, `_runtimeStartedAt`;
   - registra listener su `browser.tabs.onUpdated`;
   - inietta `analyzer_runtime_injected.js` su tutte le tab http/https aperte.
3. Ad ogni pagina caricata:
   - il content script invia `analyzer_runtimeScanResult`;
   - l’engine aggiorna dataset e contatori;
   - chiama `onUpdate(url, totals)` → background → `analyzer_runtimeScanUpdate` verso UI.
4. Alla richiesta di stop (`analyzer_stopRuntimeScan`):
   - `AnalyzerEngine.stopRuntimeScan` costruisce un `run` con:
     - `startedAt`, `stoppedAt`, `totalScans`, `pagesCount`, `dataset`;
   - salva `analyzerRuntime_<timestamp>` e aggiorna `analyzerRuntime_lastKey`;
   - chiama `onComplete({ key, run })`.
5. Il background propaga `analyzer_runtimeScanComplete { key, run }` verso la UI e il lock viene rilasciato.

### Analyze → Invio snapshot al Tool

- **Analyze One-Time**:
  1. UI (`SendOneTimeScanAnalyzer`) carica gli snapshot one-time da local storage.
  2. L’utente ne sceglie uno; la UI estrae `{ meta, results, html }`.
  3. La UI chiama `toolReactController.analyzeOneTimeScan({ url, html, forms, iframes, scripts })`.
  4. Il Tool accoda un job BullMQ `sast-analyze` sulla coda `analyzer` e restituisce `jobId`.
  5. La UI si sottoscrive al job tramite WebSocket (`subscribeJob(jobId)`) e, in fallback, polla `getJobResult('analyzer', jobId)`, mostrando il dialog **Job Summaries**.

- **Analyze Runtime**:
  - stesso flusso, ma lo snapshot di partenza viene selezionato da un run runtime (`analyzerRuntime_*`) invece che dalla lista one-time.

---

## Dipendenze principali

- `webextension-polyfill` (`browser`)
- `cheerio` per parsing HTML
- `browser.storage.local` / `browser.storage.session`
- `scanLock` (lock globale tra Analyzer, Techstack, Interceptor)
- `toolReactController` per l’integrazione con il Tool backend
- React, React Router, Material UI, notistack per la UI

---