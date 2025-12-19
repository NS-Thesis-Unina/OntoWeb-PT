# Findings - Analyzer
---

La sezione **Findings → Analyzer** espone l’elenco dei finding prodotti dal **HTML Analyzer**, ovvero controlli applicati a DOM/page snapshot per evidenziare pattern sospetti (es. inline handler, sink pericolosi, frammenti HTML/script rischiosi) e fornire metadati utili (severity, mapping OWASP, contesto di analisi, evidenze).

---

## Scopo e ruolo architetturale

Questa pagina ha un ruolo “**browse & inspect**”:
- **Browse**: mostra una lista paginata di finding Analyzer (identificati da ID).
- **Inspect**: consente di aprire un **drawer** laterale con il dettaglio completo del finding selezionato.

È coerente con le altre pagine di Findings (Techstack / HTTP / Analyzer):  
**pagina** = orchestration (paging + fetch) → **DataGrid** = presentazione + drawer dettagli.

---

## Data flow e integrazione REST

### Lista (paginated)

- All’avvio viene invocata `analyzerService.listAnalyzerFindings({ offset, limit })`.
- La risposta viene adattata a righe DataGrid:
    - l’API restituisce tipicamente una lista di **ID** (`res.items`)
    - per ogni ID, viene effettuata una chiamata di dettaglio `analyzerService.getAnalyzerFindingById(id)` per ottenere informazioni aggiuntive (es. `mainDomain`) da visualizzare nella tabella.

Questo approccio crea un dataset di righe con forma:
- `{ id, target }`, dove `target` è il dominio principale del finding (se disponibile).
### Dettaglio (on-demand)

- Al click sull’azione “View details” nella grid viene chiamata:
    - `analyzerService.getAnalyzerFindingById(id)`
- Il risultato popola il drawer con tutte le sezioni informative.

---

## Stato e gestione loading/error

### Stato nella pagina (AnalyzerFindings)

- `loading`: gestisce lo stato di fetch della lista
- `params`: conserva `limit`/`offset` correnti
- `page`: metadati di paginazione server-side
- `rows`: righe mostrate in tabella

### Stato nel componente tabellare (AnalyzerFindingsDataGrid)

- `open`: stato apertura drawer
- `loadingFinding`: loading specifico del dettaglio
- `finding`: payload del finding selezionato

### UX loading

- **First load**: se `loading && rows.length === 0` viene mostrato un `Backdrop` bloccante.
- **Reload/pagination**: la tabella resta visibile e DataGrid usa `loading={loading}` per mostrare lo spinner inline.

### Error handling

- Errori lato lista: snackbar `enqueueSnackbar('Error while loading analyzer findings.', { variant: 'error' })`
- Errori lato dettaglio: snackbar `enqueueSnackbar('Error while retrieving finding details.', { variant: 'error' })` e chiusura drawer per evitare UI in stato inconsistente.

---

## Paginazione server-side con MUI DataGrid

La pagina usa paginazione **server-side** (offset/limit):
- Il backend espone `page.limit`, `page.offset`, `page.total`.
- DataGrid richiede `paginationModel = { page, pageSize }`.

Conversione applicata:
- `page = floor(offset / limit)`
- `pageSize = limit`

Al cambio pagina o pageSize:
- `newOffset = model.page * model.pageSize`
- `newLimit = model.pageSize`
- viene invocato `onPageChange(newOffset, newLimit)` che causa un nuovo fetch.

Questo mantiene la tabella controllata e allineata allo stato server.

---

## Colonne e parsing dell’ID

Il finding ID ha una codifica **colon-separated**, e la UI sfrutta questa proprietà per mostrare campi “derivati” senza dover caricare subito il dettaglio completo.

Nel DataGrid sono presenti:
- **Finding ID**: render con ellissi e tooltip per leggibilità
- **Rule**: `extractAnalyzerRule(...)` (parte dell’ID)
- **Document**: `extractAnalyzerDocument(...)` (parte dell’ID)
- **Target**: ottenuto dal dettaglio (mainDomain), se disponibile
- **Actions**: bottone per aprire drawer e fetch dettaglio

Questo pattern offre un **colpo d’occhio** utile anche quando i dettagli non sono ancora stati caricati.

---

## Drawer di dettaglio: struttura e contenuti

Il drawer (via `DrawerWrapper`) è organizzato per sezioni, con layout consistente rispetto alle altre pagine:
### 1) Header sintetico

- Chip con `ruleId` (se presente)
- Chip con `severity` (color mapping)
- Descrizione (se presente)
- Meta: categoria finding, OWASP category, resolver

### 2) Sezione “Finding”

Mostra campi base:
- Id, Rule (fallback dal parsing ID), Target, Severity
- Finding category, OWASP category, Resolver
- Description

### 3) Sezione “Context”

Mostra il contesto di analisi:
- type, origin
- `context.src` presentato in monospace con overflow ellissi
- pulsante “Copy source URL” (clipboard)

### 4) Sezione “HTML reference”

Evidenze HTML (array `finding.html`):
- lista scrollabile in un Paper
- per ogni nodo: IRI + `source` (monospace) per evidenziare il frammento reale analizzato

---

## Utility UI e convenzioni visive

### Severity → Chip color

Mapping coerente con altre pagine Findings:
- LOW → info
- MEDIUM → warning
- HIGH/CRITICAL → error
- default → default

### Clipboard best-effort

Funzione `copyToClipboard` basata su `navigator.clipboard.writeText`:
- nessun blocco UI se fallisce
- usata per copiare:
    - URL di contesto (`context.src`)

### Tipografia e leggibilità

- valori tecnici (ID, URL, HTML source) in **monospace**
- righe label/value con `LabelValueRow` per uniformità
- aree “evidence” con `max-height` e `overflow: auto` per evitare layout che cresce senza limite

---

## Styling (CSS) e layout responsivo

- contenitore pagina centrato con `max-width: 1200px` e layout a colonna
- `description` in `Paper` con animazione `Zoom`
- DataGrid occupa lo spazio disponibile (`width/height: 100%`)
- drawer con spacing verticale consistente (`gap: 16px`)
- box HTML con scroll per mantenere il drawer usabile anche con molte evidenze

---

## Pattern riusati e coerenza con il resto della Dashboard

Questa pagina adotta gli stessi pattern delle altre sezioni “data-heavy”:
- orchestrazione fetch + stato pagina
- DataGrid server-side + drawer “details on demand”
- snackbars come feedback per errori
- componenti piccoli riusabili (LabelValueRow, mapping severità, clipboard)
Il risultato è una UX uniforme: l’utente impara una volta il pattern (grid → action → drawer) e lo ritrova su tutta la dashboard.

---