# OpenAPI - Casi d’uso
---

**UC-DASH-OAPI-01 – Accesso alla pagina API Explorer dalla navigazione globale**

- **Attore principale**  
    Utente (penetration tester / analista sicurezza) che utilizza la dashboard web.
    
- **Obiettivo**  
    Raggiungere la pagina **API Explorer** per consultare la documentazione interattiva delle API di backend.
    
- **Precondizioni**
    - L’utente ha effettuato l’accesso alla dashboard OntoWeb-PT.
    - La dashboard è correttamente raggiungibile via browser.
        
- **Postcondizioni**
    - La pagina `/openapi` è visualizzata.
    - L’utente vede il titolo “API Explorer” e il blocco descrittivo introduttivo.
    - Se lo schema non è ancora caricato, viene mostrato lo stato di caricamento (spinner).
        
- **Scenario principale**
    1. L’utente si trova in qualunque sezione della dashboard.
    2. Dalla barra laterale, clicca sulla voce **OpenAPI** (oppure usa direttamente l’URL `/openapi`).
    3. La dashboard carica la vista **API Explorer**.
    4. In cima alla pagina l’utente vede il titolo “API Explorer”.
    5. Sotto il titolo, l’utente vede un blocco descrittivo (Paper) che spiega in modo sintetico:
        - che la pagina serve a esplorare le API del backend;
        - che vengono documentati i flussi di ingestione HTTP, analisi, SPARQL, findings, ecc.
    6. Se il file `openapi.json` non è ancora stato caricato, la pagina mostra uno spinner di caricamento centrato.
    7. Una volta caricato lo schema, vengono mostrati i gruppi di endpoint per tag (vedi casi d’uso successivi).
- **Estensioni / varianti**
    - 2a. L’utente apre la pagina direttamente via URL `/openapi` (es. da un bookmark)  
        → La dashboard monta comunque la stessa vista API Explorer, con titolo, descrizione e lista di endpoint.

---

**UC-DASH-OAPI-02 – Visualizzazione dello stato di caricamento dello schema OpenAPI**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Comprendere in modo chiaro che il catalogo di endpoint sta ancora caricando e che la pagina non è vuota “per errore”.
    
- **Precondizioni**
    - L’utente ha appena aperto la pagina `/openapi` (vedi UC-DASH-OAPI-01).
    - Il documento `openapi.json` non è ancora stato importato (stato `schema === null`).
    
- **Postcondizioni**
    - Finché il documento non è pronto, l’utente vede una schermata di loading minimale con spinner.
    - Quando il caricamento termina, lo spinner scompare e compaiono titolo, descrizione e gruppi di endpoint.
        
- **Scenario principale**
    1. L’utente apre la pagina API Explorer.
    2. Il componente tenta di importare dinamicamente `openapi.json`.
    3. Poiché lo schema non è ancora disponibile, la pagina mostra:
        - un contenitore centrato (`openApi-loading-div`);
        - uno spinner (`CircularProgress`) al centro.
    4. L’utente attende il completamento del caricamento.
    5. Quando l’import ha successo, lo stato `schema` viene valorizzato.
    6. La vista passa automaticamente alla versione completa: titolo, blocco descrittivo, gruppi di endpoint.
        
- **Estensioni / varianti**
    - 3a. Il caricamento è particolarmente lento  
        → L’utente vede a lungo solo lo spinner, ma la pagina non mostra errori né contenuti parziali.
    - 3b. Si verifica un problema sull’import di `openapi.json`  
        → Dal punto di vista utente, lo spinner può permanere; eventuali strategie di fallback (messaggi di errore) possono essere aggiunte in evoluzioni successive senza rompere il flusso base.

---

**UC-DASH-OAPI-03 – Esplorazione degli endpoint raggruppati per tag**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Orientarsi tra gli endpoint del backend consultandoli per gruppi logici (tag) coerenti con le funzionalità (es. HTTP Requests, Findings, SPARQL, ecc.).
    
- **Precondizioni**
    - Lo schema OpenAPI è stato caricato correttamente.
    - La pagina API Explorer è visualizzata.
        
- **Postcondizioni**
    - L’utente vede gli endpoint suddivisi per tag.
    - Può espandere o contrarre gli endpoint di suo interesse all’interno di ogni gruppo.
        
- **Scenario principale**
    1. Lo schema OpenAPI è disponibile in memoria (`schema` valorizzato).
    2. Il sistema analizza `schema.paths` e per ogni `path` e metodo HTTP valido costruisce un oggetto endpoint con:
        - method, path, summary, description, parameters, requestBody, responses.
    3. Per ogni endpoint viene determinato il **tag principale**:
        - se `info.tags` è valorizzato → primo elemento `info.tags[0]`;
        - altrimenti → fallback `"General"`.
    4. Gli endpoint vengono raggruppati in base al tag.
    5. La pagina visualizza, per ciascun tag:
        - un titolo di sezione (es. “HTTP Requests API” o “General”);
        - una lista di Accordion, uno per ogni endpoint associato al tag.
    6. L’utente scorre i gruppi e individua rapidamente le categorie di API rilevanti.
        
- **Estensioni / varianti**
    - 5a. Alcuni endpoint non hanno tag espliciti nello schema  
        → Vengono raggruppati nel gruppo di fallback “General”.
    - 5b. Un tag contiene molti endpoint  
        → L’utente può espandere solo quelli di interesse, mantenendo gli altri collassati per non affollare la pagina.

---

**UC-DASH-OAPI-04 – Consultazione rapida dei metadati di un endpoint (header Accordion)**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Capire a colpo d’occhio cosa fa un determinato endpoint, quale metodo HTTP usa e su quale path è esposto.
    
- **Precondizioni**
    - L’utente si trova in uno dei gruppi di endpoint (UC-DASH-OAPI-03).
    - La lista degli endpoint è stata costruita a partire da `schema.paths`.
        
- **Postcondizioni**
    - L’utente individua velocemente l’endpoint di interesse grazie a metodo/colorazione, path e breve summary.
    - Può decidere se espandere o meno il dettaglio dell’endpoint.
        
- **Scenario principale**
    1. L’utente osserva la lista di Accordion all’interno di un gruppo (tag).
    2. Per ogni endpoint, l’header dell’Accordion mostra:
        - un **Chip** con il metodo HTTP in maiuscolo (GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD) e con colore coerente col metodo;
        - il **path** completo (es. `/http/requests`, `/pcap/extract`);
        - il **summary** dell’operazione (es. “List HTTP requests paginated”).
    3. L’utente scorre la lista e, basandosi su metodo + path + summary, individua l’endpoint che gli interessa (ad es. il POST di ingestione richieste).
    4. Cliccando sull’header, espande l’Accordion per vedere i dettagli (descrizione, parametri, schemi, ecc.).
        
- **Estensioni / varianti**
    - 2a. L’endpoint non ha un `summary` definito  
        → La sezione di testo descrittivo nell’header può risultare vuota o minimale; l’utente si affida principalmente a metodo e path.

---

**UC-DASH-OAPI-05 – Consultazione dettagliata di descrizione e parametri dell’endpoint**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Comprendere in modo completo cosa fa l’endpoint, quali parametri accetta e come vanno passati (query, path, header, cookie).
    
- **Precondizioni**
    - L’utente ha espanso un Accordion relativo a un endpoint specifico (UC-DASH-OAPI-04).
    - Le informazioni `description` e `parameters` sono state ricavate dall’OpenAPI.
    
- **Postcondizioni**
    - L’utente conosce la descrizione estesa della funzionalità esposta.
    - L’utente sa quali parametri sono richiesti/obbligatori e in che posizione (`in`) vanno forniti.
        
- **Scenario principale**
    1. L’utente espande un endpoint.
    2. Nella sezione **Description** vede:
        - un titolo “Description”;
        - il contenuto di `ep.description`, oppure “No description” se mancante.
    3. Se l’endpoint ha parametri:
        - compare una sezione **Parameters**.
    4. I parametri vengono **raggruppati per location** (`in`):
        - `query` → “Query parameters (filters)”;
        - `path` → “Path parameters”;
        - `header` → “Header parameters”;
        - `cookie` → “Cookie parameters”;
        - altri/assenza (`other`) → “Other parameters”.
    5. Per ciascun gruppo, la UI mostra una lista puntata dei parametri con, per ogni voce:
        - nome in grassetto;
        - indicazione `(required)` o `(optional)`;
        - tipo umano-leggibile (es. `string`, `array<string>`, `enum`, `object`, `any`);
        - eventuale descrizione (testo libero).
    6. L’utente può così capire come costruire query string, path params, header e cookie necessari per usare quell’endpoint.
        
- **Estensioni / varianti**
    - 3a. L’endpoint non ha alcun parametro  
        → La sezione “Parameters” non viene visualizzata; l’utente vede solo descrizione e, se presenti, request/response body.
    - 4a. Un parametro è definito sia a livello di path sia a livello di operazione  
        → Grazie alla logica di merge, l’utente vede un solo parametro, corrispondente alla definizione più specifica (operation-level).

---

**UC-DASH-OAPI-06 – Comprensione del tipo dei parametri tramite schemi dereferenziati**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Capire con precisione che tipo di valore è atteso per ciascun parametro (singolo valore, array, enum, oggetto, ecc.), senza doversi orientare manualmente tra i `$ref` dello schema.
    
- **Precondizioni**
    - L’utente sta consultando la sezione “Parameters” di un endpoint (UC-DASH-OAPI-05).
    - I parametri dispongono di uno schema (`param.schema` o `param.content["application/json"].schema`).
        
- **Postcondizioni**
    - Ogni parametro mostra un tipo sintetico leggibile.
    - La tipologia è derivata da schemi già dereferenziati, includendo eventuali riferimenti `$ref` locali.
        
- **Scenario principale**
    1. Per ogni parametro, la pagina recupera lo schema associato:
        - da `param.schema`, oppure
        - da `param.content["application/json"].schema`.
    2. Lo schema viene dereferenziato seguendo eventuali `$ref` locali (`#/components/...`) e risolvendo proprietà, items, composizioni (`allOf`, `anyOf`, `oneOf`).
    3. Sulla base dello schema risultante, per ogni parametro viene calcolata una stringa di tipo:
        - `array<inner>` se `type === "array"` con `items.type`;
        - il `type` esplicito se presente (string, number, boolean, object, ecc.);
        - `"enum"` se manca `type` ma è presente `enum`;
        - `"object"` o `"any"` come fallback se non si può determinare altro.
    4. Nella lista dei parametri, l’utente vede quindi:
        - `userId (required) – string – ID dell’utente…`
        - `filters (optional) – array<string> – ...`
        - `mode (optional) – enum – ...`
    5. L’utente comprende meglio come valorizzare i parametri nelle proprie richieste.
        
- **Estensioni / varianti**
    - 2a. Lo schema del parametro non è disponibile  
        → Il tipo viene mostrato come `"any"`; l’utente sa che la documentazione non specifica un tipo più preciso.
    - 3a. Lo schema contiene `$ref` ricorsivi o ciclici  
        → Il meccanismo di dereferenziazione rileva il ciclo e si ferma, restituendo comunque una rappresentazione stabile non infinita.

---

**UC-DASH-OAPI-07 – Analisi del corpo di richiesta (Request Body) di un endpoint**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Capire come deve essere strutturato il payload di una richiesta (es. JSON) prima di invocare un endpoint che richiede un body.
    
- **Precondizioni**
    - L’endpoint ha un `requestBody` definito nello schema OpenAPI.
    - L’utente ha espanso il relativo Accordion.
        
- **Postcondizioni**
    - L’utente vede uno schema JSON dereferenziato del corpo di richiesta più rilevante (in base al content-type).
    - Può utilizzare tale schema per costruire correttamente il payload lato client.
        
- **Scenario principale**
    1. L’utente espande il dettaglio di un endpoint che prevede `requestBody`.
    2. Il sistema analizza `requestBody.content` e seleziona il content-type da usare con ordine di priorità:
        - `application/json`,
        - `multipart/form-data`,
        - `application/x-www-form-urlencoded`.
    3. Se nessuno di questi è presente ma esiste almeno un content con `schema`, viene scelto il primo disponibile.
    4. Lo schema selezionato viene dereferenziato (risoluzione `$ref`, merge di override locali, attraversamento `properties`, `items`, `allOf`, ecc.).
    5. Nella sezione **Request Body** l’utente vede un blocco `<pre>` con lo schema JSON formattato (`JSON.stringify(..., null, 2)`).
    6. L’utente può quindi dedurre la struttura esatta del corpo da inviare (campi obbligatori, tipi, nested objects, ecc.).
        
- **Estensioni / varianti**
    - 2a. L’endpoint non prevede `requestBody` o non espone schemi utilizzabili  
        → La sezione “Request Body” non viene mostrata.
    - 3a. Esistono più content-type ma l’utente è interessato a uno specifico (es. `multipart/form-data`)  
        → La logica base mostra quello “preferito” in base all’ordine; eventuali miglioramenti (selezione manuale) potranno essere introdotti in evoluzioni successive.

---

**UC-DASH-OAPI-08 – Analisi degli schemi di risposta per codice di stato (Responses Body)**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Comprendere quali codici di stato può restituire l’endpoint e qual è la struttura JSON delle risposte previste.
    
- **Precondizioni**
    - L’utente sta consultando il dettaglio di un endpoint.
    - `ep.responses` è presente nello schema.
    
- **Postcondizioni**
    - L’utente vede una rappresentazione JSON delle possibili risposte, indicizzate per codice di stato (200, 400, 404, ecc.).
    - Può verificare la forma del payload di risposta e le descrizioni associate.
        
- **Scenario principale**
    1. Nel pannello dei dettagli dell’endpoint, la pagina mostra la sezione **Responses Body**.
    2. Per ogni entry di `ep.responses`:
        - viene ricavata la `description` (descrizione testuale della risposta);
        - viene cercato lo schema del content-type `application/json`, se disponibile.
    3. Lo schema di risposta, se presente, viene dereferenziato come per gli altri schemi (parametri, request body).
    4. Viene costruito un oggetto complessivo del tipo:
        `{   "200": { "description": "...", "schema": { ... } },   "400": { "description": "...", "schema": { ... } },   ... }`
    5. Questo oggetto viene mostrato in un blocco `<pre>` formattato.
    6. L’utente può leggere:
        - quali codici di stato sono previsti;
        - che struttura ha il JSON restituito in caso di successo/errore;
        - eventuali differenze tra diverse risposte.
            
- **Estensioni / varianti**
    - 3a. Per un certo codice di stato non esiste `content["application/json"]`  
        → La risposta per quel codice contiene solo `description` senza campo `schema`.
    - 3b. Nessuna risposta espone uno schema JSON  
        → Il blocco mostra un oggetto vuoto `{}`, ma la sezione “Responses Body” è comunque presente per indicare la mancanza di schemi.

---

**UC-DASH-OAPI-09 – Utilizzo della sezione API Explorer come documentazione di sola lettura**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Consultare le API come documentazione interattiva senza eseguire chiamate live, in modo sicuro e senza effetti collaterali sul backend.
    
- **Precondizioni**
    - La pagina `/openapi` è caricata.
    - Gli endpoint sono stati costruiti a partire dallo schema.
        
- **Postcondizioni**
    - Nessuna chiamata reale alle API viene effettuata tramite questa pagina.
    - L’utente utilizza l’API Explorer solo per leggere e comprendere la struttura e il comportamento degli endpoint.
        
- **Scenario principale**
    1. L’utente apre la pagina API Explorer per capire come integrare il backend OntoWeb-PT in altri strumenti o script.
    2. Consulta i gruppi di endpoint (UC-DASH-OAPI-03), gli header (UC-DASH-OAPI-04), parametri (UC-DASH-OAPI-05/06), request body (UC-DASH-OAPI-07) e responses (UC-DASH-OAPI-08).
    3. L’interfaccia non espone alcun pulsante “Try it out” né form eseguibili verso il backend.
    4. L’utente prende nota dei path, dei parametri e degli schemi per costruire client o script esterni (es. curl, Postman, tool personalizzati).
    5. Tutta l’interazione è in sola lettura: espandere/chiudere Accordion non genera traffico verso gli endpoint documentati, oltre al caricamento iniziale dello schema OpenAPI.
        
- **Estensioni / varianti**
    - 3a. L’utente si aspetta di poter invocare direttamente le API dalla pagina  
        → Scopre che la sezione è volutamente documentale; per chiamare le API dovrà usare strumenti esterni, ma ora dispone di tutti i dettagli per farlo correttamente.
    - 3b. L’utente usa API Explorer come supporto durante lo sviluppo di nuovi job o integrazioni  
        → Consulta ripetutamente la pagina per verificare path, parametri e modelli di richiesta/risposta senza rischiare di eseguire operazioni indesiderate sul backend.

---