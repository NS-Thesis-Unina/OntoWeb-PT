# Findings - Techstack
---
### Scopo della pagina

La vista **Techstack Findings** presenta l’elenco dei finding generati dal resolver Techstack (tecnologie rilevate, WAF, security headers e cookie). L’obiettivo principale è offrire una panoramica paginata dei finding disponibili e permettere l’ispezione puntuale dei dettagli tramite un pannello laterale.

### Struttura UI e componenti coinvolti

- **Header pagina** con titolo e **card descrittiva** introduttiva (animata con `Zoom`).
- **Tabella paginata** basata su **MUI X DataGrid** per mostrare i finding.
- **Drawer laterale** (riuso di `DrawerWrapper`) per visualizzare il dettaglio di un finding selezionato.
- Uso ricorrente di componenti MUI (`Paper`, `Typography`, `Chip`, `Divider`, `Stack`, `IconButton`, `Tooltip`) per uniformità con il resto della dashboard.

### Stato locale e flusso dati

La pagina adotta stato locale con `useState` e caricamento iniziale con `useEffect`:
- `loading`: flag di caricamento globale.
- `params`: stato “ultimo offset/limit” utilizzato.
- `page`: metadati di paginazione restituiti dal backend (`limit`, `offset`, `total`, ecc.).
- `rows`: righe mostrate nella DataGrid.

Flusso dati principale:

1. `useEffect` invoca `fetchFindings(params.offset, params.limit)` al mount.
2. `fetchFindings` chiama `techstackService.listTechstackFindings({ offset, limit })` per ottenere la lista paginata di **ID**.
3. Per ogni ID, la pagina risolve informazioni minime (es. `mainDomain`) con `techstackService.getTechstackFindingById(id)` e costruisce le righe:
    - `{ id, target }`
4. La tabella delega la paginazione server-side: ogni cambio pagina richiama `handlePageChange → fetchFindings(newOffset, newLimit)`.

Nota progettuale: la pagina esegue un **fan-out di chiamate** (una per ID) per arricchire le righe. In caso di errore su un singolo dettaglio, la riga viene mantenuta con `target: null` così da non interrompere la renderizzazione complessiva.

### Integrazione REST

Le chiamate avvengono tramite `techstackService`, che usa `httpClient` (Axios) come layer comune:
- `GET /techstack/finding/list` per ottenere gli ID paginati
- `GET /techstack/finding/:id` per recuperare il payload completo del finding

Gestione errori:
- errori sul caricamento lista → snackbar (`enqueueSnackbar`) e fallback UI coerente (lista vuota / messaggio “No findings to show.”).
- errori sul singolo dettaglio in fase di costruzione righe → log in console e riga parziale.
- errori sul dettaglio nel drawer → snackbar e chiusura del drawer, evitando stati incoerenti.

### Tabella e paginazione server-side

`TechstackFindingsDataGrid` converte la paginazione basata su `offset/limit` nel modello richiesto da DataGrid (`page`, `pageSize`), mantenendo la UI controllata:
- `paginationMode="server"`
- `rowCount` valorizzato con `page.total`
- `onPaginationModelChange` traduce `page/pageSize` in `offset/limit` e notifca il parent.

Le colonne includono campi derivati dall’ID del finding (vedi sotto), oltre al campo “Target” pre-caricato nella pagina.

### Parsing dell’ID e campi derivati

Per ridurre il payload necessario in tabella e rendere la lista più leggibile, la DataGrid estrae porzioni strutturate dall’ID:

- `type`, `scope`, `subject`, e `rule` vengono ricavati con funzioni `extract*` che:
    - fanno `decodeURIComponent(id)`
    - eseguono `split(':')`
    - prelevano indici stabiliti (assunzione di formato colon-separated)

In caso di formato non conforme o decode fallito, i getter restituiscono stringa vuota, mantenendo la tabella stabile.

### Drawer dei dettagli

L’apertura del dettaglio avviene tramite action (icona “view”):

- click sull’azione:
    - `setOpen(true)`
    - `fetchFinding(id)` → `techstackService.getTechstackFindingById(id)`
- contenuto del drawer:
    - intestazione con `Chip` di regola, severità (mappata in colore), e `evidenceType`
    - blocco “Finding” con attributi principali (id, target, resolver, descrizione, remediation)
    - sezioni evidence: **cookie**, **header**, **software**, ciascuna con empty-state dedicato

Utility UI:
- mapping severità → colore chip (`LOW/INFO`, `MEDIUM/WARNING`, `HIGH|CRITICAL/ERROR`)
- layout a sezioni con `Divider` per scansione rapida

### Convenzioni di caricamento ed empty state

- Primo caricamento:
    - `Backdrop + CircularProgress` quando `loading && rows.length === 0`, così da evitare una tabella vuota “lampeggiante”.
- Caricamenti successivi:
    - tabella resta visibile con `loading` agganciato alla DataGrid.
- Nessun dato:
    - testo centrale “No findings to show.”
- Errori:
    - feedback via snackbar; la UI rimane operativa e non blocca l’interazione più del necessario.

### Caratteristiche riusabili nella dashboard

La pagina riutilizza pattern e componenti comuni che ricorrono in altre sezioni:
- `DrawerWrapper` come contenitore standard per i pannelli di dettaglio
- DataGrid con paginazione server-side e action column
- snackbar globali (`notistack`) per comunicare errori e stati di esito senza introdurre modali invasive

---