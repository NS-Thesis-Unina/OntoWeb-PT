# WebSocket Integration
---

La dashboard utilizza **Socket.IO** per ricevere eventi in tempo reale dal Tool. Nel codice emergono due modalità d’uso:
1. **Connessione diretta** dentro una pagina (approccio “page-owned”), usata in `ToolStatus`.
2. **Connessione incapsulata** in un service (`services/socketService.js`), usata per seguire il ciclo di vita dei job (subscribe/unsubscribe + eventi).

Entrambi gli approcci forzano il trasporto `"websocket"` per evitare fallback su long-polling e rendere più prevedibile il comportamento in ambienti restrittivi.

---

## Configurazione degli endpoint Socket

### ToolStatus: env dedicati per log e root

`ToolStatus` costruisce due connessioni leggendo variabili Vite:
- `VITE_LOGS_WS_URL` (fallback: `http://localhost:8081`)  
    usata per la connessione al **namespace root** (stato connettività).
- `VITE_LOGS_WS_URL_LOGS` (fallback: `http://localhost:8081/logs`)  
    usata per la connessione al **namespace `/logs`** (stream di log).

Il valore passato a `io(...)` resta in forma HTTP; Socket.IO gestisce internamente upgrade a WebSocket, mentre `transports: ['websocket']` limita comunque il trasporto effettivo.

### socketService: base URL risolta a runtime

`services/socketService.js` calcola l’origin socket così:
1. `VITE_SOCKETS_URL` (override esplicito)
2. `httpClient.defaults.baseURL` (allineamento con REST)
3. `window.location.origin` (fallback)

Dopo aver risolto l’origin, il codice sostituisce `http` → `ws` via regex (`base.replace(/^http/, 'ws')`) prima di creare il client Socket.IO.

---

## Pattern 1: Socket “page-owned” in ToolStatus

`pages/toolStatus/toolStatus.jsx` apre **due socket indipendenti**:

### Root namespace (connettività)

- Scopo: aggiornare `wsStatus` (`connected` / `disconnected`)
- Listener:
    - `connect` → `setWsStatus('connected')`
    - `disconnect` → `setWsStatus('disconnected')`
- Cleanup: `socket.disconnect()` in unmount

Un dettaglio implementativo: il polling REST su `/health` viene ricreato quando cambia `wsStatus` (dipendenza dell’effect). In pratica, un flip di connettività forza un refresh più “reattivo” dello stato tool.

### Namespace `/logs` (stream log)

- Scopo: mostrare log real-time in una “tail view”
- Listener:
    - evento `log` → aggiunge entry al buffer
- Buffer limitato:
    - `setLogs((prev) => [...prev.slice(-80), entry])`  
        mantiene solo gli ultimi ~80 eventi per evitare crescita illimitata
- Cleanup: `logSocket.disconnect()` in unmount

---

## Pattern 2: Socket incapsulata per job lifecycle (socketService)

`services/socketService.js` mantiene una **singleton connection** (`let socket = null`) creata lazy alla prima chiamata.

### Creazione socket
- `io(url, { transports: ['websocket'] })`
- Nessun namespace esplicito (connessione al root endpoint risolto dal base URL)

### Subscribe / Unsubscribe (room-based)

Il service espone:
- `subscribeJob(jobId)`  
    emette `subscribe-job` con `String(jobId)`
- `unsubscribeJob(jobId)`  
    emette `unsubscribe-job` con `String(jobId)`

Il contratto implicito lato server: il backend associa quel jobId a una room/stream e inoltra eventi solo ai client iscritti.

### Eventi job

`onJobEvent(handler)` registra due listener:
- `completed` → chiama `handler({ event: 'completed', ...payload })`
- `failed` → chiama `handler({ event: 'failed', ...payload })`

Il metodo ritorna una funzione di cleanup che rimuove entrambi i listener (`off`).

---

## Integrazione job in Send PCAP

`pages/sendPcap/sendPcap.jsx` usa `socketService` per aggiornamenti live del job processing:

- mount:
    - `socketService.onJobEvent(...)` push-a eventi in `jobEvents`
    - cleanup best-effort alla dismissione della pagina
- dedup delle subscription:
    - `subscribedJobIdsRef = useRef(new Set())`
    - `subscribeJob(jobId)` controlla il Set prima di chiamare il service, evitando doppie iscrizioni
- chiusura dialog job:
    - `unsubscribeJob(id)` per ogni job ancora in Set (best-effort)
    - reset completo dello stato wizard

---

## Strategia di resilienza: WebSocket + fallback REST

Durante la visualizzazione delle “Job Summaries”, `SendPcap` attiva anche un polling REST periodico:
- ogni 3s chiama `httpRequestsService.getHttpIngestResult(jobId)`
- crea un evento “sintetico” (`completed` / `failed` / `update`) in base a `res.state`
- rimuove dal Set i job conclusi, così il polling si spegne quando non restano job attivi

Il risultato pratico: anche con socket instabile o interrotto, la dashboard recupera lo stato dei job tramite REST e mantiene la UI coerente.

---

## Lifecycle e cleanup

- ToolStatus:
    - due socket separate, entrambe disconnesse in unmount
- socketService:
    - singleton che rimane viva finché l’app è attiva
    - cleanup dei listener gestito da `onJobEvent()` tramite funzione di unsubscribe
- componenti consumer (es. SendPcap):
    - rimuovono listener in unmount (try/catch best-effort)

---

## Event contract riassunto

- Namespace root (ToolStatus):
    - `connect`, `disconnect` (eventi standard Socket.IO)
- Namespace `/logs`:
    - `log` → payload strutturato (ts, level, ns, msg) consumato dal pannello log
- Job channel (socketService):
    - client → server: `subscribe-job`, `unsubscribe-job`
    - server → client: `completed`, `failed` con payload del job

Questo set di eventi copre due casi d’uso distinti: **osservabilità operativa** (logs + connectivity) e **tracciamento asincrono dei job** (completed/failed), entrambi integrati senza introdurre uno store globale dedicato.

---