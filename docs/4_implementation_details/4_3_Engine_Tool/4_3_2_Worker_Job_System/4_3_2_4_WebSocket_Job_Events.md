# WebSocket Job Events
---

Questa sezione descrive **come gli eventi di lifecycle dei job** vengono propagati in tempo reale dal **Worker/Job System** ai client (Dashboard ed estensione) tramite **WebSocket**, illustrando il flusso end-to-end, i tipi di eventi esposti e le scelte implementative adottate.

L’obiettivo è fornire **osservabilità real-time** sullo stato dei job senza introdurre polling aggressivo o coupling diretto tra client e Redis.

---

## 1) Ruolo del WebSocket nel Job System

Il WebSocket rappresenta il **canale primario di notifica** per:
- avanzamento del lifecycle dei job (`active`, `completed`, `failed`);
- correlazione immediata tra un `jobId` e il suo esito;
- visualizzazione dello stato in tempo reale su Dashboard ed Extension.

Il modello adottato è **event-driven**:
- Redis + BullMQ gestiscono lo stato;
- l’API Server fa da **fan-out hub** verso i client;
- i client si sottoscrivono solo ai job di interesse.

---

## 2) Architettura di propagazione eventi

### 2.1 Componenti coinvolti

1. **BullMQ (Redis)**
    - emette eventi di queue (`completed`, `failed`, ecc.).
2. **QueueEvents (API Server)**
    - si collega a Redis e ascolta gli eventi di ogni queue.
3. **Socket.IO Server (API Server)**
    - inoltra gli eventi ai client tramite WebSocket.
4. **Client (Dashboard / Extension)**
    - si sottoscrive ai job tramite `jobId`.

Il worker **non parla direttamente con i client**: tutta la fan-out passa dall’API Server.

---

## 3) Namespace e canali WebSocket

### 3.1 Namespace `/logs` (contesto)

Anche se non direttamente legato ai job event:
- `/logs` fornisce log in tempo reale;
- i log aiutano a interpretare lo stato dei job in corso;
- worker e API inviano log allo stesso stream.

I job event descritti qui invece transitano sul **namespace di default**.

---

## 4) Sottoscrizione ai job (`job:<jobId>`)

### 4.1 Modello a “room”

Ogni job è mappato a una **room Socket.IO**:
```
job:<jobId>
```
Il client:
- richiede esplicitamente la sottoscrizione;
- riceve solo gli eventi relativi a quel job.

### 4.2 Eventi di controllo lato client

|Evento|Direzione|Scopo|
|---|---|---|
|`subscribe-job`|client → server|Inizia l’ascolto per un job|
|`unsubscribe-job`|client → server|Interrompe l’ascolto|

Questa scelta evita broadcast globali e mantiene basso il traffico.

---

## 5) Eventi BullMQ propagati

### 5.1 Eventi principali

Il sistema propaga attualmente:
- `completed`
- `failed`

Ogni evento viene emesso come:

```
{   
	"queue": "http | sparql | techstack | analyzer",   
	"jobId": "123",   
	"...": "payload BullMQ" 
}
```

Il campo `queue` è aggiunto dall’API Server per permettere al client di distinguere il dominio funzionale del job.

---

### 5.2 Origine degli eventi

Per ogni queue esiste un `QueueEvents` dedicato:
- HTTP requests
- SPARQL updates
- Techstack analysis
- Analyzer (SAST)

Ogni `QueueEvents`:
- ascolta Redis;
- inoltra eventi solo quando è disponibile un `jobId`;
- ignora errori non associabili a un job specifico.

---

## 6) Forwarding logico degli eventi

L’API Server utilizza un helper di forwarding che:
1. intercetta l’evento BullMQ;
2. estrae `jobId`;
3. emette l’evento sulla room `job:<jobId>`;
4. arricchisce il payload con il nome della queue.

Questo garantisce:
- disaccoppiamento tra BullMQ e WebSocket;
- payload omogenei per tutti i client;
- semplicità lato frontend.

---

## 7) Sequenza tipica di eventi

Esempio di flusso osservato dal client:

```
POST /analyze/techstack 
→ accepted + jobId  

WS subscribe-job(jobId)
→ (opzionale) log "job started"  
 
→ completed
```

In caso di errore:
`→ failed`

Il client può:
- aggiornare la UI (success / error);
- chiudere dialog;
- avviare fetch dei risultati persistiti.

---

## 8) Relazione con REST polling

Il WebSocket **non sostituisce completamente** il REST polling.

Strategia adottata:
- WebSocket:
    - canale principale;
    - latenza minima;
    - UX fluida.
- REST:
    - fallback se WS non disponibile;
    - riconciliazione in caso di eventi persi;
    - accesso a job “storici” (finché presenti in Redis).

---

## 9) Gestione disconnessioni

### 9.1 Client

- la sottoscrizione alle room **non è persistente**;
- su reconnect il client deve:
    - ri-iscriversi ai job ancora rilevanti;
    - opzionalmente fare polling di riconciliazione.

### 9.2 Server

- nessuna memoria server-side delle sottoscrizioni precedenti;
- ogni connessione è trattata come nuova.

Questo mantiene il sistema semplice e stateless.

---

## 10) Limiti noti

- Non vengono propagati eventi di `progress` dettagliato.
- Nessuna persistenza degli eventi WebSocket.
- Gli eventi sono disponibili solo se:
    - il client è connesso,
    - il job non è stato già rimosso da Redis.

Questi limiti sono accettabili perché:
- lo stato definitivo è comunque interrogabile via REST;
- il valore reale risiede nei dati persistiti (GraphDB).

---

## 11) Riepilogo

- I job event sono propagati via WebSocket in **tempo reale**.
- L’API Server agisce da **bridge** tra BullMQ e i client.
- La sottoscrizione avviene per `jobId` tramite room dedicate.
- Il modello è:
    - scalabile,
    - disaccoppiato,
    - coerente con la persistenza temporanea dei job.

---