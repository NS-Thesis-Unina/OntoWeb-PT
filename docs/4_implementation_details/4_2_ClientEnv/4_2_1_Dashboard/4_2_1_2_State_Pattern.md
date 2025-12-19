# Stato applicativo e pattern
---

La dashboard adotta un approccio **hook-based** (React) per la gestione dello stato: non compare uno store centrale (Redux, Zustand, ecc.), quindi lo stato rimane **locale alle pagine** o ai componenti “smart”, mentre le funzionalità trasversali vengono gestite tramite **provider** globali (tema e notifiche). L’integrazione verso il backend passa attraverso un piccolo **service layer** basato su Axios e, dove serve real-time, su Socket.IO.

---

## Provider globali e stato condiviso

### ThemeModeProvider

Il tema (light/dark) viene gestito tramite un **Context** dedicato (`ThemeModeContext`) con API minimale:
- `mode`: valore corrente (`light` | `dark`)
- `setMode(nextMode?)`: imposta esplicitamente o alterna se omesso
- `toggleMode()`: alias di `setMode()` senza argomento
- persistenza tramite `localStorage` (chiave `ui_theme_mode`)

Un dettaglio implementativo rilevante è il flag `ready`: il rendering dei figli parte solo quando il tema è stato risolto (lettura da storage o fallback). In questo modo si evita flicker tra modalità durante il primo mount.

Accesso al contesto tramite hook: `useThemeMode()`.

### Notifiche globali

`SnackbarProvider` (notistack) è montato in `main.jsx` e abilita toast globali. Nelle pagine, le notifiche vengono emesse usando `enqueueSnackbar(...)` direttamente dentro i blocchi `catch` o a seguito di operazioni completate.

---

## Service layer e gestione dello “stato remoto”

### httpClient

La comunicazione REST si appoggia a un’istanza Axios centralizzata (`services/httpClient.js`):
- `baseURL` ricavata da `VITE_API_BASE_URL` (fallback: `http://localhost`)
- `timeout` a 15s
- interceptor di risposta “pass-through”: gli errori vengono propagati e gestiti dai caller

L’assenza di un interceptor di normalizzazione errori sposta la responsabilità di estrarre il messaggio (e decidere come mostrarlo) sulle singole pagine.

### Servizi di dominio

I file in `services/` seguono un pattern uniforme:
- funzioni “thin wrapper” sugli endpoint (`GET/POST`)
- ritorno diretto di `res.data`
- `encodeURIComponent` su path param (`/results/:jobId`, `/finding/:id`, ecc.)
- query params passati via `{ params }` nelle operazioni di listing

Esempi:
- `httpRequestsService`: ingest, results polling, list, getById, findings list/detail
- `techstackService` / `analyzerService`: analyze, results, findings list/detail
- `pcapService`: upload multipart (`FormData`) per endpoint PCAP
- `sparqlService`: query/update SPARQL tramite API backend

---

## Pattern tipici nelle pagine

### Liste paginate e filtri controllati (HttpRequests)

La pagina `pages/httpRequests/httpRequests.jsx` rappresenta il pattern più comune per dati remoti:

**Stato principale**
- `loading`: flag di caricamento generale
- `params`: `{limit, offset}` usati per l’ultima fetch
- `page`: metadati server-side (total, offset, limit, next/prev…)
- `rows`: righe della tabella
- `filters`: set di filtri controllati (stringhe)

**Fetch lifecycle**

- costruzione parametri tramite `buildRequestParams(offset, limit, filters)`
    - trimming delle stringhe
    - rimozione dei valori vuoti
- `fetchRequests` con `try/catch/finally`
    - `setLoading(true)` prima della request
    - aggiornamento di `rows`, `page`, `params`, `filters`
    - snackbar in errore (`variant: 'error'`)
    - `setLoading(false)` in `finally`

**Rendering e UX**
- primo caricamento: Backdrop bloccante quando `loading && rows.length === 0`
- caricamenti successivi: griglia visibile con spinner interno (`DataGrid loading`)
- empty state: “No requests to show.”

Nota: la variabile `applyFilter` è definita come variabile di funzione (`var applyFilter = false`). Il commento nel codice segnala correttamente che una `useRef` renderebbe il comportamento più stabile rispetto a re-render e callback asincrone.

### Toolbar filtri con snapshot “last applied” (HttpRequestsFilters)

`HttpRequestsFilters` mantiene un piccolo stato interno:
- `appliedFilters`: snapshot dell’ultimo set applicato
- `hasChanges`: calcolato via `useMemo` confrontando filtri normalizzati

Il componente resta **controllato** dal parent (`filters` + `onChange`), ma gestisce internamente la logica per abilitare/disabilitare “Apply” senza imporre ulteriore complessità alla pagina.

### Liste con fetch multipla e adattamento a righe (TechstackFindings)

`pages/findings/techstackFindings/techstackFindings.jsx` usa un approccio diverso:
1. `listTechstackFindings` ritorna una lista di ID
2. `Promise.all` esegue `getTechstackFindingById(id)` per arricchire ogni riga (es. `target`)

Il flusso crea un effetto “N+1” (una request per item), mitigato dal fatto che gli errori per singolo item non bloccano l’intera lista: in caso di fallimento, viene prodotta una riga parziale (`target: null`) e la pagina continua a renderizzare.

---

## Componenti “smart”: DataGrid + Drawer on-demand

### Dettagli su richiesta (HttpRequestsDataGrid)

`HttpRequestsDataGrid` incapsula logica di stato locale legata al dettaglio:
- `open`: apertura/chiusura drawer
- `loadingRequest`: caricamento del dettaglio
- `request`: payload completo della request selezionata

Il dettaglio non viene pre-caricato: il fetch parte quando l’utente clicca l’icona “View details”. In caso di errore:
- snackbar di errore
- drawer chiuso e `request` riportato a `null`

**Server-side pagination**  
Il backend usa `offset/limit`; MUI DataGrid usa `page/pageSize`. La conversione avviene tramite:
- `paginationModel.page = floor(offset / limit)`
- `onPaginationModelChange` che ricalcola offset/limit e chiama `onPageChange`

**Colonne con valueGetter**  
Le colonne sfruttano `valueGetter` per leggere campi annidati senza normalizzare i dati a monte (es. `row.response.status`, `row.uri.full`).

### Drawer per findings (TechstackFindingsDataGrid)

Pattern analogo:
- fetch del dettaglio on-demand
- drawer con sezioni strutturate (attributi + evidenze)
- parsing di informazioni direttamente dall’ID (colon-separated) con funzioni `extract...`

---

## Stato operativo e real-time (ToolStatus)

`pages/toolStatus/toolStatus.jsx` combina tre sorgenti di stato:

1. **Polling REST su `/health`**
	- interval ogni 5s
	- stato: `health` (payload) + `toolStatus` derivato via `deriveToolStatus`
	- fallback: `tool_off` su errori/unreachable

2. **Socket root namespace**
	- obiettivo: monitorare connettività client (`wsStatus`)
	- cambio di `wsStatus` forza la ricostruzione dell’interval di polling (dependency dell’effect)

3. **Socket namespace `/logs`**
	- evento `log` aggiunge entry al buffer
	- buffer limitato agli ultimi ~80 record (`prev.slice(-80)`), evitando crescita illimitata

La pagina deriva classi CSS (`statusCardModifier`) a partire da `toolStatus`, in modo da riflettere lo stato anche a livello visivo.

---

## Workflow a stati multipli (Send PCAP)

`pages/sendPcap/sendPcap.jsx` mostra un pattern “wizard” basato su stepper verticale, con stato più articolato:

**Stato del wizard**
- `activeStep` (0..5)
- file input: `pcapFile`, `sslKeysFile`
- dati: `requests` (estratti), `selectedRequests` (subset scelto)
- flag asincroni: `loadingExtract`, `loadingSend`, `checkingTool`
- controllo funzionale: `activateResolver`
- messaggistica: `errorMessage` (Alert persistente)
- tracking job: `jobEvents`, `openJobsDialog`
- dedup job subscription: `subscribedJobIdsRef` (`useRef(new Set())`)

**Gate su health**  
Ogni “Continue” passa da `checkToolBeforeContinue`, che blocca l’avanzamento se il tool risulta OFF o irraggiungibile.

**Integrazione job (WebSocket + fallback polling)**
- `socketService.onJobEvent` ascolta eventi `completed/failed`
- `subscribeJob(jobId)` evita doppie subscription usando `subscribedJobIdsRef`
- mentre il dialog è aperto (`openJobsDialog`), parte un polling ogni 3s su `getHttpIngestResult(jobId)` per recuperare lo stato anche in caso di perdita socket
- chiusura dialog:
    - unsubscribe best-effort dei job ancora in Set
    - reset completo del wizard (step, file, selezioni, flag, eventi)

**Batching e sanitizzazione payload**  
Il helper `makeBatchPayloads.js` implementa un adattatore robusto:
- parsing URL rigoroso (solo http/https)
- normalizzazione method e headers
- conversione body in base64 con limiti su dimensione decodificata
- split in batch basati su byte size stimata (TextEncoder), con `maxBytes` e `safetyMargin`

---

## Convenzioni ricorrenti

- **Loading**
    - Backdrop bloccante solo nel bootstrap iniziale (quando non ci sono ancora righe)
    - spinners inline o `DataGrid loading` durante refresh/paginazione
- **Empty state**
    - messaggi dedicati (“No requests to show.” / “No findings to show.”)
    - wizard: messaggi contestuali quando non ci sono richieste estratte o selezionate
- **Error state**
    - pagine lista: snackbar su errori di fetch
    - wizard: Alert persistente + scroll-to-top per rendere visibile l’errore
    - drawer: snackbar e chiusura del pannello per evitare UI incoerente

Nel complesso, lo stato viene mantenuto vicino al punto di utilizzo (pagina o componente smart), mentre i provider globali coprono esclusivamente funzionalità trasversali (tema e notifiche).

---