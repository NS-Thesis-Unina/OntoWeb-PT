# Core Modules

Questa sezione descrive i **macro-moduli principali** dell’estensione, con una vista **architetturale** (senza scendere nei dettagli di implementazione).  
Ogni modulo è progettato come un sottosistema “end-to-end” con una struttura ricorrente:

**React UI (Controller) → Background (Controller) → Engine → Content Script / API Browser → Storage / Backend**

---

## Analyzer

---

### Scopo
L’**Analyzer** esegue analisi **strutturali** della pagina, a partire da uno snapshot HTML/DOM, per estrarre evidenze utili (struttura, elementi, metadati, asset, form, iframe, ecc.) e produrre un dataset normalizzato.

### Cosa raccoglie
- **DOM / HTML snapshot** della pagina (one-time e runtime)
- **Script** (in head), riferimenti e contenuti inline (in forma strutturata lato parsing)
- **Form**: action, method, input/select/textarea/button e attributi rilevanti
- **Iframe**: src, title
- Strutture di supporto: headings, link, liste, media (img/video/audio), statistiche DOM (profondità, tagCount)

### Normalizzazione e output
- Parsing HTML in background (es. tramite parsing DOM-like) e produzione di un output **strutturato e normalizzato** (testi ripuliti, campi null gestiti, array coerenti, filtri su valori “non significativi”).
- Persistenza dei risultati:
  - **session storage**: “last result” globale e “last by tab”
  - **local archive**: storico dei run (key timestamp-based)

### Modalità operative
- **One-time scan**: iniezione di uno script leggero che invia l’HTML al background, che poi:
  1) elabora/parsa  
  2) salva  
  3) notifica la UI
- **Runtime scan**: modalità continua (sessione start/stop) che reinietta su navigazioni/tab update, aggrega per URL e invia update progressivi.

### Confini e responsabilità
- I **React Controller** gestiscono solo comandi e routing eventi (start/stop, load, delete, status).
- Il **Background Controller** è un “thin router”.
- L’**Engine** contiene tutta la logica di: injection, parsing, aggregazione dataset, persistenza, gestione archivio.

---

## Interceptor

---

### Scopo
L’**Interceptor** cattura e correla il **traffico di rete** generato durante una sessione (requests/responses), costruendo un dataset consultabile e archiviabile.

### Cosa cattura
- Traffico HTTP(S) con metadati e contenuti:
  - **headers**
  - **cookies** (quando disponibili tramite le API)
  - **request body** (quando disponibile)
  - **response body** (quando disponibile)
- Eventi runtime da content-script (hook fetch/XHR e canali aggiuntivi quando abilitati):
  - HTTP (base)
  - beacon / SSE / websocket (attivabili via flags di configurazione)

### Correlazione con tab/pagina
- Ogni entry include metadati utili alla correlazione:
  - `tabId`
  - `pageUrl` (URL della pagina/tab che ha originato o ospita il contesto)
  - timestamp, frameId (se disponibile)
- Il dataset è aggregato per **pageUrl** e indicizzato per sessione/run.

### Limiti imposti dalle Chrome APIs / compatibilità browser
La cattura “profonda” dipende dalle capacità del browser:
- **Chrome-like**: deep capture tramite meccanismi di attach per tab (approccio “debugger/devtools-like”), con auto-attach su navigazione e reiniezione su update.
- **Firefox-like**: deep capture basata su `webRequest` e, quando disponibile, su streaming della response via `filterResponseData` (ricostruzione body testuale o base64). `:contentReference[oaicite:0]{index=0}`
- L’engine gestisce l’avvio/stop sessione, l’injection del content script e l’archivio; la parte deep-capture è demandata a implementazioni dedicate per browser.
  `:contentReference[oaicite:1]{index=1}`

### Persistenza
- A fine sessione (stop), l’engine salva su `storage.local`:
  - run completo (dataset + meta: startedAt, stoppedAt, counters)
  - puntatore “lastKey” per recupero rapido dell’ultimo run

### Confini e responsabilità
- **React Controller**: start/stop, status, list/delete/clear, gestione eventi live (`update` / `complete`)
- **Background Controller**: router e fan-out eventi verso tutte le UI
- **Engine**: ingestione centralizzata (deep + content script), contatori, dataset, persistenza, cleanup, flags di cattura

---

## Techstack

---

### Scopo
Il modulo **Techstack** effettua fingerprinting **client-side** dello stack tecnologico della pagina e produce evidenze utili (tecnologie, WAF, header di sicurezza, cookie, storage).

### Fingerprinting client-side
Il flusso combina:
- **Raccolta DOM-side** tramite script iniettato:
  - meta tag, script src, inline scripts (con limiti di quantità/dimensione)
  - HTML (troncato per performance)
  - URL pagina
  - dump di localStorage e sessionStorage
- **Raccolta background-side** tramite API di rete:
  - aggregazione response headers (per tab)
  - tracking origini viste e snapshot richieste
  - enumerazione cookie per origin (best-effort, con fallback su errori)

### Motore di detection (Wappalyzer)
- Il motore usa database di tecnologie e categorie (Tech + WAF) caricati come JSON.
- Esegue detection su:
  - headers, meta, html, scriptSrc, inline scripts, cookies
- Risolve e normalizza le detection in:
  - elenco **technologies** (name, version)
  - elenco **waf** (name, version)

### Storage evidenze
Il risultato include anche evidenze “operative”:
- **secureHeaders findings**: controlli su header di sicurezza/anti-leak (best practice + deprecated), costruiti su snapshot richieste HTML
- **cookies** (lista + campi utili)
- **storage dumps** (local/session)

### Deduplicazione e storicizzazione
- Salvataggio:
  - **session**: ultimo risultato globale + ultimo per tab (mappa)
  - **local archive**: entry con chiave timestamp-based
- Caricamento “waterfall” (per UI):
  1) session_by_tab → 2) session → 3) local → 4) none  
  Questo consente di mostrare sempre “l’ultimo dato disponibile” anche dopo reload o riapertura UI.

### Confini e responsabilità
- **React Controller**: trigger scan, ricezione eventi (complete/error/reloadRequired), accesso ad archivio e delete/clear
- **Background Controller**: router verso engine e broadcast eventi
- **Engine**: orchestrazione completa (injection + merge DOM/background + detection + findings + storage + persistenza)

---

## Nota architetturale comune

I tre moduli seguono lo stesso principio:
- **UI**: nessuna logica pesante, solo comandi e presentazione
- **Background**: routing e fan-out eventi
- **Engine**: logica principale (analisi/cattura), controllo injection, aggregazione e persistenza
- **Content script / API browser**: raccolta in contesto pagina o intercettazione a livello browser

Questa separazione riduce il coupling, facilita la manutenzione e permette di estendere le capability (nuovi detector, nuove fonti, nuove policy di storage) senza impattare direttamente la UI.

---