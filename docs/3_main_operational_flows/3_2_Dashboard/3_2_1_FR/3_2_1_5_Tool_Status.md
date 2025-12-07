# Tool Status – Requisiti Funzionali
---

**FR-DASH-STAT-01 – Panoramica funzionale della pagina Tool Status**

La pagina “Tool Status” deve fornire all’utente una vista operativa in tempo quasi reale sullo stato del backend OntoWeb-PT, aggregando:
- lo stato complessivo dello strumento (tool on/off/checking) derivato dall’endpoint di health;
- lo stato dei singoli componenti critici (API server, Redis, GraphDB, WebSocket);
- un pannello di log in tempo reale provenienti dal backend.

Requisiti:
- La pagina deve essere accessibile dalla navigazione globale alla voce **Tool Status** (`/server-status`).
- Il layout deve comprendere tre blocchi principali:
    - **Card principale** con lo stato consolidato del tool.
    - **Griglia componenti** con uno StatusCard per ogni sottosistema (API Server, Redis, GraphDB, WebSocket).
    - **Pannello “Real-Time Logs”** con una lista scorrevole degli ultimi eventi di log.
- Il contenuto deve aggiornarsi automaticamente senza richiedere azioni manuali dell’utente (no “refresh” espliciti).

Da prospettiva utente: “Apro Tool Status e vedo subito se il tool è attivo, quali componenti sono su/giù e una coda di log che scorre in tempo reale.”

---

**FR-DASH-STAT-02 – Recupero health backend e derivazione dello stato consolidato**

La pagina deve interrogare periodicamente il servizio REST di health per ottenere lo stato dei componenti e derivare uno stato complessivo del tool.

Requisiti:
- Deve essere invocato il servizio `getHealth()` che restituisce una struttura `health` con, almeno, la sezione `components` (es. `health.components.server`, `health.components.redis`, `health.components.graphdb`).
- A partire da `health` deve essere invocata `deriveToolStatus(health)` che produce un valore testuale tra:
    - `tool_on`
    - `checking`
    - `tool_off`
- Se la chiamata a `getHealth()` va a buon fine:
    - lo stato locale `health` deve essere aggiornato con il payload ricevuto;
    - lo stato `toolStatus` deve essere aggiornato con il risultato di `deriveToolStatus`.
- In caso di errore o servizio irraggiungibile:
    - lo stato `health` deve essere impostato a `null`;
    - lo stato `toolStatus` deve assumere il valore `tool_off`;
    - la pagina deve rimanere comunque utilizzabile (nessun errore bloccante).

Da prospettiva utente: “Se l’API di health non risponde, vedo il tool come ‘Tool Off’ ma la pagina non si rompe.”

---

**FR-DASH-STAT-03 – Polling periodico dell’endpoint di health e sincronizzazione con WebSocket**

L’aggiornamento dello stato health deve avvenire in modo periodico e reattivo rispetto allo stato della connessione WebSocket.

Requisiti:
- All’apertura della pagina deve essere eseguita immediatamente una chiamata `getHealth()` per popolare lo stato iniziale.
- Successivamente, la pagina deve effettuare un polling ricorrente di `getHealth()` con intervallo di circa **5 secondi**, finché l’utente rimane sulla vista.
- Ogni cambiamento dello stato di connessione WebSocket principale (`wsStatus` passato da `connected` a `disconnected` o viceversa) deve:
    - causare la ricreazione del timer di polling;
    - portare a una nuova esecuzione di `getHealth()` (in modo da riflettere eventuali cambiamenti di stato dovuti alla riconnessione o disconnessione).
- Il polling deve sempre essere correttamente smantellato in un cleanup (clearInterval) quando la pagina viene smontata, evitando timer zombie.

---

**FR-DASH-STAT-04 – Card principale: visualizzazione stato tool e ultimo aggiornamento**

Nella parte superiore della pagina deve essere presente una card principale che riassume lo stato globale del tool.

Requisiti:
- Il titolo deve mostrare una stringa del tipo:  
    `Tool Status: <toolStatus>`  
    dove `<toolStatus>` è il valore corrente (`tool_on`, `checking`, `tool_off`).
- Sotto il titolo deve essere riportata una riga con l’ultimo orario di aggiornamento, calcolato in locale:  
    `Ultimo aggiornamento: <ora locale>` (usando `new Date().toLocaleTimeString()`).
- La card deve contenere una **barra di progresso** (LinearProgress) il cui colore rifletta lo stato consolidato:
    - `tool_on` → barra con intento “success” (verde);
    - `checking` → barra con intento “warning” (giallo/arancio);
    - `tool_off` → barra con intento “error” (rosso).
- Il colore della card (tramite classi/modificatori CSS) deve essere coerente con il valore di `toolStatus`, così da rendere immediata la lettura dello stato.

Da prospettiva utente: “Vedo subito una card grande che mi dice se il tool è on, off o in checking, con un colore coerente e l’orario dell’ultimo refresh.”

---

**FR-DASH-STAT-05 – Griglia stato componenti (API Server, Redis, GraphDB, WebSocket)**

Sotto la card principale deve essere mostrata una griglia di card che rappresentano lo stato dei singoli componenti.

Requisiti:
- Devono essere visualizzate quattro StatusCard:
    - **API Server** → stato basato su `health.components.server`;
    - **Redis** → stato basato su `health.components.redis`;
    - **GraphDB** → stato basato su `health.components.graphdb`;
    - **WebSocket** → stato basato su `wsStatus` (root WebSocket).
- Se `health` è `null` o un singolo componente non è valorizzato, il relativo `status` deve essere considerato falsy e quindi normalizzato a `down` (vedi requisito successivo).
- Le card devono aggiornarsi automaticamente ogni volta che:
    - arriva una nuova risposta da `getHealth()`; oppure
    - cambia lo stato `wsStatus`.
- La griglia deve essere responsiva (layout a 2 colonne su desktop, 1 colonna su schermi ridotti).

Da prospettiva utente: “Sotto lo stato globale vedo quattro box: uno per API, uno per Redis, uno per GraphDB e uno per WebSocket, ognuno con un pallino colorato e il relativo stato scritto.”

---

**FR-DASH-STAT-06 – Normalizzazione degli stati e codifica visiva nelle StatusCard**

Ogni StatusCard deve visualizzare lo stato del componente in forma sia testuale che visiva (indicatore colorato).

Requisiti:
- Il valore raw passato come `status` alla StatusCard deve essere normalizzato come segue:
    - se `status` è falsy → `normalized = 'down'`;
    - altrimenti `normalized = status` (stringa così com’è).
- La classe (colore) dell’indicatore circolare deve essere determinata da `normalized`:
    - `up` o `connected` → indicatore verde (`statuscard-indicator--green`);
    - `connecting` → indicatore giallo (`statuscard-indicator--yellow`);
    - `down` o `disconnected` → indicatore rosso (`statuscard-indicator--red`);
    - per valori non mappati si deve usare comunque il rosso (fallback conservativo).
- Sotto il titolo della card deve essere mostrato il valore normalizzato come testo (“up”, “down”, “connected”, “disconnected”, ecc.).
- L’assenza di dati o stati non riconosciuti non deve generare errori UI, ma portare semplicemente a un pallino rosso con stato testuale coerente.

---

**FR-DASH-STAT-07 – Gestione della connessione WebSocket principale (root namespace)**

La pagina deve monitorare lo stato della connessione WebSocket principale per fornire un segnale dell’operatività del canale real-time.

Requisiti:
- All’inizializzazione della pagina deve essere aperta una connessione WebSocket verso il namespace root del backend (es. `ws://…` senza suffissi di path “/logs”).
- Lo stato `wsStatus` deve essere aggiornato automaticamente:
    - su evento `connect` → `wsStatus = 'connected'`;
    - su evento `disconnect` → `wsStatus = 'disconnected'`.
- La StatusCard “WebSocket” deve riflettere il valore `wsStatus`:
    - “connected” con pallino verde;
    - “disconnected” con pallino rosso.
- La connessione WebSocket deve essere chiusa correttamente in un cleanup (disconnect) quando la pagina viene smontata.
- Un’eventuale impossibilità di connettersi al WebSocket root non deve bloccare il resto della pagina: la StatusCard WebSocket rimane su “disconnected”, mentre il polling REST continua a funzionare.

Da prospettiva utente: “Vedo se il canale WebSocket è connesso o no; se cade, la card passa a ‘disconnected’ ma il resto della pagina continua a mostrare le info disponibili.”

---

**FR-DASH-STAT-08 – Sottoscrizione al namespace /logs e buffer circolare dei log**

Per il pannello “Real-Time Logs” deve essere mantenita una connessione WebSocket dedicata alla ricezione di log strutturati.

Requisiti:
- All’inizializzazione deve essere aperta una seconda connessione WebSocket verso il namespace `/logs` del backend.
- Per ogni evento `log` ricevuto:
    - l’oggetto `entry` deve essere aggiunto in fondo alla lista `logs`;
    - deve essere mantenuto un buffer limitato agli ultimi ~80 eventi:
        - la lista deve essere aggiornata come “coda scorrevole”, eliminando i log più vecchi per non crescere illimitatamente.
- La connessione `/logs` deve essere chiusa (disconnect) in un cleanup quando la pagina viene smontata.
- Eventuali errori o disconnessioni sul canale `/logs` non devono bloccare la UI:
    - il pannello log può restare vuoto o “congelato” sull’ultima lista valida;
    - nessuna eccezione non gestita deve causare crash della pagina.

---

**FR-DASH-STAT-09 – Rappresentazione e formattazione delle righe di log**

Ogni entry del log deve essere mostrata come riga compatta con campi principali ben distinguibili.

Requisiti:
- Per ciascun elemento `l` dell’array `logs` deve essere mostrata una riga composta da:
    - **Timestamp** (`l.ts`), con stile secondario (es. colore “secondary”).
    - **Livello** (`l.level`), racchiuso tra parentesi quadre `[level]` e colorato in base alla severità:
        - se `level === 'error'` → colore “error”;
        - se `level === 'warn'` → colore “warning”;
        - per altri valori → colore “success”.
    - **Namespace/logger** (`l.ns`), tra parentesi tonde `(ns)`, con colore informativo (es. “info”).
    - **Messaggio** (`l.msg`), mostrato come testo principale della riga:
        - se `l.msg` è una stringa → usata direttamente;
        - se `l.msg` è un oggetto/altro tipo → serializzato con `JSON.stringify(l.msg)`.
- Le righe devono essere inserite in un contenitore scrollabile (Paper) per consentire la consultazione degli eventi più recenti senza deformare il layout.
- L’ordine di visualizzazione deve rispettare l’ordine di arrivo (log più recenti in fondo all’elenco).

Da prospettiva utente: “Nel pannello vedo righe del tipo ‘2024-05-10T10:01:23Z [info] (api) Messaggio…’, con colori diversi per errori, warning e info.”

---

**FR-DASH-STAT-10 – Comportamento in assenza di log o problemi di connettività ai log**

La pagina deve gestire correttamente anche situazioni in cui non siano disponibili log o il canale `/logs` non funzioni.

Requisiti:
- Se non sono ancora stati ricevuti eventi (`logs.length === 0`):
    - il pannello “Real-Time Logs” deve comunque essere mostrato, ma con contenuto vuoto;
    - non è obbligatorio un messaggio “no logs”, purché l’assenza non generi errori.
- Se la connessione `/logs` fallisce o si interrompe:
    - la pagina non deve andare in errore fatale;
    - il pannello deve continuare a mostrare gli ultimi eventi validi (se presenti) o restare vuoto.
- Non deve essere richiesto all’utente di ricaricare manualmente la pagina per recuperare i log; eventuali riconnessioni del backend possono generare nuove righe quando il WebSocket /logs torna disponibile.

---

**FR-DASH-STAT-11 – Robustezza complessiva e allineamento con l’indicatore globale di stato tool**

La pagina “Tool Status” deve costituire il riferimento principale per analizzare problemi di backend, in coerenza con l’indicatore globale dello stato tool presente nella barra superiore (vedi FR-DASH-GLOB-05).

Requisiti:
- Lo stato consolidato `toolStatus` utilizzato nella pagina deve essere coerente con la logica usata per il chip globale (stesse categorie: `tool_on`, `checking`, `tool_off`), pur potendo aggiornarsi con frequenza diversa.
- In caso di malfunzionamenti parziali (es. Redis giù, GraphDB su, API su), la pagina deve:
    - riflettere il dettaglio nella griglia componenti;
    - mostrare un valore `toolStatus` adeguato (es. `tool_off` o `checking`, secondo la logica di `deriveToolStatus`).
- Qualunque errore lato rete o backend (health o WebSocket) deve essere gestito senza causare crash o schermate bianche:
    - la card principale può riportare `tool_off`;
    - le StatusCard dei componenti possono mostrare `down` o `disconnected`;
    - il pannello log può rimanere vuoto;
    - ma la struttura della pagina deve restare sempre renderizzabile e navigabile.

Da prospettiva utente: “Se qualcosa nel backend non va, vado su Tool Status e vedo subito cosa è giù, se il tool è considerato off e che cosa stanno dicendo i log in tempo reale, senza che la pagina si rompa.”

---