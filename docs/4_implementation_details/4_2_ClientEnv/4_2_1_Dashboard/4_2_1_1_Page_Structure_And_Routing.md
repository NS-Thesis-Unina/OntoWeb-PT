# Struttura pagine e routing
---

## Entry point e composizione dei provider

L’avvio della dashboard passa da `main.jsx`, dove viene montata l’app React sul nodo `#root` e vengono composti i provider globali:

- **ThemeModeProvider**: gestisce tema light/dark a livello applicativo.
- **SnackbarProvider (notistack)**: centralizza le notifiche (toast) globali, con `maxSnack=1`.
- **BrowserRouter**: abilita routing client-side basato su history (deep link e navigazione senza reload).
- **Router**: renderizza l’albero delle route dell’app.

---

## Mappa delle route e nesting

La mappa delle route è definita in `router.jsx` usando React Router (v6+). Tutte le pagine vivono sotto un layout root (`App`) montato su `/`.

Punti chiave:
- **Layout root**: `path="/" element={<App />}`
- **Home** disponibile sia come **index route** (`/`) sia come alias (`/home`)
- Sezione **Findings** strutturata come route annidata (`/findings/...`)

Mappa route → pagina:
- `/` → `Home` (index)
- `/home` → `Home`
- `/http-requests` → `HttpRequests`
- `/findings` → `TechstackFindings` (index child)
- `/findings/analyzer` → `AnalyzerFindings`
- `/findings/http` → `HttpFindings`
- `/server-status` → `ToolStatus`
- `/send-pcap` → `SendPcap`
- `/openapi` → `OpenAPI`

---

## Layout globale: App + Outlet

Il file `app.jsx` implementa un pattern standard di React Router:
- `App` rappresenta la **shell globale**.
- `Outlet` è il punto in cui React Router inietta la pagina attiva (child route).

In pratica `App` non contiene logica di pagina: delega l’interfaccia “cornice” a `NavigationWrapper`, lasciando alle pagine la responsabilità del contenuto.

Struttura:
`<NavigationWrapper> <Outlet /> </NavigationWrapper>`

---

## NavigationWrapper come “shell” UI

`NavigationWrapper` è il contenitore che rende coerente l’esperienza tra tutte le route:

### A) AppBar superiore

Include:
- logo cliccabile → naviga a `/home`
- (solo sotto `/findings`) una **sotto-navigazione** con tre tab:
    - `/findings` (Techstack)
    - `/findings/analyzer`
    - `/findings/http`
- chip di stato “Tool Status” (con polling health, dettagli in altra sezione)
- toggle dark/light

L’attivazione della sotto-nav avviene via:
- `const inFindings = location.pathname.startsWith('/findings');`
e i bottoni vengono disabilitati quando già attivi, evitando navigazioni ridondanti.

### B) Navigazione laterale sinistra

Tre modalità responsive, governate da `useMediaQuery`:
- **Desktop (>= 900px)**: pulsanti con icona + label
- **Tablet (650px–900px)**: rail compatta con sole icone
- **Mobile (< 650px)**: rail nascosta, menu hamburger nell’AppBar che apre un `Drawer` full-width

La navigazione avviene sempre tramite `useNavigate()` (routing client-side, nessun reload).

---

## Regole di layout e scrolling

Gli stili globali e di shell garantiscono che l’app occupi l’intera viewport e che lo scroll avvenga nell’area contenuti:

- `index.css` imposta `body` e `#root` a piena dimensione (`100vw/100vh`)
- `NavigationWrapper` gestisce:
    - layout a colonna (`AppBar` + area contenuti)
    - area contenuti a due colonne (nav sinistra + contenuto)
    - scrolling verticale confinato a `.right-div` (`overflow-y: auto`)

Conseguenza pratica: header e navigazione restano stabili, mentre cambia solo la pagina renderizzata da `Outlet`.

---