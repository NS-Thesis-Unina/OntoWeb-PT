# Job State Persistence
---

Questa sezione descrive **come viene gestita la persistenza dello stato dei job** nel sistema Worker/Job System, chiarendo **dove vive lo stato**, **per quanto tempo**, e **come viene osservato** da API Server, Dashboard ed estensione.

L’obiettivo non è introdurre un database custom per i job, ma sfruttare **BullMQ + Redis** come _single source of truth_ per lo stato e il lifecycle dei job.

---

## 1) Principio generale

Il sistema **non implementa un layer di persistenza custom** per i job (DB relazionale o documentale).  
Lo stato dei job è:
- **persistito interamente in Redis**, tramite BullMQ;
- **gestito automaticamente** dal framework (state machine, retry, backoff);
- **consultato indirettamente** via:
    - eventi WebSocket (push),
    - API REST di polling (fallback),
    - dashboard di osservabilità (log + job events).

Questo approccio riduce complessità e duplicazioni, mantenendo uno stato coerente e atomico.

---

## 2) Dove vive lo stato dei job

### 2.1 Redis come storage primario

BullMQ utilizza Redis per memorizzare:
- metadata del job:
    - `jobId`
    - `name`
    - `data`
    - `opts` (attempts, backoff, ecc.)
- stato corrente:
    - `waiting`
    - `active`
    - `completed`
    - `failed`
    - `delayed`
- informazioni di retry:
    - numero tentativi effettuati
    - `failedReason`
    - `stacktrace`
- risultato del job (`return value`) per job completati

Non esiste **alcuna copia parallela** dello stato job nel codice applicativo.

---

## 3) Lifecycle persistito (BullMQ state machine)

Il lifecycle standard di un job è:

```
created → waiting → active → completed                        
						↘ failed
```

Con retry abilitati:

```
failed → delayed → waiting → active → ...
```

Ogni transizione viene:
- scritta su Redis,
- notificata tramite `QueueEvents`,
- resa disponibile a consumer esterni (API / dashboard).

---

## 4) Retention e cleanup dello stato

### 4.1 Politica `removeOnComplete` / `removeOnFail`

Ogni queue definisce politiche di retention **limitate**, ad esempio:
```
removeOnComplete: 300 
removeOnFail: 800
```

Significa:
- vengono mantenuti **solo gli ultimi N job** completati/falliti;
- i job più vecchi vengono rimossi automaticamente da Redis.

**Motivazione:**
- evitare crescita illimitata del keyspace Redis;
- lo storico “lungo” dei job **non è un requisito** funzionale;
- i risultati persistenti “reali” sono i dati scritti su GraphDB, non i job.

---

### 4.2 Implicazioni per il client

- un `jobId` molto vecchio **potrebbe non essere più interrogabile** via REST;
- questo è accettabile perché:
    - il client segue il job in tempo reale (WebSocket),
    - il job è “terminale” una volta completato,
    - il dato finale è consultabile tramite endpoint di lettura (findings, HTTP requests, ecc.).

---

## 5) Stato del job e API Server

### 5.1 Polling REST (fallback)

Quando il WebSocket non è disponibile o per recuperare stato “a freddo”, l’API Server espone endpoint tipo:

`GET /jobs/:queue/:jobId`

Internamente:
- l’API interroga BullMQ (che legge da Redis);
- restituisce:
    - `state`
    - `progress`
    - `returnvalue`
    - `failedReason` (se presente).

**Nota:** se il job è stato rimosso per retention, l’API risponde con:
- `ok: false` o errore “job not found”.

---

## 6) Stato del job e WebSocket

### 6.1 Eventi come “stato effimero”

Gli eventi WebSocket (`completed`, `failed`, ecc.):
- **non sono persistiti** lato applicazione;
- rappresentano una _vista live_ dello stato BullMQ;
- sono rigiocabili solo finché il job esiste in Redis.

Il client quindi adotta una strategia **ibrida**:
- WebSocket per aggiornamenti real-time,
- REST polling per riconciliazione.

---

## 7) Progress e payload intermedi

Nel codice attuale:
- **non viene usato** `job.updateProgress()` in modo strutturato;
- lo stato “intermedio” è espresso principalmente tramite:
    - log (stream su `/logs`),
    - eventi `active` / `completed` / `failed`.

Questo significa che:
- la progress bar lato UI è binaria o approssimata;
- la granularità di avanzamento è demandata ai log.

> Se in futuro servisse progress fine-grained, BullMQ lo supporta nativamente senza cambiare il modello di persistenza.

---

## 8) Differenza tra stato job e stato dominio

È importante distinguere:

|Tipo di stato|Dove vive|Persistenza|
|---|---|---|
|Stato job (running / completed)|Redis (BullMQ)|Temporanea|
|Log esecuzione|Stream WebSocket|Effimera|
|Risultati di dominio (HTTP, findings, ecc.)|GraphDB|Persistente|

Una volta completato il job:
- **lo stato del job può sparire**,
- **il risultato di dominio rimane** ed è interrogabile via API.

---

## 9) Limiti noti

- Nessuna persistenza “storica” dei job oltre la retention configurata.
- Nessuna correlazione persistente job ↔ entità dominio (se non indiretta via timestamp/log).
- Nessun resume di job “a metà” dopo crash del worker (BullMQ riprende solo retry automatici).

Questi limiti sono **scelte progettuali consapevoli**, coerenti con:
- natura batch/async dei job,
- osservabilità demandata a WebSocket + log,
- GraphDB come unico storage persistente di valore applicativo.

---

## 10) Riepilogo

- **Redis + BullMQ** sono l’unica fonte di verità per lo stato dei job.
- Lo stato è **persistito automaticamente**, ma **con retention limitata**.
- Il client osserva lo stato tramite:
    - WebSocket (push),
    - REST (polling fallback).
- I risultati “veri” sopravvivono al job e vivono su **GraphDB**.

---