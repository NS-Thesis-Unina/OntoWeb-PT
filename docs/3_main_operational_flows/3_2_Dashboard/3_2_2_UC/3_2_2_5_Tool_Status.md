# Tool Status – Casi d’uso (Dashboard)
---

**UC-DASH-STAT-01 – Consultare lo stato complessivo del Tool

- **Attore principale**  
    Utente (penetration tester / analista) che utilizza la dashboard web.
    
- **Obiettivo**  
    Capire a colpo d’occhio se il backend OntoWeb-PT è operativo, in verifica o non disponibile, e quando è stato aggiornato per l’ultima volta.
    
- **Precondizioni**
    - L’utente ha effettuato l’accesso alla dashboard.
    - La dashboard è raggiungibile e la route `/server-status` è disponibile.
    - Il servizio REST di health del backend è configurato (anche se potrebbe non rispondere).
        
- **Postcondizioni
    - L’utente vede una card principale con:
        - lo stato consolidato del tool (`tool_on`, `checking`, `tool_off`);
        - l’ora dell’ultimo aggiornamento (calcolata in locale);
        - una barra di progresso colorata coerente con lo stato.
    - In caso di problemi con il servizio di health, lo stato è mostrato come `tool_off`, ma la pagina resta utilizzabile.
        
- **Scenario principale**
    1. L’utente clicca sulla voce **Tool Status** dal menu di navigazione della dashboard.
    2. La pagina “Tool Status” viene caricata e, all’inizializzazione, invoca `getHealth()`.
    3. Finché la risposta non arriva, lo stato interno è in fase di verifica (`checking`); la UI mostra la card principale con stato iniziale coerente.
    4. Alla risposta:
        - se `getHealth()` va a buon fine, la card viene aggiornata con il valore di `toolStatus` derivato da `deriveToolStatus(health)`;
        - l’orario di “Ultimo aggiornamento” viene calcolato tramite la data/ora locale del browser.
    5. La barra di progresso nella card principale assume il colore:
        - verde se `toolStatus = tool_on`;
        - giallo se `toolStatus = checking`;
        - rosso se `toolStatus = tool_off`.
    6. L’utente legge rapidamente lo stato consolidato del sistema e l’ora dell’ultimo refresh.
        
- **Estensioni / varianti**
    - 3a. `getHealth()` restituisce errore o non è raggiungibile  
        → Lo stato `health` interno viene impostato a `null`, `toolStatus` diventa `tool_off`. La card principale mostra “Tool Status: tool_off” e l’interfaccia resta pienamente navigabile.
    - 4a. Alcuni componenti sono giù ma altri up  
        → `deriveToolStatus(health)` può valutare comunque `toolStatus` come `tool_off` o `checking` a seconda della logica; l’utente può approfondire nei pannelli dedicati ai singoli componenti (vedi UC-DASH-STAT-02).

---

**UC-DASH-STAT-02 – Analizzare lo stato dei singoli componenti (API, Redis, GraphDB, WebSocket)

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Identificare rapidamente quali componenti del backend sono operativi e quali presentano problemi, tramite la griglia di StatusCard.
    
- **Precondizioni**
    - L’utente si trova sulla pagina **Tool Status**.
    - È stato effettuato almeno un tentativo di chiamata a `getHealth()` (anche se potenzialmente fallito).
    - La pagina ha aperto la connessione WebSocket root e aggiorna `wsStatus`.
        
- **Postcondizioni**
    - L’utente visualizza una griglia di quattro StatusCard:
        - API Server
        - Redis
        - GraphDB
        - WebSocket
    - Ogni card mostra:
        - un indicatore circolare colorato (verde/giallo/rosso) in base allo stato normalizzato;
        - un’etichetta testuale dello stato (es. `up`, `down`, `connected`, `disconnected`).
            
- **Scenario principale**
    1. Dopo l’inizializzazione, la pagina ha già acquisito un oggetto `health` (se disponibile) e uno stato `wsStatus` (“connected” o “disconnected”).
    2. Nella sezione “Component Status” vengono renderizzate quattro StatusCard, una per ciascun componente.
    3. Per API Server, Redis e GraphDB:
        - viene letto `health.components.<nome>`; se non valorizzato, lo stato viene considerato falsy.
    4. Per WebSocket:
        - lo stato utilizza direttamente `wsStatus`, valorizzato dagli eventi `connect`/`disconnect` della connessione WebSocket root.
    5. Ogni StatusCard:
        - normalizza il valore ricevuto: se falsy → `down`, altrimenti usa lo string raw;
        - mappa il valore normalizzato su un colore:
            - `up`/`connected` → pallino verde;
            - `connecting` → pallino giallo;
            - `down`/`disconnected` → pallino rosso;
            - valori sconosciuti → pallino rosso come fallback conservativo;
        - mostra sotto il titolo il valore normalizzato come testo (es. `connected`, `down`, ecc.).
    6. L’utente può leggere, a colpo d’occhio, quali componenti sono operativi e quali potenzialmente in errore.
        
- **Estensioni / varianti**
    - 2a. `health` è `null` (es. health non raggiungibile)  
        → Le StatusCard di API Server, Redis e GraphDB ricevono stati falsy e vengono visualizzate come `down` (pallino rosso). La card WebSocket continua invece a riflettere `wsStatus`.
    - 3a. `wsStatus` è “disconnected” perché il WebSocket non si collega o cade  
        → La StatusCard WebSocket mostra `disconnected` con pallino rosso; le altre card continuano a basarsi su `health`.
    - 4a. Lo schermo è stretto (mobile)  
        → La griglia si adatta in layout a 1 colonna, mantenendo comunque tutte le informazioni leggibili.

---

**UC-DASH-STAT-03 – Monitorare nel tempo lo stato del tool con polling periodico

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Osservare l’evoluzione dello stato del tool e dei componenti senza dover ricaricare manualmente la pagina, grazie al polling periodico dell’endpoint di health e alla sincronizzazione con lo stato WebSocket.
    
- **Precondizioni**
    - L’utente si trova sulla pagina Tool Status e rimane sulla vista per un certo tempo.
    - Il backend espone l’endpoint di health.
    - La connessione WebSocket root è gestita dalla pagina (anche se potrebbe risultare “disconnected”).
        
- **Postcondizioni**
    - Lo stato `health` e `toolStatus` viene aggiornato automaticamente ogni ~5 secondi.
    - Ogni cambiamento di `wsStatus` porta a un nuovo ciclo di polling (reset del timer e nuova chiamata a `getHealth()`).
    
- **Scenario principale**
    1. Al montaggio del componente, la pagina:
        - esegue una prima chiamata a `getHealth()` (vedi UC-DASH-STAT-01);
        - apre la connessione WebSocket root, registrando handler per `connect` / `disconnect`.
    2. Viene creato un intervallo (`setInterval`) che invoca `getHealth()` ogni 5000 ms.
    3. Se il WebSocket cambia stato (es. da `disconnected` a `connected`):
        - `wsStatus` viene aggiornato;
        - l’effetto che gestisce il polling vede cambiare la dipendenza e ricrea l’intervallo, eseguendo anche un nuovo `getHealth()` immediato.
    4. Ad ogni risposta di `getHealth()`:
        - `health` e `toolStatus` vengono aggiornati, rinfrescando card principale e griglia componenti.
    5. Finché l’utente resta sulla pagina, la UI continua a “respirare” lo stato del backend, riflettendo variazioni in pochi secondi.
        
- **Estensioni / varianti**
    - 3a. L’utente naviga via dalla pagina Tool Status  
        → Il componente viene smontato e il cleanup del `useEffect` cancella l’intervallo di polling e chiude la connessione WebSocket, evitando timer zombie.
    - 3b. Il WebSocket entra in un ciclo di connect/disconnect intermittente  
        → `wsStatus` oscilla tra `connected` e `disconnected`; ogni cambio ricrea il polling, provocando un nuovo health check e permettendo di cogliere rapidamente le transizioni.

---

**UC-DASH-STAT-04 – Verificare lo stato della connessione WebSocket principale

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Sapere se il canale WebSocket principale (root) utilizzato dalla dashboard è attualmente connesso o meno.
    
- **Precondizioni**
    - L’utente è sulla pagina Tool Status.
    - La pagina tenta di instaurare una connessione WebSocket principale verso l’URL configurato (es. `VITE_LOGS_WS_URL`).
    
- **Postcondizioni**
    - Lo stato `wsStatus` è coerente con la connessione (connected/disconnected).
    - La StatusCard “WebSocket” visualizza in modo evidente lo stato del canale real-time.
        
- **Scenario principale**
    1. All’apertura della pagina, viene creato un socket WebSocket verso il namespace root (senza suffisso `/logs`).
    2. Quando il socket emette `connect`, la pagina aggiorna `wsStatus = 'connected'`.
    3. Quando il socket emette `disconnect`, la pagina aggiorna `wsStatus = 'disconnected'`.
    4. La StatusCard “WebSocket” legge `wsStatus` e:
        - se `connected` → mostra pallino verde e testo “connected”;
        - se `disconnected` → mostra pallino rosso e testo “disconnected”.
    5. L’utente può quindi capire se il canale real-time è attivo o meno.
        
- **Estensioni / varianti**
    - 1a. Impossibilità di instaurare la connessione (URL non raggiungibile, backend fermo)  
        → L’evento `connect` non arriva mai o arriva `disconnect`; `wsStatus` resta “disconnected” e la StatusCard lo mostra con pallino rosso. Il resto della pagina (health REST e log, se disponibili) rimane utilizzabile.
    - 4a. L’utente lascia la pagina  
        → La connessione WebSocket viene chiusa in cleanup (`socket.disconnect()`); eventuali errori di chiusura non impattano l’utente.

---

**UC-DASH-STAT-05 – Visualizzare i log in tempo reale del backend

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Consultare un flusso in tempo reale dei log del backend (worker, API, ecc.) per diagnosticare problemi o verificare l’attività corrente del sistema.
    
- **Precondizioni**
    - L’utente è sulla pagina Tool Status.
    - Il backend espone un namespace WebSocket `/logs` che invia messaggi strutturati (entry log).
    - Il browser dell’utente consente connessioni WebSocket verso l’URL dei log.
        
- **Postcondizioni**
    - Viene visualizzato un pannello “Real-Time Logs” con una lista scrollabile delle ultime ~80 entry, in ordine di arrivo (le più recenti in fondo).
    - Ogni riga di log mostra timestamp, livello, namespace e messaggio, con colori distinti per livello.
        
- **Scenario principale**
    1. All’inizializzazione, oltre al WebSocket root, la pagina apre una seconda connessione verso `VITE_LOGS_WS_URL_LOGS` (es. `ws://…/logs`).
    2. Per ogni evento `log` ricevuto:
        - il callback riceve un oggetto `entry` con campi come `ts`, `level`, `ns`, `msg` ecc.;
        - l’array `logs` viene aggiornato come coda scorrevole: si prendono gli ultimi ~80 elementi precedenti (`prev.slice(-80)`) e si aggiunge `entry` in fondo.
    3. Nella sezione “Real-Time Logs”:
        - un contenitore scrollabile (Paper) mostra tutte le righe di `logs` in ordine;
        - per ogni riga:
            - il timestamp `l.ts` è mostrato con stile “secondary”;
            - il livello `[l.level]` è colorato:
                - `error` → colore “error”;
                - `warn` → colore “warning”;
                - altrimenti → colore “success”;
            - il namespace `(l.ns)` ha colore “info”;
            - il messaggio `l.msg` viene mostrato:
                - se stringa, direttamente;
                - se oggetto o altro, come `JSON.stringify(l.msg)`.
    4. L’utente scorre il pannello per vedere gli eventi più recenti o risalire leggermente nel tempo (entro il buffer di ~80 log).
        
- **Estensioni / varianti**
    - 2a. Nessun log ricevuto (`logs.length === 0`)  
        → Il pannello viene comunque renderizzato ma vuoto. Non è obbligatorio un testo “no logs”; l’importante è che non si generino errori.
    - 1a. La connessione `/logs` fallisce o si disconnette  
        → Il pannello continua a mostrare gli ultimi log validi (se presenti) o rimane vuoto, senza che la pagina vada in errore. Non è richiesto all’utente di fare refresh manuale.
    - 3a. I log contengono messaggi con payload complessi (oggetti annidati)  
        → Il campo `msg` viene serializzato via JSON.stringify, permettendo comunque una lettura testuale dell’informazione.

---

**UC-DASH-STAT-06 – Utilizzare Tool Status per la diagnosi rapida di problemi backend

- **Attore principale**  
    Utente (es. sviluppatore o DevOps che supporta il penetration tester).
    
- **Obiettivo**  
    In presenza di malfunzionamenti percepiti (es. la dashboard non riesce a caricare findings o richieste HTTP), usare la pagina Tool Status come primo punto di diagnosi per capire quali componenti del backend sono in errore e se il tool è considerato globalmente “off”.
    
- **Precondizioni**
    - L’utente ha notato errori o lentezza nell’utilizzo di altre sezioni della dashboard (Http Requests, Findings, Send PCAP, ecc.).
    - Il backend può essere parzialmente o totalmente degradato (API non raggiungibile, Redis down, GraphDB down, WebSocket intermittente).
        
- **Postcondizioni**
    - L’utente ottiene:
        - una chiara indicazione se il tool è `tool_on`, `checking` o `tool_off`;
        - lo stato dettagliato di API Server, Redis, GraphDB e WebSocket;
        - un contesto tramite i log real-time per capire eventuali errori o restart.
            
- **Scenario principale**
    1. L’utente riscontra errori in un’altra sezione (es. “Error while loading HTTP findings.”) e sospetta un problema backend.
    2. L’utente passa alla pagina **Tool Status** dalla nav laterale.
    3. La card principale mostra immediatamente lo stato consolidato:
        - se il backend ha problemi critici, `toolStatus` potrebbe risultare `tool_off` o `checking`. 
    4. L’utente guarda la griglia componenti:
        - se, ad esempio, Redis risulta `down` (pallino rosso) e GraphDB `up`, può dedurre che certe funzioni dipendenti da Redis siano compromesse;
        - se API Server è `down`, può aspettarsi errori diffusi su tutte le chiamate REST.
    5. L’utente osserva il pannello “Real-Time Logs” per cercare:
        - stacktrace di errori;
        - messaggi di riconnessione o di start/stop di worker;
        - eventuali warning ripetuti.
    6. Con queste informazioni, l’utente può:
        - decidere se attendere il ripristino;
        - contattare chi gestisce l’infrastruttura;
        - o riavviare componenti mirati (azione fuori dalla dashboard).
            
- **Estensioni / varianti**
    - 3a. Il chip globale di stato tool nella barra superiore già indica `Tool Off`  
        → L’utente usa Tool Status per approfondire: vede il dettaglio dei componenti e i log, che consentono una diagnosi più precisa rispetto al semplice chip globale.
    - 4a. Tutti i componenti risultano `up` ma l’utente percepisce ancora problemi in altre sezioni  
        → L’utente può guardare i log in real-time per verificare se ci sono errori applicativi non direttamente legati a down di componenti (es. eccezioni logiche, problemi di dati).

---

**UC-DASH-STAT-07 – Comportamento robusto in presenza di errori di rete o servizi non disponibili

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Continuare a usare la pagina Tool Status (e, in generale, la dashboard) anche se l’endpoint di health, la connessione WebSocket o il canale `/logs` hanno problemi, senza subire crash o schermate bianche.
    
- **Precondizioni**
    - L’utente ha aperto la pagina Tool Status.
    - Possono verificarsi:
        - failure sul servizio `getHealth()` (timeout, 500, DNS, ecc.);
        - impossibilità di instaurare o mantenere le connessioni WebSocket;
        - errori runtime durante la ricezione dei log.
            
- **Postcondizioni**
    - La pagina resta visibile e funzionante come layout.
    - I vari blocchi degradano in modo controllato:
        - card principale su `tool_off` se health non è disponibile;
        - StatusCard dei componenti su `down`/`disconnected`;
        - pannello log vuoto o fermo agli ultimi eventi validi.
            
- **Scenario principale**
    1. L’utente apre Tool Status mentre il backend è parzialmente o totalmente offline.
    2. Il tentativo di `getHealth()` solleva un errore:
        - il catch imposta `health = null` e `toolStatus = 'tool_off'`;
        - nessuna eccezione non gestita viene propagata al rendering.
    3. Le StatusCard leggono `components = {}` e quindi tutti i valori risultano falsy → `down` (pallino rosso) per API, Redis, GraphDB.
    4. Il WebSocket root potrebbe:
        - non connettersi mai → `wsStatus = 'disconnected'`, StatusCard WebSocket in rosso;
        - connettersi e poi cadere → aggiornare `wsStatus` di conseguenza.    
    5. La connessione `/logs` può:
        - restare inattiva (nessun `log` ricevuto);
        - connettersi e poi interrompersi; in entrambi i casi il componente continua a funzionare con l’array `logs` corrente (vuoto o parziale).
    6. L’utente vede quindi:
        - card principale rosso “Tool Status: tool_off”;
        - componenti in rosso;
        - log panel potenzialmente vuoto;
        - ma la pagina è comunque navigabile e rientrare in altre sezioni della dashboard è sempre possibile.
            
- **Estensioni / varianti**
    - 2a. I problemi sono temporanei: backend torna up durante la permanenza dell’utente su Tool Status  
        → Un successivo ciclo di polling `getHealth()` va a buon fine; `toolStatus` ritorna `tool_on`, le StatusCard si aggiornano a `up`/`connected` e i log ricominciano a scorrere se `/logs` torna operativo.
    - 4a. Gli errori riguardano solo il canale `/logs` ma non health  
        → Card principale e griglia componenti funzionano regolarmente; il pannello log resta eventualmente vuoto o fermo, ma senza impattare il resto.

---