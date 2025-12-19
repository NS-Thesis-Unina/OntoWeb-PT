# HTTP Requests
---

La pagina **HTTP Requests** fornisce una vista operativa per esplorare il traffico HTTP già normalizzato e salvato nell’ontologia. L’implementazione combina tre esigenze: **ricerca/filtering**, **paginazione server-side**, e **ispezione dettagliata on-demand** della coppia request/response.

---

## Ruolo e responsabilità

Lato white-box, la pagina agisce come “orchestrator”:
- costruisce i **parametri di query** a partire da filtri e paginazione;
- invoca il backend per ottenere righe e metadati di paging;
- gestisce gli stati `loading`, `rows`, `page` e `filters`;
- delega rendering e interazioni ai componenti dedicati:
    - `HttpRequestsFilters` (toolbar filtri)
    - `HttpRequestsDataGrid` (tabella + drawer dettagli)

---

## Stato locale e flusso dati

### Stato principale
- `loading`: flag globale per le fetch (con loader bloccante solo al primo bootstrap).
- `params`: `{ limit, offset }` usato per memorizzare la paginazione corrente.
- `page`: metadati restituiti dal backend (totale, offset, limit, next/prev…).
- `rows`: righe correnti mostrate nella tabella.
- `filters`: filtri controllati (method, scheme, authority, path, text, …).

### Flusso di caricamento

All’avvio (`useEffect` con dipendenze vuote) parte un fetch con `offset/limit` iniziali.  
Le interazioni successive aggiornano la lista passando sempre dal backend:
- cambio pagina / pageSize → refetch con nuovi `offset/limit`
- apply/reset filtri → refetch, in genere ripartendo da `offset = 0`

### Costruzione query params

La funzione `buildRequestParams()`:
- esegue `trim()` su tutti i valori
- elimina campi vuoti
- produce un oggetto “querystring-ready” da passare al service

Questo approccio evita query rumorose (parametri inutili) e rende più deterministico il comportamento lato server.

---

## Integrazione REST

La pagina usa esclusivamente il layer `/services/httpRequestsService.js`:
- `listHttpRequests(params)` → `GET /http-requests/list`  
    ritorna `items` (righe) e `page` (metadati di paginazione)
- `getHttpRequestById(id)` → `GET /http-requests/:id`  
    usato nel drawer per caricare il dettaglio completo

Error handling:
- errori di fetch lista → `enqueueSnackbar('Error while executing the request.', { variant: 'error' })`
- errori nel fetch dettaglio → snackbar + chiusura drawer per evitare pannelli vuoti o incoerenti

---

## Filtri

### HttpRequestsFilters

Il componente filtri è **controllato**: riceve `filters` e invia aggiornamenti al parent tramite `onChange`.

Meccanismo rilevante:
- mantiene uno snapshot `appliedFilters` per capire se esistono modifiche non ancora applicate
- abilita/disabilita il pulsante **Apply** usando un confronto normalizzato (`trim` su tutti i campi)

Azioni:
- **Apply**: richiama `onApply()` e aggiorna lo snapshot
- **Reset**: azzera i campi e richiama `onReset()`

Nota implementativa: nella pagina padre esiste un flag `applyFilter` (variabile function-scoped) utilizzato per mostrare una snackbar “filtri applicati” dopo il completamento della fetch. In uno scenario di crescita, una `useRef()` renderebbe il comportamento più robusto tra re-render.

---

## Tabella e paginazione server-side

### HttpRequestsDataGrid

Il componente tabellare usa MUI X `DataGrid` con:
- `paginationMode="server"`
- `rowCount={page.total}`
- `paginationModel` derivato da `offset/limit`:
    - `page = floor(offset / limit)`
    - `pageSize = limit`

Il callback `onPaginationModelChange` riconverte i valori del DataGrid in `offset/limit` e richiama `onPageChange(newOffset, newLimit)`.

Colonne principali:
- `method`
- `status` (derivata da `row.response.status`)
- `url` (da `row.uri.full`)
- `authority` (preferisce `row.connection.authority`, fallback su `row.uri.authority`)
- `graph`
- colonna `actions` con icona “View details”

L’uso di `valueGetter` permette di mantenere `rows` in forma “raw” senza pre-processing in pagina.

---

## Drawer di dettaglio

L’ispezione completa avviene tramite un drawer laterale (`DrawerWrapper`), aperto cliccando l’azione sulla riga.

Caricamento:
- al click viene invocato `fetchRequest(id)`
- mentre la richiesta è in corso, `DrawerWrapper` riceve `loading={loadingRequest}`

Contenuto mostrato:
- header con chip `method` e chip status (con mapping colore via `statusChipColor`)
- URL completo con pulsante “Copy URL”
- sezione **Request**: scheme/authority/path/queryRaw + query params + request headers
- sezione **Response**: status/reason + response headers + body (base64) con “Copy body”

In caso di errore durante il fetch del dettaglio:
- snackbar di errore
- reset dello stato del dettaglio
- chiusura del drawer (`setOpen(false)`)

---

## Convenzioni UX applicate nella pagina

- **Primo load bloccante**: `Backdrop + CircularProgress` solo quando non esistono ancora righe.
- **Loading non bloccante**: nelle fetch successive la tabella resta visibile e `DataGrid` mostra lo stato di caricamento.
- **Empty state esplicito**: se `rows.length === 0`, rendering di un messaggio “No requests to show.”
- **Best-effort utilities**: copia clipboard gestita via `navigator.clipboard.writeText` con fallback silenzioso (log in console).

---

## Note su layout

La pagina è centrata e contenuta in `max-width: 1200px` per coerenza con le altre viste “data-heavy”.  
La sezione griglia usa `flex: 1` e `min-height: 0` per permettere al DataGrid di occupare correttamente lo spazio disponibile nel layout scrollabile del `NavigationWrapper`.

---