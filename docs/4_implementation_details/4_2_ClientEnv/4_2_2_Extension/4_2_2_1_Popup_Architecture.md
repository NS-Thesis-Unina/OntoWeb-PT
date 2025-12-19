# Popup Architecture
---

L’estensione OntoWeb-PT espone una UI sotto forma di **popup React**. A differenza della dashboard, il popup è una vista **effimera**: si apre su richiesta dell’utente, rimane attiva per il tempo di interazione, poi viene chiusa. Per mantenere continuità (route corrente, scansioni in corso, lock tra moduli) l’implementazione combina:
- **routing interno** con React Router (nested routes);
- **persistenza per-tab** della “last meaningful route” tramite `browser.storage.session`;
- **layout wrapper** unico (`App`) con navbar e area contenuti via `<Outlet />`;
- **lock service** (`scanLock`) per evitare concorrenza tra workflow di scansione.

---

## Entry point e router

### Avvio UI

L’entry point (`main.jsx`) monta l’app React dentro il DOM del popup e inizializza i provider globali:
- **ThemeModeProvider**: gestione tema (default `dark`);
- **SnackbarProvider**: notifiche globali (notistack);
- **HashRouter**: routing basato su hash.

L’uso di `HashRouter` è coerente con l’ambiente extension: non esiste un server che risolva path lato backend, quindi l’hash evita dipendenze da “server-side route handling”.

---

## Layout principale

### App come shell di navigazione

Il componente `App` è il contenitore top-level usato da tutte le route:
- monta la **Navbar** (navigazione primaria tra sezioni);
- include **RoutePersistence** (restore/track della route);
- espone `<Outlet />` come area di rendering per le viste figlie.

Strutturalmente:
- `App` non implementa logica di dominio (scan, analisi, invio dati);
- fornisce solo shell e comportamento trasversale legato alla navigazione.

---

## Struttura delle route

### Routing annidato per sezioni

`router.jsx` definisce una gerarchia di route annidate che riflette l’organizzazione interna dei moduli:

- **Home**
    - `/` (index) e `/home`
- **Analyzer**
    - `/analyzer` (default One-Time Scan)
    - `/analyzer/runtime`
    - `/analyzer/analyze/(onetime|runtime)`  
    - `/analyzer/archive/(onetime|runtime)`
- **TechStack**
    - `/techstack` (scan)
    - `/techstack/analyze`
    - `/techstack/archive`
- **Interceptor**
    - `/interceptor` (runtime capture)
    - `/interceptor/send`
    - `/interceptor/archive`

L’approccio “nested routes + wrapper per sezione” riduce duplicazione: ogni sezione implementa un layout comune e delega i contenuti alle sottopagine tramite `<Outlet />`.

---

## Wrapper di sezione e navigazione secondaria

### PageNavigation

Le pagine top-level (`Analyzer`, `TechStack`, `Interceptor`) seguono un pattern uniforme:
- determinano la **sottosezione attiva** osservando `pathname`;
- mostrano intestazione coerente tramite `PageNavigation` (titolo + icona + label subsection);
- espongono pulsanti “tab-like” con stato `disabled` coerente tramite `selectedSubSection(...)`;
- rendono contenuti figlio con `<Outlet />`.

`PageNavigation` è un componente riusabile: incapsula layout e animazione (`Slide`) e ospita i controlli come `children`.

### SubPageNavigation

Per casi con un secondo livello (Analyzer → Analyze/Archive), la navigazione locale viene gestita da `SubPageNavigation`:
- componente compatto, pensato per “switch” tra due viste sorelle;
- pattern a bottoni con dividers, più un’animazione `Slide`;
- usa `navigate('onetime') / navigate('runtime')` con percorsi relativi.

---

## Persistenza della route per tab

### RoutePersistence

Il popup non mantiene stato tra aperture in modo naturale, quindi viene introdotto `RoutePersistence` per:
- **associare route → tab attivo** usando `browser.tabs.query({ active: true, currentWindow: true })`;
- salvare la route in `browser.storage.session` dentro una mappa:
    - chiave: `ui_lastRoute_byTab`
    - struttura: `{ [tabId]: "/path?query" }`

La logica di restore privilegia viste “vive”:
1. se Analyzer è attivo → forza `/analyzer/runtime`
2. se Interceptor è attivo → forza `/interceptor`
3. altrimenti ripristina ultima route salvata per tab
4. fallback finale → `/home`

Inoltre evita loop: naviga solo se `target !== currentPath+search`.

### Cleanup lato background

Nel service worker (`background.js`) un listener su `browser.tabs.onRemoved` rimuove l’entry per tab chiusi da `ui_lastRoute_byTab`, prevenendo:
- restore su tab non più esistenti;
- crescita non necessaria della session map.

---

## Lock di scansione tra moduli

### scanLock come coordinamento trasversale

`scanLock.js` implementa un lock “leggero” basato su `browser.storage.session` per evitare che più workflow lunghi partano in parallelo tra sezioni.

Caratteristiche principali:
- lock persistito sotto la chiave `ui_scan_lock`;
- owner logici predefiniti (`OWNERS`), ad esempio:
    - `TECHSTACK_ONETIME`, `ANALYZER_ONETIME`, `ANALYZER_RUNTIME`, `INTERCEPTOR_RUNTIME`;
- TTL (default 120 minuti) e invalidazione automatica dei lock scaduti;
- API:
    - `getLock()`, `acquireLock(owner, label, ttlMs)`, `releaseLock(owner)`
- subscribe real-time:
    - `subscribeLockChanges(cb)` ascolta `browser.storage.onChanged` (area `session`) per aggiornare la UI quando il lock cambia.

Il lock non sostituisce il controllo lato background/engine, ma riduce conflitti UX: disabilitazione coerente dei pulsanti e prevenzione di “doppi avvii” dal popup.

---

## Separazione UI vs background

### Controller e background orchestration

L’architettura del popup è pensata per mantenere la UI “leggera”:
- la UI (React) gestisce routing, layout, stato di presentazione e invoca azioni;
- il service worker inizializza controller di background:
    - `AnalyzerBackgroundController`
    - `TechStackBackgroundController`
    - `InterceptorBackgroundController`
    - `ToolBackgroundController`
    
Ogni sezione, lato React, comunica con il proprio controller di background tramite messaggistica (pattern controller React ↔ controller background). Le operazioni pesanti (scan, injection, orchestrazione) restano nel background/engine, mentre nel popup rimangono routing, navigazione e coordinamento.

---