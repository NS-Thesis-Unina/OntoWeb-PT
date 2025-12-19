# Findings - Http
---

La seguente sezione descrive le caratteristiche implementative generali della pagina **HTTP Findings**, renderizzata all’interno del `NavigationWrapper`. La pagina elenca i finding generati dal **resolver HTTP** (problematiche a livello protocollo/trasporto/sessione) e consente di aprire un pannello di dettaglio per ciascun finding.

---

## Scopo della pagina

La pagina `pages/findings/httpFindings/httpFindings.jsx` ha il ruolo di:
- recuperare dal backend la lista **paginata** degli ID dei finding HTTP;
- mostrare tali ID in una tabella (MUI **DataGrid**) con paginazione server-side;
- permettere l’apertura di un **drawer** laterale per visualizzare i dettagli completi del finding selezionato.

---

## Struttura e componenti principali

La UI è divisa in due blocchi principali:

1. **Header e descrizione**
    - Titolo centrato (`Typography`).
    - Card descrittiva con animazione (`Paper` + `Zoom`) che spiega cosa rappresentano i finding.
2. **Griglia risultati**
    - Rendering condizionale:
        - se ci sono righe → `HttpFindingsDataGrid`
        - altrimenti → messaggio “No findings to show.”

Componenti coinvolti:
- `HttpFindings` (pagina): orchestrazione fetch, stato di caricamento e paginazione.
- `HttpFindingsDataGrid` (componente): tabella, paginazione server-side e drawer dettagli.
- `DrawerWrapper` (riusabile): wrapper comune per drawer con titolo e stato `loading`.

---

## Integrazione REST e flusso dati

### Endpoint utilizzati (tramite `httpRequestsService`)

- `listHttpFindings({ offset, limit })`
    - restituisce lista di ID (`res.items`) + metadati pagina (`res.page`).
- `getHttpFindingById(id)`
    - recupera il payload completo per il drawer.

### Flusso

1. **Mount pagina**
    - `useEffect(() => fetchFindings(params.offset, params.limit), [])`
2. **Fetch lista**
    - `fetchFindings(offset, limit)`:
        - `setLoading(true)`
        - chiama `httpRequestsService.listHttpFindings`
        - normalizza le righe in `{ id }`
        - aggiorna `rows`, `page`, `params`
3. **Click “view details”**
    - `fetchFinding(id)` nel DataGrid:
        - chiama `httpRequestsService.getHttpFindingById`
        - salva `finding` e apre drawer

---

## Paginazione server-side nel DataGrid

Il componente `HttpFindingsDataGrid` implementa la paginazione in modalità server:
- la pagina backend è gestita come `offset/limit`
- la DataGrid richiede `paginationModel` con `page/pageSize`
- conversione applicata:

`page = Math.floor(offset / limit) pageSize = limit`

Al cambio paginazione (`onPaginationModelChange`), vengono calcolati i nuovi `offset` e `limit` e propagati al parent tramite `onPageChange(newOffset, newLimit)`.

È presente anche un oggetto `safePage` come fallback per mantenere la griglia “controllata” anche se `page` è momentaneamente non valorizzato.

---

## Parsing “derivato” dell’ID finding

Per mostrare colonne “Rule” e “Target” senza chiamate extra, la griglia estrae informazioni direttamente dall’ID (stringa colon-separated), assumendo il formato:

`<ns>:<resolver>:http:<rule>:<target...>`

Funzioni principali:
- `extractHttpFindingRule(id)` → ritorna il segmento `<rule>`
- `extractHttpFindingTarget(id)` → concatena i segmenti successivi come `<target...>`

Questa scelta migliora la leggibilità a colpo d’occhio e riduce la necessità di fetch dettagli per ogni riga.

---

## Drawer di dettaglio

Il drawer visualizza:
- intestazione con chip:
    - `ruleId` (se presente)
    - `severity` (mappata su `Chip` color intent con `severityChipColor`)
- metadati del finding:
    - category, OWASP category, resolver
- sezione attributi core (Label/Value)
- sezione “HTTP summary”:
    - method, status e URL (con bottone “copy”)

Utility implementata:
- `copyToClipboard(text)` con `navigator.clipboard.writeText`, best-effort.

---

## Gestione loading ed errori

Pattern applicato:
- **First load blocking**: se `loading && rows.length === 0` → `Backdrop` + `CircularProgress`
- **Subsequent loads non-blocking**: la DataGrid resta visibile e mostra il proprio stato `loading`

Error handling:
- errori di lista e dettagli sono mostrati tramite `enqueueSnackbar(..., { variant: 'error' })`
- in caso di errore nel dettaglio, il drawer viene chiuso (`setOpen(false)`) e lo stato `finding` viene resettato.

---

## Convenzioni UI ricorrenti in questa pagina

- Layout centrato con `max-width: 1200px` e griglia che occupa lo spazio residuo (`flex: 1; min-height: 0`).
- Descrizione introduttiva sempre in `Paper` con animazione `Zoom`.
- Tabelle con **server-side pagination** e azione “View details” coerente con le altre sezioni Findings.
- Drawer standardizzato tramite `DrawerWrapper` e righe “Label/Value” per mostrare attributi in modo consistente.

---