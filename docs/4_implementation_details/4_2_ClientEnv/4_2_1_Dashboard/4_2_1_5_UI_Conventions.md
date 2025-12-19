# UI Conventions
---

La dashboard applica un insieme di convenzioni UI ricorrenti per garantire coerenza tra pagine, ridurre ambiguità durante operazioni asincrone e mantenere una UX prevedibile anche in presenza di errori o tool non disponibile. Le regole sotto emergono direttamente dai comportamenti implementati nelle pagine principali (Requests, Findings, Tool Status, Send PCAP) e dai provider globali (tema, notifiche).

---

## 1) Stati di caricamento

### Primo caricamento “bloccante”

Per le pagine che mostrano liste principali (es. `HttpRequests`, `TechstackFindings`), il bootstrap iniziale usa un **Backdrop con CircularProgress** quando:
- `loading === true`
- e non esistono ancora dati renderizzabili (`rows.length === 0`)

Obiettivo: evitare che l’utente veda una tabella vuota “ambigua” durante il primo fetch.

### Refresh non bloccante

Dopo il primo caricamento, la UI tende a mantenere visibile il contenuto corrente e delega lo spinner al componente dati:
- `DataGrid` con prop `loading={loading}` per indicare aggiornamenti in corso (paginazione server-side, refetch dopo filtri, ecc.)

Obiettivo: preservare contesto e continuità visiva durante interazioni frequenti.

### Operazioni “wizard” con progress inline

Nel flusso `SendPcap` le operazioni lunghe si presentano come:
- progress inline nella sezione dello step corrente (es. estrazione, invio)
- disabilitazione dei comandi di navigazione (“Continue”, “Back”) durante attività critiche

Obiettivo: segnalare chiaramente che l’azione è in corso senza cambiare schermata o introdurre stati “fantasma”.

---

## 2) Empty state

Quando un dataset risulta vuoto, la pagina mostra un **messaggio esplicito** (tipicamente `Typography` centrata), invece di lasciare un componente tabellare privo di righe.

Esempi:
- Requests: “No requests to show.”
- Findings: “No findings to show.”
- Stepper PCAP: messaggi contestuali quando non esistono richieste estratte o selezionate

Obiettivo: distinguere chiaramente “nessun dato disponibile” da “dati in caricamento” o “errore”.

---

## 3) Error state e feedback all’utente

### Errori operativi: snackbar

Per errori legati a chiamate REST o fetch puntuali (liste, dettagli, drawer), il pattern dominante usa `enqueueSnackbar` con `variant: 'error'`.  
Il provider globale (`SnackbarProvider`) imposta:
- `maxSnack={1}` (evita stacking rumoroso)
- posizione in basso a sinistra (`anchorOrigin`)

Obiettivo: segnalare problemi senza bloccare il flusso, mantenendo interazione rapida.

### Errori di flusso: alert persistente

Nel wizard `SendPcap`, gli errori che impediscono il proseguimento vengono resi come:
- `Alert` persistente in alto (dismissibile)
- scroll automatico verso l’alto del contenitore contenuti (`.nw-div .content-div .right-div`) per renderlo subito visibile

Obiettivo: rendere “blocking errors” impossibili da ignorare, evitando che restino fuori viewport.

### Errori nel dettaglio: chiusura controllata

Nei drawer di dettaglio (es. richiesta HTTP o finding), in caso di errore durante il fetch:
- snackbar di errore
- pulizia dello stato locale (`request/finding = null`)
- chiusura del drawer per evitare pannelli aperti senza contenuto coerente

Obiettivo: evitare UI “a metà” (drawer vuoto o con dati parziali non affidabili).

---

## 4) Progressive disclosure: lista → dettaglio

Molte sezioni adottano una regola costante:
- la lista mostra campi essenziali e azioni minime
- il dettaglio completo viene caricato **on-demand** e reso in un drawer laterale

Vantaggi:
- riduzione del payload iniziale delle liste
- contenuto ricco (headers, body, evidenze) disponibile solo quando serve
- comportamento prevedibile: “View details” → loading → rendering strutturato

---

## 5) Paginazione server-side e controlli coerenti

Le tabelle principali usano `paginationMode="server"` e mantengono:
- `rowCount` coerente con `page.total`
- conversione stabile tra `offset/limit` (backend) e `page/pageSize` (DataGrid)

Obiettivo: mantenere navigazione pagine deterministica e allineata al contratto REST, evitando discrepanze tra UI e backend.

---

## 6) Health-gating e prevenzione azioni inutili

Operazioni sensibili (invio richieste, estrazione, avanzamento step) vengono condizionate allo stato tool:
- `SendPcap` esegue health check prima di avanzare
- in caso di tool OFF/irraggiungibile, l’interazione viene bloccata con messaggio esplicito

In parallelo, la shell di navigazione mostra un indicatore sintetico (“Tool On / Checking / Tool Off”) per offrire contesto immediato anche fuori dalle pagine operative.

Obiettivo: prevenire workflow destinati a fallire per indisponibilità infrastrutturale.

---

## 7) Real-time views: buffer limit e leggibilità

Nel pannello log real-time (`ToolStatus`):
- la lista log viene mantenuta come rolling buffer (ultimi ~80 eventi)
- rendering strutturato: timestamp, livello, namespace, messaggio

Obiettivo: evitare crescita illimitata dello stato e mantenere l’area log utile anche su sessioni lunghe.

---

## 8) Interazioni “best-effort” e fallback non invasivi

Alcune funzionalità sono gestite in modalità “best-effort” senza interrompere la UX:
- copy-to-clipboard: fallimenti silenziosi (console) senza bloccare UI
- job monitoring: WebSocket come canale primario + polling REST come fallback quando serve (dialog job aperto)

Obiettivo: resilienza senza introdurre complessità visiva o prompt ripetuti.

---

## 9) Coerenza visiva: tema e baseline

Il tema è controllato da un provider globale e:
- persiste su `localStorage` (`ui_theme_mode`)
- evita flicker grazie a un gating (`ready`) prima del rendering dei figli
- applica `CssBaseline` per uniformare lo stile base Material UI

Obiettivo: look & feel stabile e consistente in tutte le route, con transizioni tra pagine prive di “salti” di stile.

---