# Application State & Patterns
---

La UI dell’estensione (popup React) è progettata per funzionare in un contesto **short-lived**: ogni apertura del popup ricrea il tree React, quindi lo stato “duraturo” non può vivere solo in memoria.

Per questo l’implementazione separa chiaramente:
- **UI state** (React local state, transizioni, view state);
- **browser state** (storage local/session, tab awareness, routing per-tab);
- **analysis state** (stato operativo e dataset generati da scansioni, gestiti nel background/engine).

Il risultato è un’architettura “white-box” in cui la UI è principalmente **presentational + orchestration**, mentre il lavoro pesante e lo stato persistente risiedono in background.

---

## Separazione degli stati

### 1) UI state

È lo stato che vive nel popup e riguarda esclusivamente la presentazione:
- **sottosezione attiva** (es. `subsection` in `Analyzer`, `TechStack`, `Interceptor`);
- **stato dei tab-button** (computed da pathname tramite `selectedSubSection(...)`);
- **layout wrapper** con `<Outlet />` e pattern di navigazione (`PageNavigation`, `SubPageNavigation`);
- **tema dark/light** e readiness del tema.

Questo stato è in genere gestito con `useState + useEffect` e non deve sopravvivere alla chiusura del popup.

Esempio tipico:
- in ogni “section wrapper” si osserva `pathname` e si deriva la label di contesto (Scan/Analyze/Archive ecc.);
- i componenti di navigazione sono “tab-like”: il `disabled` è derivato, non memorizzato.

---

### 2) Browser state

È lo stato che deve sopravvivere tra aperture del popup e/o deve essere condiviso tra più viste e tab.

#### Tema (persistenza su local)

Il tema usa un provider dedicato (`ThemeModeProvider`) che:
- legge `ui_theme_mode` da `browser.storage.local`;
- usa un flag `ready` per evitare flash del tema errato;
- persiste ogni cambio modalità in local storage.

Il toggle (`DarkLightButton`) consuma lo stato tramite hook (`useThemeMode`) e richiama `toggleMode()`.

**Pattern chiave:** _stored state_ (mode in storage) + _derived state_ (MUI theme rebuild) + _guard_ (ready).

#### Route per-tab (persistenza su session)

La persistenza della navigazione è implementata con `RoutePersistence`:
- identifica il tab attivo con `browser.tabs.query(...)`;
- mantiene una mappa `ui_lastRoute_byTab` in `browser.storage.session`;
- al primo mount su `/` ripristina una route “meaningful” (fallback `/home`).

La mappa viene ripulita dal background quando un tab viene chiuso (`tabs.onRemoved`) per evitare riferimenti stantii.

**Pattern chiave:** _per-tab state_ in session storage + _restore on open_ + _cleanup on tab removal_.

#### Lock globale UI (session)

Il lock (`scanLock`) è un coordinamento cross-section:
- salva `ui_scan_lock` in `browser.storage.session`;
- usa owner logici e TTL per evitare lock “eterni”;
- espone subscription via `browser.storage.onChanged`.

Questo non è “business state”, ma uno stato di **coordinamento UI**: evita che flussi lunghi partano in parallelo da sezioni diverse.

---

### 3) Analysis state

È lo stato operativo delle scansioni/analisi (dataset, running status, archivio) e vive prevalentemente nel **background**:
- la UI invia comandi a un React Controller (message-passing);
- il background controller delega a un engine;
- i risultati vengono salvati in storage e/o trasmessi come eventi alla UI.

Nel popup, questo stato viene trattato come:
- **remote state** (ottenuto via `getScanStatus()`, `getLocalScanResults()`, ecc.);
- **event stream** (update/completion/error ricevuti dal background e mappati su UI).

Importante: la UI **non** fa parsing o elaborazioni pesanti. Al massimo tiene in memoria un “snapshot” di ciò che deve renderizzare.

---

## Hook custom e helper principali

### useThemeMode (hook di contesto)

`useThemeMode` è l’hook centrale per il tema:
- espone `mode`, `setMode`, `toggleMode`;
- il provider gestisce la persistenza su `browser.storage.local` e il flag `ready`.

È un hook “globale”, usato trasversalmente dalla UI.

### Hooks di routing (React Router)

L’app usa pattern standard:
- `useLocation()` per derivare stato di navigazione (subsection);
- `useNavigate()` per gestire i “tab button” e i percorsi relativi nelle subpages;
- `<Outlet />` per comporre le viste.

Qui la “customizzazione” non è nel router, ma nella **derivazione coerente** della sezione attiva e nella navigazione a livelli.

### Subscription pattern verso background

I React Controller (es. `AnalyzerReactController`) offrono un’API uniforme:
- `onMessage(callbacks)` → registra handler di update/complete/error;
- metodi “command” (`sendStart...`, `sendStop...`);
- metodi “query” (`getScanStatus()`, `getLastRuntimeResults()`, `getLocalScanResults()`).

È un pattern che sostituisce la classica fetch/polling UI con un modello **event-driven** (push dal background), più adatto a un popup.

---

## Pattern adottati

### 1) Services layer (controller come boundary)

Il codice segue una separazione netta:
- **React components**: rendering, UX, wiring di eventi utente, stato locale minimo.
- **React Controller**: service layer UI → invio messaggi e subscription ai messaggi.
- **Background Controller**: router di comandi (switch su `message.type`), broadcast verso UI.
- **Engine**: logica “pesante”, storage, injection (dettagliati in sezioni successive).

Questo permette alla UI di restare stabile anche quando cambiano dettagli dell’engine, perché il contratto principale è il set di `message.type`.

---

### 2) Event-driven updates

Il flusso privilegiato è push-based:
- la UI si sottoscrive (`onMessage`) e reagisce a:
    - eventi di completamento,
    - progress update (runtime scan),
    - errori.

Quando serve robustezza, si affianca un pattern pull:
- `getScanStatus()` per ricostruire stato quando il popup viene riaperto.

In altre parole:
- **event stream** per reattività;
- **query** per bootstrap e recovery.

---

### 3) Derived state vs stored state

La regola è: si salva solo ciò che serve a sopravvivere al popup o a essere condiviso.

- **Stored state**
    - `ui_theme_mode` in local (preferenza utente)
    - `ui_lastRoute_byTab` in session (continuità UX per tab)
    - `ui_scan_lock` in session (coordinamento cross-modulo)
    - risultati/archivi (storage local/session, gestiti dagli engine)

- **Derived state**
    - label subsection (derivata da `pathname`)
    - stato `disabled` dei button (derivato da route)
    - MUI theme object (derivato da `mode`)
    - “tool status” e job status in UI (derivato da eventi/health, non persistito nel popup)

Questa distinzione riduce inconsistenze e limita la quantità di stato da sincronizzare.

---

## Nota sul Tool controller

La comunicazione con il Tool esterno segue lo stesso schema controller/engine:
- `ToolReactController` (UI) → `ToolBackgroundController` → `ToolEngine` (REST + Socket.io)

In questa sezione viene considerato soprattutto come **remote state + event stream** (health update, job events). I dettagli di REST/WS, polling, subscribe-job e fallback REST verranno trattati nella sezione dedicata.

---