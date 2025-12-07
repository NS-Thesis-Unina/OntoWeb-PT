# Interceptor
---
## Panoramica

Il sottosistema **Interceptor** dell’estensione si occupa di **osservare e strutturare il traffico HTTP/HTTPS** generato dal browser durante la navigazione.  
Lavora in modalità **runtime**: l’utente avvia una sessione di cattura, naviga l’applicazione, quindi ferma la sessione e può:
- rivedere gli eventi intercettati (richieste/risposte) direttamente nell’estensione;
- salvare più sessioni successive in un archivio locale;
- **selezionare richieste** da inviare al Tool backend (GraphDB) tramite la sezione *Send to Ontology*.

Interceptor è organizzato in più layer cooperanti:
- **UI React** (pagine Runtime Scan / Send to Ontology / Archive)
- **Controller React** (`InterceptorReactController`)
- **Background controller** (`InterceptorBackgroundController`)
- **Engine** (`InterceptorEngine`, con la logica di cattura e persistenza)
- **Content script** iniettati nelle pagine (`interceptor_injected.js` + `interceptor_page.js`)
- Storage `browser.storage.local` per le sessioni di cattura

---

## Responsabilità principali

- Eseguire una **runtime scan** del traffico HTTP/HTTPS:
  - intercettare fetch e XMLHttpRequest dal contesto pagina;
  - integrare (lato Chrome/Firefox) eventuali hook “deep” sulle API di debug/devtools.
  
- Aggregare gli eventi:
  - raggruppare le richieste/risposte per pagina/URL;
  - mantenere contatori globali (eventi, bytes, pagine uniche).

- Gestire la sezione **Archive**:
  - elencare le sessioni salvate (run runtime);
  - caricare il dettaglio completo di una singola sessione;
  - cancellare singoli run o svuotare l’archivio.

- Gestire la sezione **Send to Ontology**:
  - permettere di scegliere:
    - una sessione salvata;
    - una pagina/website all’interno della sessione;
    - un sottoinsieme di richieste;
  
  - preparare batch di richieste e inviarle al Tool backend per:
    - semplice persistenza nel grafo HTTP;
    - opzionale attivazione del resolver per la ricerca di vulnerabilità.

- Coordinarsi con gli altri sottosistemi tramite il **lock globale** (`scanLock`), per evitare scansioni concorrenti (Analyzer, Techstack, Interceptor).

---

## Componenti interni

### UI React

La UI di Interceptor è composta da tre viste principali:

- **`RuntimeScanInterceptor`**
  - avvio/stop della cattura runtime;
  - visualizzazione dello stato in tempo reale (running/stopped, eventi totali, pagine, bytes);
  - caricamento e visualizzazione dell’ultimo run completato.

- **`SendToOntologyInterceptor`**
  - wizard multi-step:
    1. selezione della sessione di cattura (run) salvata;
    2. selezione della pagina/website all’interno del run;
    3. selezione delle richieste (data grid selezionabile);
    4. conferma e invio al Tool, con opzione per attivare il resolver;
    5. visualizzazione di un riepilogo dei job (Job Summaries).

- **`ArchiveInterceptor`**
  - elenco di tutte le sessioni di cattura salvate;
  - ogni sessione è espandibile per caricare il dataset completo (lazy load da `storage.local`);
  - possibilità di cancellare un singolo run o tutti i run.

Tutte le viste sono incapsulate nel componente di sezione **`Interceptor`**, che gestisce:
- il routing interno (`/interceptor`, `/interceptor/send`, `/interceptor/archive`);
- il titolo, l’icona e la navigazione di sezione.

La UI:
- non implementa logica di cattura;
- usa `scanLock` per rispettare il lock globale;
- parla con:
  - `InterceptorReactController` per i comandi alla parte background;
  - `toolReactController` per l’invio delle richieste al Tool e il tracking dei job.

---

### Controller React — `InterceptorReactController`

È il controller usato dalla UI per dialogare con il background.
- Registra un listener su `browser.runtime.onMessage` per ricevere:
  - `interceptor_update` (aggiornamento incrementale di:
    - `startedAt`, `totalEvents`, `pagesCount`, `totalBytes`);
  - `interceptor_complete` (fine di una sessione di cattura, con chiave del run salvato).

- Espone metodi di alto livello:
  - **Controllo runtime**:
    - `start(config)` → invia `interceptor_start`;
    - `stop()` → invia `interceptor_stop`;
    - `getStatus()` → invia `interceptor_getStatus`.
  
  - **Archivio**:
    - `getLastKey()` → invia `interceptor_getLastKey`;
    - `listRuns()` → invia `interceptor_listRuns`.
  
  - **Cancellazione**:
    - `deleteRunById(runKey)` → invia `interceptor_deleteRunById`;
    - `clearAllRuns()` → invia `interceptor_clearAllRuns`.

È un **layer di messaggistica**: inoltra comandi ed eventi, senza implementare logica di cattura o parsing.

---

### Background controller — `InterceptorBackgroundController`

È il punto di ingresso nel background per tutti i messaggi `interceptor_*` provenienti dalla UI e dai content script.

- Alla partenza crea un `InterceptorEngine` e registra un listener su `browser.runtime.onMessage`.

- Per comandi UI:
  - `interceptor_start` → chiama `engine.start({ config, onUpdate, onComplete })`
    - `onUpdate` → emette `interceptor_update` verso la UI;
    - `onComplete` → emette `interceptor_complete` verso la UI.
  - `interceptor_stop` → chiama `engine.stop()` e rilancia `interceptor_complete`.
  - `interceptor_getStatus` → delega a `engine.getStatus()`.
  - `interceptor_getLastKey` → delega a `engine.getLastResults()`.
  - `interceptor_listRuns` → delega a `engine.getAllResultsMeta()`.
  - `interceptor_deleteRunById`, `interceptor_clearAllRuns` → delega alle API di archivio dell’engine.

- Per eventi di cattura dal content script:
  - `interceptor_capture { payload }` → delega a `engine.ingestCapture(payload, sender)`.

Non contiene logica di cattura o gestione dataset; funge da router tra React, engine e content script.

---

### Engine — `InterceptorEngine`

Qui vive la logica “pesante” del sottosistema Interceptor.

**Stato di sessione:**
- `_active`, `_startedAt`;
- `_dataset` strutturato come:
  - `{ pageUrl: [ { meta, request, response }, ... ] }`;
- contatori:
  - `_totalEvents`, `_totalBytes`;
- callback:
  - `_callbacks.onUpdate(totals)`
  - `_callbacks.onComplete({ key, run })`.

**Start/Stop della cattura:**
- `start({ config, onUpdate, onComplete })`:
  - inizializza stato e callback;
  - configura i **flags** di cattura:
    - tipi di eventi (HTTP, beacon, SSE, WebSocket);
    - `maxBodyBytes` (limite di bytes da catturare per request/response);
  - salva i flags in `browser.storage.local` (`interceptor_flags`) per i content script;
  - tenta di attivare, se disponibile:
    - una implementazione “deep” per Chrome (`DeepCaptureChrome`) usando le API di debug;
    - una implementazione “deep” per Firefox (`DeepCaptureFirefox`) usando le API devtools;
  - registra listener su `tabs.onUpdated` / `webNavigation` per reiniettare il content script sulle navigazioni HTTP(S);
  - inietta il content script su tutte le tab HTTP(S) già aperte;
  - emette un primo `onUpdate` con i contatori iniziali.

- `stop()`:
  - costruisce un oggetto `run` con:
    - `startedAt`, `stoppedAt`, `totalEvents`, `pagesCount`, `totalBytes`, `dataset`;
  - salva il run in `browser.storage.local` con chiave:
    - `interceptorRun_<timestamp_stop>`;
  - aggiorna il puntatore all’ultimo run (`interceptorRun_lastKey`);
  - rimuove listener e detach delle implementazioni deep;
  - chiama `onComplete({ key, runMeta })`, dove `runMeta` è il run senza dataset (solo metadati).

**Ingestione eventi:**
- `ingestCapture(payload, sender)`:
  - chiamato dal background quando arriva `interceptor_capture` dal content script;
  - costruisce un `entry`:
    - `meta` (timestamp, tabId, pageUrl);
    - `request` (url, method, headers, body, encoding, size, truncated);
    - `response` (status, headers, body, encoding, size, truncated o errori di rete);
  - aggiorna `_dataset`, `_totalEvents`, `_totalBytes`;
  - chiama `_emitUpdate()`.
- `_ingestDirect(entry, pageUrl)`:
  - stessa logica, usata anche dalle implementazioni deep (Chrome/Firefox) per scrivere eventi nel dataset.

**Storage e archivio:**
- `getLastResults()`:
  - legge da `storage.local` il puntatore `interceptorRun_lastKey` o, in fallback, il run più recente.

- `getAllResultsMeta()`:
  - ritorna solo i metadati dei run (`startedAt`, `stoppedAt`, `totalEvents`, `pagesCount`, `totalBytes`) per tutte le chiavi `interceptorRun_*`.

- API di cancellazione:
  - `deleteRunById(runKey)`:
    - rimuove un singolo run;
    - aggiorna o rimuove `interceptorRun_lastKey` se puntava a quel run.
  
  - `clearAllRuns()`:
    - rimuove tutte le chiavi `interceptorRun_*` e il puntatore `interceptorRun_lastKey`.

---

### Content script

Lato content script, Interceptor è diviso in due livelli:

1. **`interceptor_injected.js`** (content script estensione):
   - viene iniettato dal background (`executeScript`) nelle tab HTTP(S);
   - legge i **flags** da `browser.storage.local` (`interceptor_flags`);
   - inietta nel contesto pagina:
     - uno snippet che imposta `window.__owptCaptureFlags` (configurazione di cattura);
     - il file `interceptor_page.js` tramite `<script src="...">`;
   - funge da **bridge**:
     - ascolta `window.postMessage` per eventi `{ __owpt: true, type: 'owpt_intercept', payload }`;
     - inoltra ogni evento al background tramite `browser.runtime.sendMessage({ type: 'interceptor_capture', payload })`;
   - notifica al contesto pagina lo stato del bridge/flags (`owpt_bridge_ready`, `owpt_update_flags`).

1. **`interceptor_page.js`** (script “page context”):
   - vive direttamente nella pagina e modifica in modo trasparente:
     - `window.fetch`;
     - `XMLHttpRequest` (open/setRequestHeader/send);
     - (in prospettiva anche `sendBeacon`, EventSource, WebSocket, a seconda dei flags).
   
   - usa `window.__owptCaptureFlags` per:
     - decidere quali tipi di eventi abilitare (HTTP, beacon, SSE, websocket);
     - impostare `maxBodyBytes`.
   
   - per ogni richiesta intercettata:
     - costruisce un oggetto normalizzato con:
       - **Request**:
         - `url`, `method` (normalizzato), `headers`, `body`, `bodyEncoding`, `bodySize`, `truncated`;
       - **Response**:
         - `status`, `statusText`, `headers`, `body`, `bodyEncoding`, `bodySize`, `truncated` oppure errori di rete;
       - **Meta**:
         - `pageUrl`, `ts`.
     - pubblica l’evento a `window.postMessage` (`owpt_intercept`), che sarà raccolto dal content script e inoltrato al background.

Questi script sono progettati per essere **leggeri e non invasivi**: non bloccano il main thread oltre il necessario per leggere i body, e cercano di non interferire con il comportamento dell’applicazione target.

---

## Tecnologie usate

- **webextension-polyfill** (`browser`) per API cross-browser.
- API specifiche di:
  - **Chrome** (debugger / webNavigation) per la deep capture;
  - **Firefox** (devtools) tramite `DeepCaptureFirefox`.
- **React**, **React Router**, **Material UI**, **notistack** per la UI.
- `browser.storage.local` per la persistenza di:
  - flags di cattura (`interceptor_flags`);
  - run di cattura (`interceptorRun_<timestamp>`, `interceptorRun_lastKey`).
- Modulo condiviso **`scanLock`** per la mutua esclusione tra sottosistemi (Analyzer, Techstack, Interceptor).
- **`toolReactController`** per l’integrazione con il Tool backend nella sezione *Send to Ontology*.

---

## Interfacce esposte

### UI React ↔ Background
**Comandi dalla UI verso il background:**
- `interceptor_start { config }`
- `interceptor_stop`
- `interceptor_getStatus`
- `interceptor_getLastKey`
- `interceptor_listRuns`
- `interceptor_deleteRunById { runKey }`
- `interceptor_clearAllRuns`

**Eventi dal background verso la UI:**
- `interceptor_update { totals }`
  - `{ startedAt, totalEvents, pagesCount, totalBytes }`
- `interceptor_complete { key, runMeta }`
  - `runMeta` = metadati della sessione (senza dataset).

### Page / Content script ↔ Background
- `interceptor_injected.js` ↔ pagina (`interceptor_page.js`):
  - eventi `window.postMessage`:
    - `owpt_bridge_ready`, `owpt_update_flags`, `owpt_intercept`.
- `interceptor_injected.js` ↔ background:
  - `browser.runtime.sendMessage({ type: 'interceptor_capture', payload })`.

---

## Flussi di dati principali

### Runtime Scan (cattura traffico)
1. UI (`RuntimeScanInterceptor`) cerca di acquisire il lock (`OWNERS.INTERCEPTOR_RUNTIME`).

2. Se il lock è libero:
   - invia `interceptor_start { config }` (tipi di eventi + `maxBodyBytes`).
   
3. `InterceptorEngine.start`:
   - salva i flags in `storage.local`;
   - configura eventuali hook deep (Chrome/Firefox);
   - registra listener di navigazione/tab;
   - inietta `interceptor_injected.js` su tutte le tab HTTP(S).
   
4. `interceptor_injected.js`:
   - imposta `window.__owptCaptureFlags` nella pagina;
   - inietta `interceptor_page.js`;
   - notifica il bridge pronto.

5. `interceptor_page.js`:
   - wrappa `fetch` e `XMLHttpRequest`;
   - per ogni richiesta:
     - cattura request/response (rispettando `maxBodyBytes`);
     - invia `owpt_intercept` via `window.postMessage`.

6. `interceptor_injected.js`:
   - riceve `owpt_intercept`;
   - inoltra al background come `interceptor_capture`.

7. `InterceptorBackgroundController`:
   - inoltra a `InterceptorEngine.ingestCapture(payload, sender)`.
   
8. `InterceptorEngine`:
   - aggiorna dataset e contatori;
   - chiama `onUpdate(totals)` → background → `interceptor_update` verso la UI.

Alla pressione di **Stop**:

1. UI invia `interceptor_stop`.

2. `InterceptorEngine.stop`:
   - costruisce il run completo;
   - lo salva in `storage.local` (`interceptorRun_<timestamp>`, `interceptorRun_lastKey`);
   - chiama `onComplete({ key, runMeta })`.

3. Background invia `interceptor_complete { key, runMeta }` verso la UI.

4. UI:
   - ricarica l’ultimo run da `storage.local`;
   - rilascia il lock globale.

---

### Archive

1. UI (`ArchiveInterceptor`) chiama `interceptor_listRuns`.

2. Background delega a `engine.getAllResultsMeta()`:
   - ritorna una lista di `{ key, meta }`, dove `meta` contiene solo:
     - `startedAt`, `stoppedAt`, `totalEvents`, `pagesCount`, `totalBytes`.

3. Per ogni run, la UI mostra un riquadro collapsible:
   - all’apertura del collapsible, un componente figlio:
     - legge da `browser.storage.local.get(key)` il dataset completo;
     - passa `{ key, run }` al renderer condiviso (`RuntimeScanResults`).

4. L’utente può:
   - cancellare singoli run → `interceptor_deleteRunById { runKey }`;
   - cancellare tutti i run → `interceptor_clearAllRuns`.

---

### Send to Ontology

1. UI (`SendToOntologyInterceptor`) si assicura che:
   - il Tool backend sia **on** (health check via `toolReactController`);
   - non ci sia un lock attivo (nessuna runtime scan in corso).

2. Step 1 — **Scelta scansione**:
   - usa `interceptor_listRuns` + lettura dei run da `storage.local` per popolare la lista di sessioni.

3. Step 2 — **Scelta website/pagina**:
   - dall’oggetto `run.dataset` estrae i gruppi per `pageUrl`.

4. Step 3 — **Scelta richieste**:
   - visualizza gli eventi HTTP della pagina selezionata in una data grid selezionabile.

5. Step 4 — **Conferma & invio**:
   - applica `makeBatchPayloads` per spezzare le richieste selezionate in batch adatti per l’ingestione;
   - per ogni batch chiama `toolReactController.ingestHttp({ ...payload, activateResolver })`:
     - può ricevere due jobId:
       - uno per l’ingestione delle richieste nella coda `http`;
       - uno per il resolver (se attivato).
   - si sottoscrive ai job via websocket/polling (`subscribeJob`, `getJobResult`) e accumula eventi di job.

6. Una dialog **Job Summaries** mostra un riepilogo per job (queue, jobId, stato completed/failed).

---

## Dipendenze principali

- `webextension-polyfill` (`browser`)
- API di debug/devtools di Chrome/Firefox (via `DeepCaptureChrome` / `DeepCaptureFirefox`)
- `browser.storage.local` per flags e run
- `scanLock` (lock globale tra Analyzer, Techstack, Interceptor)
- `toolReactController` per invio richieste a GraphDB + resolver
- React, React Router, Material UI, notistack per la UI

---