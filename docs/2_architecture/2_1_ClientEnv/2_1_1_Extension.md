# Extension
---
- [Analyzer](./2_1_1_Extension/2_1_1_1_Analyzer.md)  
- [Techstack](./2_1_1_Extension/2_1_1_3_Techstack.md)  
- [Interceptor](./2_1_1_Extension/2_1_1_2_Interceptor.md)  
---

L’estensione browser è il principale componente client di OntoWeb-PT.  
Vive direttamente nel browser del penetration tester e ha tre responsabilità chiave:
- **Osservare** il comportamento delle applicazioni web (DOM, HTML, richieste HTTP, stack tecnologico)
- **Strutturare** queste informazioni in snapshot coerenti (scan one-shot, scan runtime, tech stack, traffico HTTP)
- **Orchestrare** l’invio di questi dati al Tool backend per l’analisi ontologica e la generazione di finding.

## Ruolo nell’ambiente client

All’interno dell’[Ambiente Client](../2_1_ClientEnv.md), l’estensione rappresenta lo strumento “vicino” all’azione: segue il tester mentre naviga l’applicazione target e gli consente di:
- catturare lo stato del DOM/HTML in momenti specifici (Analyzer One-Time) o durante tutta una sessione di navigazione (Analyzer Runtime);
- profilare lo stack tecnologico dell’applicazione (Techstack);
- intercettare e normalizzare il traffico HTTP/HTTPS generato dal browser (Interceptor);
- inviare questi dati all’Engine/Tool, dove verranno mappati sull’ontologia e arricchiti.

## Sottosistemi funzionali

L’estensione è organizzata in tre sottosistemi principali, ciascuno documentato in una sezione dedicata:

- **Analyzer**  
  Cattura e analizza la struttura HTML/DOM/JS delle pagine:
  - modalità **One-Time Scan** (snapshot singolo della pagina corrente);
  - modalità **Runtime Scan** (raccolta continua di snapshot mentre si naviga);
  - sezione **Analyze** per inviare snapshot salvati all’Engine;
  - sezione **Archive** per consultare e gestire i risultati storici.

- **Techstack**  
  Raccoglie informazioni sullo stack tecnologico dell’applicazione:
  - header HTTP, cookie, tecnologie lato client/server, eventuali WAF;
  - normalizza queste informazioni in un payload strutturato;
  - invia i dati al Tool, che li mappa sull’ontologia e produce finding di tipo *TechstackScan*.

- **Interceptor**  
  Intercetta il traffico HTTP/HTTPS generato dal browser:
  - osserva richieste e risposte (metodo, URL, header, status code, ecc.);
  - costruisce un modello normalizzato di richieste/risposte;
  - mette a disposizione questi dati per l’ingestione nel Tool (pipeline HTTP resolver).

Ogni sottosistema segue lo stesso pattern architetturale:

- **UI React** (componenti di interfaccia e wizard);
- **Background controller** dedicato (un file per sottosistema);
- **Engine** specifico, dove vive la logica “pesante” lato estensione (iniezione content script, parsing, gestione archivi);
- **Content script** (per i casi in cui serve accedere direttamente al DOM della pagina);
- **Storage** locale/session per archiviare risultati e stato.

## Layer architetturali interni

### UI React

L’interfaccia dell’estensione è implementata in React + Material UI.  
Qui vivono i componenti principali:
- la pagina **Analyzer** (con le sue sottosezioni One-Time, Runtime, Analyze, Archive),
- la pagina **Techstack**,
- la pagina **Interceptor**,
- le viste di stato, wizard, stepper e riepiloghi job (“Job Summaries”).

Questi componenti **non contengono logica di analisi pesante**; si occupano di:
- presentare lo stato corrente e gli ultimi risultati;
- orchestrare i flussi utente (start/stop scan, selezione snapshot, invio al Tool);
- dialogare con:
  - i **background controller** tramite `browser.runtime.sendMessage`;
  - il **Tool backend** tramite un controller React condiviso (es. `toolReactController`);
  - il modulo **scanLock** per coordinare le scansioni fra Analyzer, Techstack e Interceptor.

### Background scripts

Per ogni sottosistema esiste un **background controller** che:
- riceve comandi dalla UI React (es. “start One-Time scan”, “start/stop Runtime scan”, “lista archivi”, “delete”);
- delega il lavoro all’engine specifico (es. `AnalyzerEngine`);
- propaga i risultati verso tutte le UI aperte tramite `browser.runtime.sendMessage`.

Esempio (Analyzer):
- `AnalyzerBackgroundController` gestisce messaggi come:
  - `analyzer_startOneTimeScan`
  - `analyzer_startRuntimeScan` / `analyzer_stopRuntimeScan`
  - `analyzer_getScanStatus`
  - `analyzer_getLocalScanResults`
  - `analyzer_getLastRuntimeResults`
  - `analyzer_getAllRuntimeResults`
  - operazioni di delete/clear sugli archivi;
- e emette eventi verso la UI:
  - `analyzer_scanComplete`
  - `analyzer_scanError`
  - `analyzer_runtimeScanUpdate`
  - `analyzer_runtimeScanComplete`.

I controller di Techstack e Interceptor seguono lo stesso schema, con messaggi di dominio diversi.

### Content script

Quando serve accedere direttamente al DOM della pagina, l’estensione inietta content script dedicati:
- **Analyzer One-Time**
  - `analyzer_onetime_injected.js`  
    Estrae `document.documentElement.outerHTML` una sola volta e lo invia al background.

- **Analyzer Runtime**
  - `analyzer_runtime_injected.js`  
    Ogni volta che una pagina termina il caricamento (o quando il background reinietta lo script), cattura:
    - HTML completo,
    - URL,
    - titolo,
    - timestamp,
      e li manda all’engine runtime.

Questi script sono volutamente **leggerissimi**: non fanno parsing né logica complessa, si limitano a catturare l’HTML e a spedirlo.  
Techstack e Interceptor utilizzano invece le API del browser per osservare header, cookie e traffico HTTP/HTTPS, senza modificare il contenuto delle pagine.

### Integrazione con il Tool backend

L’estensione parla con il Tool tramite:
- **REST API**:
  - healthcheck (`/health`) per verificare se l’Engine è up;
  - endpoint di dominio per:
    - analisi Analyzer (`/analyzer/analyze`);
    - analisi Techstack (`/techstack/analyze`);
    - ingestione di richieste HTTP (`/http-requests/ingest-http`);
  - interrogazioni dello stato dei job e dei risultati.

- **WebSocket**:
  - stream di log in tempo reale (namespace `/logs`);
  - eventi di job (`completed`/`failed`) per ogni `jobId` (stanze `job:<jobId>`).

Questa logica è centralizzata in un controller React condiviso (es. `toolReactController`) che fornisce:
- `getHealth()`, `startPolling()`, `onMessage({ onToolUpdate, onJobEvent })`;
- `subscribeJob(jobId)` / `unsubscribeJob(jobId)`;
- `getJobResult(queue, jobId)`;
- API di dominio come `analyzeOneTimeScan(payload)`.

In questo modo Analyzer, Techstack e Interceptor condividono lo stesso meccanismo di integrazione con l’Engine.

### Coordinamento delle scansioni: scanLock

Per evitare scansioni concorrenti che potrebbero sovrapporsi o confondere l’utente, l’estensione utilizza un **lock globale**:
- modulo `scanLock` esporta:
  - `acquireLock(owner, label)`
  - `releaseLock(owner)`
  - `getLock()`
  - `subscribeLockChanges(callback)`
  - costanti `OWNERS.*` (es. `OWNERS.ANALYZER_ONETIME`, `OWNERS.ANALYZER_RUNTIME`, ...).

Ogni componente che avvia una scansione:
- prova ad acquisire il lock;
- se il lock è occupato, mostra un messaggio all’utente indicando chi sta eseguendo la scansione (`label`/`owner`);
- rilascia il lock al termine o in caso di errore.

Questo garantisce che Analyzer, Techstack e Interceptor non eseguano operazioni invasive in parallelo senza controllo.

## Flussi dati trasversali (overview)

### Esempio: Analyzer One-Time → Tool

1. Il tester apre la sezione **Analyzer → One-Time Scan**.
2. Il componente React:
   - verifica lo stato del lock globale;
   - chiama `acquireLock(OWNERS.ANALYZER_ONETIME, 'Analyzer One-Time')`.
3. Se il lock viene ottenuto:
   - identifica il tab attivo (`browser.tabs.query`);
   - invia il comando `analyzer_startOneTimeScan` al background.
4. Il **background controller**:
   - delega a `AnalyzerEngine.runOneTimeScan(tabId, callback)`;
   - l’engine inietta `analyzer_onetime_injected.js` nella pagina.
5. Il **content script**:
   - cattura `outerHTML`;
   - invia `analyzer_scanResult` al background.
6. `AnalyzerEngine`:
   - esegue il parsing HTML via Cheerio (`processHtml`);
   - salva `{ meta, results, html }` in `storage.local` + `storage.session`;
   - invoca il callback passato da `runOneTimeScan`.
7. Il background emette verso la UI:
   - `analyzer_scanComplete` con `{ meta, results, html }`.
8. Il componente React aggiorna la vista e rilascia il lock.

La sezione **Analyzer → Analyze → One-Time** permette poi di selezionare uno snapshot e di inviarlo al Tool tramite `toolReactController.analyzeOneTimeScan(...)`, seguendo lo stato del job BullMQ via WebSocket + polling.

### Esempio: Analyzer Runtime → Archive → Tool

1. Il tester avvia **Runtime Scan**:
   - `acquireLock(OWNERS.ANALYZER_RUNTIME, 'Analyzer Runtime')`;
   - `analyzer_startRuntimeScan`.
2. `AnalyzerEngine.startRuntimeScan()`:
   - azzera il dataset runtime;
   - registra un listener su `tabs.onUpdated`;
   - inietta `analyzer_runtime_injected.js` su tutte le tab HTTP(S) aperte.
3. Ogni nuova pagina caricata:
   - il content script invia `analyzer_runtimeScanResult` (html, url, title, timestamp);
   - l’engine esegue il parsing, aggiorna `_runtimeDataset` e `_runtimeTotalScans`;
   - emette `onUpdate(url, totals)` → background → UI, che mostra le metriche live.
4. Quando l’utente ferma il runtime:
   - `analyzer_stopRuntimeScan`;
   - l’engine consolida il run, lo salva come `analyzerRuntime_<timestamp>` e aggiorna `analyzerRuntime_lastKey`;
   - emette `onComplete({ key, run })`.
5. La UI mostra l’ultimo run (o lo ricarica dall’archive) e permette, tramite **Analyzer → Analyze → Runtime**, di:
   - scegliere una pagina specifica e uno snapshot;
   - inviarlo al Tool (`analyzeOneTimeScan`) con la stessa pipeline job WebSocket + polling descritta sopra.

---
