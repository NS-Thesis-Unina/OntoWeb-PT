# Techstack

## Panoramica

Il sottosistema **Techstack** dell’estensione si occupa di **identificare e riassumere lo stack tecnologico e alcune evidenze di sicurezza** di una pagina web:

- tecnologie (librerie, framework, servizi) tramite **Wappalyzer**;

- presenza di **Web Application Firewall / CDN**;

- header di sicurezza significativi (es. HSTS, X-Content-Type-Options);

- cookie e storage (localStorage / sessionStorage);

- output “raw” per analisi più approfondite.

Opera in modalità **one-time**: l’utente lancia una singola scansione sulla tab attiva, visualizza i risultati, li archivia e, se necessario, li invia al Tool backend per la risoluzione ontologica (coda `techstack` su BullMQ).

Techstack è organizzato in più layer cooperanti:

- **UI React** (sezione Technology Stack → sottopagine Scan / Analyze / Archive)

- **Controller React** (`TechStackReactController`)

- **Background controller** (`TechStackBackgroundController`)

- **Engine** (`TechStackEngine`, con la logica “pesante” di analisi)

- **Content script** iniettato nella pagina (`techstack_injected.js`)

- Storage `browser.storage.local` / `browser.storage.session`

- Hook di background sulle API `webRequest` e `cookies` del browser

---

## Responsabilità principali

- Eseguire una **one-time scan** della tab corrente, aggregando evidenze da:
  
  - DOM / HTML / `<meta>` / `<script>`;
  
  - header HTTP di risposta;
  
  - cookie per tutti gli origin coinvolti;
  
  - localStorage / sessionStorage.

- Eseguire il **rilevamento tecnologie** e WAF tramite Wappalyzer.

- Effettuare controlli di **secure headers** (HSTS, X-Content-Type-Options, X-Powered-By, X-Frame-Options, X-XSS-Protection).

- Gestire un **archivio locale** di snapshot Techstack:
  
  - ultimo risultato per tab (`techstack_lastByTab`);
  
  - ultimo risultato globale di sessione (`techstack_lastResult`);
  
  - storico persistente (`techstackResults_<timestamp>` in `storage.local`).

- Gestire la sezione **Analyze**:
  
  - caricare le scansioni salvate;
  
  - permettere la selezione di uno snapshot;
  
  - inviare lo snapshot al Tool backend per la risoluzione in ontologia (coda `techstack`, job BullMQ);
  
  - tracciare gli eventi di job (WebSocket + fallback REST).

- Gestire la sezione **Archive**:
  
  - organizzare le scansioni per contesto (tab corrente, altre tab, sessione, archivio locale);
  
  - permettere la cancellazione singola o totale.

- Coordinarsi con gli altri sottosistemi tramite il **lock globale** (`scanLock`), per evitare scansioni concorrenti incompatibili con Analyzer e Interceptor.

---

## Componenti interni

### UI React

La sezione **Techstack** è esposta in tre sottoviste principali, incapsulate nel componente di sezione `TechStack`:

- **ScanTechStack**
  
  - Avvia una one-time scan sulla tab attiva (rispettando il `scanLock`).
  
  - Visualizza l’ultimo risultato disponibile (per tab / sessione / archivio locale) tramite un **loader a cascata**.
  
  - Mostra il risultato nel componente riutilizzabile `ScanResults`.
  
  - Espone una sezione “Info Output” che spiega i vari pannelli (Technologies, SecureHeaders, WAF, Cookies, Storage, Raw).

- **AnalyzeTechstack**
  
  - Wizard multi-step basato su `Stepper` verticale:
    
    1. Introduzione e check preliminari (Tool online + nessun lock attivo).
    
    2. Caricamento e selezione di uno snapshot Techstack da `storage.local`.
    
    3. Preview dello snapshot selezionato e invio al backend.
  
  - Usa `toolReactController` per:
    
    - health check del Tool;
    
    - invio dello snapshot (`analyzeTechstack`);
    
    - sottoscrizione agli eventi di job BullMQ;
    
    - polling di fallback sui job (`getJobResult('techstack', jobId)`).
  
  - Mostra una dialog **Job Summaries** con lo stato dei job (queue, jobId, completed / failed).

- **ArchiveTechStack**
  
  - Carica e organizza gli snapshot in quattro blocchi:
    
    - **Current tab**: ultimo snapshot della tab attiva (da `sessionStorage`);
    
    - **Other tabs**: snapshot di altre tab aperte (da `sessionStorage`);
    
    - **Session (Global)**: ultimo snapshot globale di sessione;
    
    - **Local**: lista ordinata degli snapshot persistenti in `storage.local`.
  
  - Normalizza formati legacy diversi in una forma unificata `{ meta, results }`.
  
  - Permette di:
    
    - cancellare singoli snapshot (anche dall’archivio locale);
    
    - cancellare tutte le scansioni (wipe completo di Techstack).

La UI:

- non contiene logica di analisi;

- usa `scanLock` per evitare conflitti con altri strumenti;

- riceve eventi dal background tramite `TechStackReactController`.

---

### Controller React — `TechStackReactController`

È il controller usato dalla UI per dialogare con il background.

**Listener eventi background → UI**

Registra un listener su `browser.runtime.onMessage` e dispatcha agli iscritti:

- `techstack_scanComplete { data }`

- `techstack_scanError { message }`

- `techstack_reloadRequired { data }` (eventuale segnale per richiedere un reload della pagina/UI)

La UI si registra fornendo callback opzionali:

- `onScanComplete(data)`

- `onScanError(message)`

- `onReloadRequired(data)`

**API di comando verso il background**

- Avvio scansione:
  
  - `sendStartOneTimeStackScan(tabId)` → invia `techstack_startOneTimeScan`.

- Utility:
  
  - `getCurrentTabId()` → ritorna l’ID della tab attiva nel window corrente.

**API di persistenza lato React**

- Sessione (direttamente da `browser.storage.session`):
  
  - `getSessionLastResultForTab(tabId)` → legge `techstack_lastByTab[tabId]`.
  
  - `getSessionLastResult()` → legge `techstack_lastResult`.

- Archivio locale (via background):
  
  - `getLocalResults()` → invia `techstack_getLocalResults` e riceve `{ localResults }`.

- Loader a cascata:
  
  - `loadLastAvailable(tabId)` → restituisce:
    
    - se possibile: `{ source: 'session_by_tab', data }`
    
    - altrimenti `{ source: 'session', data }`
    
    - altrimenti `{ source: 'local', data }`
    
    - oppure `{ source: 'none', data: null }`

**API di cancellazione**

- `deleteResultById(resultKey)` → invia `techstack_deleteResultById { resultKey }` e ottiene esito.

- `clearAllResults()` → invia `techstack_clearAllResults` ed elimina tutte le scansioni.

È un puro **layer di messaggistica**: non implementa alcuna logica di analisi o parsing.

---

### Background controller — `TechStackBackgroundController`

È il punto di ingresso nel background per tutti i messaggi `techstack_*` provenienti dalla UI.

All’avvio:

- crea una istanza di `TechStackEngine`;

- registra un listener su `browser.runtime.onMessage`.

**Comandi gestiti:**

- `techstack_startOneTimeScan { tabId }`
  
  - chiama `engine.runOneTimeStackScan(tabId, callback)`.
  
  - Alla fine:
    
    - su successo: invia a **tutte** le viste UI:
      
      - `techstack_scanComplete { data }`
    
    - su errore: invia:
      
      - `techstack_scanError { message }`.

- `techstack_getScanStatus`
  
  - delega a `engine.getRuntimeStatus()`; ritorna qualcosa del tipo `{ active: false, runtimeActive: false }` (non esiste runtime scan per Techstack).

- `techstack_getLocalResults`
  
  - delega a `engine.getLocalStackResults()`; ritorna `{ localResults }`.

- `techstack_getSessionLastForTab { tabId }`
  
  - delega a `engine.getSessionLastForTab(tabId)`; ritorna `{ res }`.

- `techstack_getSessionLast`
  
  - delega a `engine.getSessionLast()`; ritorna `{ res }`.

- `techstack_deleteResultById { resultKey }`
  
  - delega a `engine.deleteResultById(resultKey)`; ritorna `{ ok, info | error }`.

- `techstack_clearAllResults`
  
  - delega a `engine.clearAllResults()`; ritorna `{ ok, info | error }`.

Il background controller non contiene logica di analisi: funge solo da router tra UI, engine e (indirettamente) content script + API di rete.

---

### Engine — `TechStackEngine`

Qui vive la logica “pesante” del sottosistema Techstack.

#### 1. Aggregazione background (webRequest + origins)

Per ogni `tabId`, l’engine mantiene una struttura interna:

- `headersAgg`: mappa `headerName → insieme di valori` aggregati nel tempo.

- `requests`: lista di richieste HTML con relativi response headers (per i controlli di sicurezza).

- `origins`: set di origin (schema + host + porta) visti sul traffico della tab.

- `cookies`: campo previsto, ma i cookie vengono in pratica enumerati al volo via API `cookies.getAll`.

Queste informazioni sono popolate tramite:

- listener `chrome.webRequest.onHeadersReceived`:
  
  - per ogni risposta:
    
    - individua l’origin dalla URL e lo aggiunge a `origins`;
    
    - accumula i response headers in `headersAgg`;
    
    - salva un snapshot sintetico in `requests` (URL + lista header normalizzati).

Questi dati saranno poi consumati durante la scansione (per header, cookies, secure headers).

#### 2. Scansione one-shot `runOneTimeStackScan(tabId, callback)`

Il flusso di una one-time scan è:

1. **Preparazione sessione tab**  
   Recupera (o crea) la entry di sessione per la tab (`headersAgg`, `requests`, `origins`, …).

2. **Iniezione content script**  
   Inietta `techstack_injected.js` nella tab (via `browser.scripting.executeScript` o `browser.tabs.executeScript` a seconda del manifest).

3. **Richiesta dati DOM / META / HTML**  
   Invia un messaggio alla tab con `action: 'analyzeStack'`.  
   Il content script risponde con un payload contenente:
   
   - lista META tag (name, property, content);
   
   - lista `scriptSrc` (URL degli script esterni);
   
   - un sottoinsieme di **inline scripts** (limitati in numero e lunghezza);
   
   - HTML completo della pagina (troncato a un limite massimo per ragioni di performance);
   
   - URL della pagina (`url`);
   
   - eventuali `domFindings` (placeholder per regole DOM custom);
   
   - eventuali `jsFindings` (placeholder per regole JS custom).

4. **Normalizzazione evidenze**  
   A partire dal payload:
   
   - converte gli header aggregati in una mappa “semplice”;
   
   - costruisce una mappa delle META (`name`/`property` → lista di `content`);
   
   - concatena gli inline scripts in una stringa unica, limitando:
     
     - numero totale di script considerati;
     
     - lunghezza massima per script.

5. **Enumerazione cookie per tutti gli origin**  
   Per ogni origin visto in `origins`:
   
   - chiama `browser.cookies.getAll({ url: origin })`;
   
   - costruisce:
     
     - una mappa `cookieName → lista di valori`;
     
     - una lista “umana” di cookie (nome, dominio, valore, flag HttpOnly).

6. **Rilevamento tecnologie (Wappalyzer)**
   
   - Carica i database Wappalyzer dai JSON locali:
     
     - `technologies.json` (tecno + categorie);
     
     - `waf.json` (WAF + categorie).
   
   - Esegue il rilevamento **Tecnologie**:
     
     - resetta lo stato interno Wappalyzer con il dataset “Tech”;
     
     - invoca l’analisi passando:
       
       - headers aggregati;
       
       - mappa META;
       
       - `scriptSrc` esterni;
       
       - inline scripts concatenati;
       
       - HTML (troncato);
       
       - URL;
       
       - mappa cookie.
     
     - arricchisce i risultati con eventuali regole custom:
       
       - `domFindings` (esistenza di selettori, testo, attributi, proprietà DOM);
       
       - `jsFindings` (catene JS `window.x.y` con valori specifici).
     
     - risolve i match con `resolve`, ottenendo una lista finale di tecnologie con nome e versione.
   
   - Esegue il rilevamento **WAF**:
     
     - resetta Wappalyzer con il dataset “WAF”;
     
     - rilancia l’analisi con le stesse evidenze;
     
     - produce una lista di WAF/CDN individuati (nome + versione, se disponibile).

7. **Secure Headers**
   
   A partire da `requests` (solo risposte HTML), l’engine costruisce delle **finding** relative a:
   
   - `X-Content-Type-Options`:
     
     - mancante o valore diverso da `nosniff` → URL problematiche.
   
   - `Strict-Transport-Security` (HSTS):
     
     - mancante su risorse HTTPS → URL problematiche.
   
   - `X-Powered-By`:
     
     - presente → indica potenziale leakage di info su stack/servizio.
   
   - `X-Frame-Options`:
     
     - presente, ma header considerato deprecato.
   
   - `X-XSS-Protection`:
     
     - presente, ma header considerato deprecato.

  Il risultato è una lista strutturata di findings, ciascuna con:

- header (o famiglia di header) coinvolta;

- breve descrizione;

- lista di URL in cui è stata riscontrata la condizione.
8. **Raccolta storage (localStorage / sessionStorage)**
   
   Tramite messaggi al content script:
   
   - `action: 'dumpLocalStorage'` → riceve lista `{ key, value }`;
   
   - `action: 'dumpSessionStorage'` → stessa struttura.

9. **Costruzione risultato finale**
   
   L’engine costruisce un oggetto `results` che contiene:
   
   - `technologies`: lista di tecnologie (nome, versione).
   
   - `waf`: lista di WAF/CDN individuati.
   
   - `secureHeaders`: findings sui security header.
   
   - `cookies`: lista di cookie con dominio e flag HttpOnly.
   
   - `storage`:
     
     - `localStorage`: dump chiave/valore;
     
     - `sessionStorage`: dump chiave/valore.
   
   - `raw`: output completo Wappalyzer (risolto) per possibili analisi future.

10. **Persistenza (sessione + archivio locale)**
    
    L’engine:
    
    - genera un `timestamp` e una `metaSaved` con:
    
    - `timestamp`, `tabId`, `url`.
    
    - salva in `browser.storage.local` una entry:
    
    - chiave: `techstackResults_<timestamp>`;
    
    - valore: `{ meta: metaSaved, results }`.
    
    - aggiorna `browser.storage.session` con:
    
    - `techstack_lastResult`: ultimo snapshot globale;
    
    - `techstack_lastByTab[tabId]`: ultimo snapshot per quella tab.

11. **Callback verso il background controller**
    
    Infine invoca il `callback` passato da `TechStackBackgroundController`, con:
    
    - `meta`: `{ tabId, url, timestamp }` (timestamp corrente);
    
    - `results`: oggetto di cui sopra.

#### 3. Helper di persistenza (lettura)

- `getLocalStackResults()`
  
  - ritorna una lista di entry `{ key, results }` per tutte le chiavi `techstackResults_*` in `storage.local`.

- `getSessionLast()`
  
  - legge e ritorna `techstack_lastResult` da `storage.session`, se presente.

- `getSessionLastForTab(tabId)`
  
  - legge e ritorna `techstack_lastByTab[tabId]` da `storage.session`.

- `getRuntimeStatus()`
  
  - placeholder per eventuali futuri runtime scan; attualmente ritorna sempre `{ runtimeActive: false }`.

#### 4. API di cancellazione / cleanup

- `deleteResultById(resultKey)`
  
  - si aspetta una chiave del tipo `techstackResults_<timestamp>`;
  
  - cancella, se presenti:
    
    - l’entry nell’archivio locale (`storage.local`);
    
    - l’eventuale snapshot globale di sessione se ha lo stesso timestamp;
    
    - eventuali entry per tab in `techstack_lastByTab` con lo stesso timestamp;
  
  - ritorna un oggetto riassuntivo con quante cose sono state effettivamente rimosse.

- `clearAllResults()`
  
  - rimuove **tutte** le chiavi `techstackResults_*` da `storage.local`;
  
  - resetta `techstack_lastResult` e `techstack_lastByTab` in `storage.session`;
  
  - ritorna un riepilogo (quanti key rimossi, se sessione globale/per-tab sono state pulite).

---

### Content script — `techstack_injected.js`

È il content script iniettato nella pagina per raccogliere evidenze client-side.

Caratteristiche principali:

- Usa un flag (`window.__OWPT_TS_INJECTED__`) per evitare doppia iniezione (utile su SPA / reload).

- Vive nel contesto della pagina (non nel sandbox estensione), quindi ha pieno accesso a DOM, localStorage, sessionStorage.

- Comunica col background via `runtime.onMessage`.

**Azioni supportate:**

- `action: 'analyzeStack'`  
  Ritorna un payload con:
  
  - `meta`: lista di `<meta>` (name, property, content).
  
  - `scriptSrc`: lista URL degli script esterni.
  
  - `scripts`: elenco (limitato) di inline script, troncati in lunghezza.
  
  - `html`: HTML completo dell’intera pagina, troncato a una dimensione massima.
  
  - `url`: `location.href`.
  
  - `domFindings`: array predisposto per regole DOM custom (attualmente vuoto).
  
  - `jsFindings`: array predisposto per regole JS custom (attualmente vuoto).

- `action: 'dumpLocalStorage'`  
  Restituisce un array `{ key, value }` per tutte le entry presenti in `localStorage`.

- `action: 'dumpSessionStorage'`  
  Restituisce un array `{ key, value }` per tutte le entry presenti in `sessionStorage`.

Il content script è volutamente **leggero**: non esegue analisi Wappalyzer, né controlli di sicurezza; si limita a fornire i dati grezzi al background.

---

## Tecnologie usate

- **webextension-polyfill** (`browser`) per API cross-browser.

- **Chrome `webRequest` API** per catturare header di risposta HTTP.

- **Chrome/Firefox cookies API** (`browser.cookies.getAll`) per enumerare i cookie per origin.

- **Wappalyzer** (JS + database JSON) per il rilevamento di tecnologie e WAF.

- **React**, **React Router**, **Material UI**, **notistack** per la UI.

- `browser.storage.local` / `browser.storage.session` per la persistenza di snapshot e puntatori rapidi.

- Modulo condiviso **`scanLock`** per la mutua esclusione tra Techstack, Analyzer e Interceptor.

- **`toolReactController`** per l’integrazione col Tool backend nella sezione Analyze (coda `techstack`).

---

## Interfacce esposte

### UI React ↔ Background

**Comandi dalla UI verso il background:**

- `techstack_startOneTimeScan { tabId }`

- `techstack_getScanStatus`

- `techstack_getLocalResults`

- `techstack_getSessionLastForTab { tabId }`

- `techstack_getSessionLast`

- `techstack_deleteResultById { resultKey }`

- `techstack_clearAllResults`

**Eventi dal background verso la UI:**

- `techstack_scanComplete { data: { meta, results } }`

- `techstack_scanError { message }`

- `techstack_reloadRequired { data }` (eventuale, per future necessità di reload)

### Background ↔ Content script pagina

- Dal background alla pagina:
  
  - messaggi con `action: 'analyzeStack'`
  
  - messaggi con `action: 'dumpLocalStorage'`
  
  - messaggi con `action: 'dumpSessionStorage'`

- Dalla pagina al background:
  
  - risposte ai messaggi di cui sopra, con payload contenenti:
    
    - `{ ok: true, info: { meta, scriptSrc, scripts, html, url, domFindings, jsFindings } }`
    
    - oppure array di `{ key, value }` per gli storage dump.

### Background ↔ API di rete del browser

- `chrome.webRequest.onHeadersReceived`:
  
  - osserva tutte le risposte HTTP/HTTPS;
  
  - popola per tab:
    
    - header aggregati;
    
    - lista di richieste HTML con header;
    
    - set di origin per successiva enumerazione cookie.

---

## Flussi di dati principali

### One-Time Scan (Technology Stack)

1. UI (`ScanTechStack`) tenta di acquisire il lock globale con owner `OWNERS.TECHSTACK_ONETIME`.

2. Se il lock è libero:
   
   - legge l’ID della tab attiva (`getCurrentTabId()`);
   
   - invia `techstack_startOneTimeScan { tabId }` al background.

3. `TechStackBackgroundController` chiama `TechStackEngine.runOneTimeStackScan(tabId, callback)`.

4. L’engine:
   
   - usa le evidenze raccolte dal content script e da `webRequest`;
   
   - esegue il rilevamento Wappalyzer (Tecnologie + WAF);
   
   - calcola le finding di secure headers;
   
   - raccoglie cookie e storage;
   
   - costruisce e persiste `{ metaSaved, results }` in:
     
     - `storage.local` (`techstackResults_<timestamp>`);
     
     - `storage.session` (`techstack_lastResult`, `techstack_lastByTab[tabId]`).
   
   - chiama il callback con `{ meta, results }` (per la UI).

5. Il background emette `techstack_scanComplete { data }` verso tutte le viste React.

6. `TechStackReactController` notifica gli iscritti; `ScanTechStack`:
   
   - arricchisce i metadati con dominio e data formattata;
   
   - aggiorna lo stato `results` e mostra il pannello `ScanResults`;
   
   - notifica l’utente (snackbar);
   
   - rilascia il lock globale.

7. In caso di errore, il background emette `techstack_scanError { message }` e la UI mostra l’errore, rilasciando comunque il lock.

In aggiunta, all’**on mount**:

- `ScanTechStack` usa `loadLastAvailable(tabId)` per caricare l’ultimo risultato disponibile in cascata:
  
  - per tab → session globale → locale.

---

### Archive

1. UI (`ArchiveTechStack`) viene montata e invoca la routine di load:
   
   - identifica la tab attiva (`getCurrentTabId`);
   
   - legge da `storage.session`:
     
     - `techstack_lastByTab` → snapshot per tab (inclusa la corrente e le altre tab aperte);
     
     - `techstack_lastResult` → snapshot globale di sessione;
   
   - invoca `getLocalResults()` (via background) per ottenere l’elenco di tutte le chiavi `techstackResults_*` da `storage.local`.

2. Tutte le snapshot vengono **normalizzate** in `{ meta, results }` e ordinate per timestamp quando necessario.

3. La UI organizza i dati in 4 sezioni:
   
   - **Current Tab**: ultimo snapshot per la tab attuale.
   
   - **Other Tabs**: snapshot di altre tab ancora aperte.
   
   - **Session (Global)**: ultimo snapshot globale.
   
   - **Local**: archivio storico persistente.

4. Ogni snapshot è renderizzato tramite `ScanResults`; per le entry dell’archivio locale è possibile:
   
   - cancellare lo snapshot → chiama `deleteResultById('techstackResults_<timestamp>')`, che:
     
     - rimuove l’entry in `storage.local`;
     
     - rimuove eventuali riferimenti in `sessionStorage` con lo stesso timestamp.
   
   - cancellare **tutti** gli snapshot → chiama `clearAllResults()`, che:
     
     - pulisce tutte le chiavi `techstackResults_*`;
     
     - resetta `techstack_lastResult` e `techstack_lastByTab`.

5. `ArchiveTechStack` si iscrive anche a `onScanComplete` per ricaricare automaticamente l’archivio quando viene eseguita una nuova scan.

---

### Analyze Techstack → Invio snapshot al Tool

1. UI (`AnalyzeTechstack`) all’avvio:
   
   - interroga il Tool backend (`toolReactController.getHealth`) e inizia il polling periodico (`startPolling`);
   
   - deriva uno stato `toolStatus`:
     
     - `tool_on` se tutti i componenti risultano `up`;
     
     - `tool_off` altrimenti;
   
   - si iscrive agli eventi di:
     
     - stato del tool (`onToolUpdate`);
     
     - eventi di job BullMQ (`onJobEvent`).
   
   - sottoscrive anche ai cambiamenti di `scanLock`:
     
     - se un’altra scansione (Analyzer/Interceptor/Techstack) è in corso, mostra un warning e disabilita il tasto “Continue”.

2. **Step 0 – Introduzione**  
   L’utente preme “Continue”:
   
   - vengono caricati gli snapshot Techstack da `storage.local` tramite `getLocalResults()`;
   
   - gli snapshot sono normalizzati e ordinati per timestamp (più recenti per primi);
   
   - si passa allo step successivo.

3. **Step 1 – Selezione scan**
   
   - Viene mostrata una lista degli snapshot disponibili, con:
     
     - data (`timestamp` formattato);
     
     - `tabId` (se presente in `meta`);
     
     - dominio estratto dalla URL.
   
   - L’utente seleziona esattamente uno snapshot.
   
   - Il pulsante “Continue” è abilitato solo se:
     
     - il Tool è online;
     
     - non c’è un lock attivo;
     
     - è stato selezionato uno snapshot;
     
     - la lista non è in caricamento.

4. **Step 2 – Preview + invio**
   
   - La UI mostra il dettaglio dello snapshot selezionato tramite `ScanResults`.
   
   - Quando l’utente preme “Send Scan”:
     
     - viene invocato `toolReactController.analyzeTechstack(selectedSnap.results)`.
     
     - se la risposta del Tool indica `accepted = true`:
       
       - viene mostrata una notifica di successo;
       
       - se è presente `jobId`, viene chiamato `subscribeJob(jobId)` che:
         
         - sottoscrive gli eventi in tempo reale via WebSocket;
         
         - aggiunge il jobId alla lista interna di job tracciati.
     
     - in ogni caso viene aperta la dialog **Job Summaries**.

5. **Job Summaries e tracking job**
   
   - Ogni evento ricevuto da `toolReactController.onMessage({ onJobEvent })` viene aggiunto a `jobEvents`.
   
   - Da `jobEvents` la UI costruisce `jobSummaries` per jobId:
     
     - coda (`queue`, default `techstack`);
     
     - ultimo evento ricevuto;
     
     - flag `completed` / `failed`.
   
   - La dialog Job Summaries mostra per ogni job:
     
     - queue;
     
     - jobId;
     
     - se risulta completato o fallito;
     
     - un’icona/colore di stato.

6. **Fallback REST (polling job)**
   
   Finché la dialog Job Summaries è aperta:
   
   - a intervalli regolari, per ogni jobId ancora “aperto” viene chiamato:
     
     - `toolReactController.getJobResult('techstack', jobId)`.
   
   - Se la risposta contiene uno stato terminale (`completed` o `failed`), la UI:
     
     - sintetizza un evento (es. `event: 'completed'`);
     
     - lo aggiunge a `jobEvents`;
     
     - rimuove il jobId dall’elenco dei job che richiedono polling.

7. **Reset workflow**
   
   Quando l’utente chiude la dialog premendo “OK”:
   
   - vengono annullate le sottoscrizioni ai job (unsubscribe);
   
   - vengono svuotati `jobEvents` e `jobSummaries`;
   
   - lo stepper torna allo stato iniziale (step 0), pronto per una nuova analisi.

---

## Dipendenze principali

- `webextension-polyfill` (`browser`) per le API di estensione.

- API `chrome.webRequest` per il tracciamento degli header di risposta.

- API `browser.cookies` per enumerare i cookie per origin.

- Database Wappalyzer (`technologies.json`, `waf.json`) e modulo JS `Wappalyzer` per il rilevamento di tecnologie e WAF.

- `browser.storage.local` / `browser.storage.session` per persistenza degli snapshot e dei puntatori rapidi (per tab / globali).

- Modulo condiviso `scanLock` per la mutua esclusione con Analyzer e Interceptor.

- `toolReactController` per integrazione con il Tool backend (coda BullMQ `techstack`).

- React, React Router, Material UI, notistack per la UI dell’estensione.
