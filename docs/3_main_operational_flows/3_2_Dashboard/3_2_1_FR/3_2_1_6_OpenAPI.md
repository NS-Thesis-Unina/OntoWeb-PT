# OpenAPI – Requisiti Funzionali
---

**FR-DASH-OAPI-01 – Accesso alla pagina OpenAPI / API Explorer**

La sezione “OpenAPI” della dashboard deve corrispondere alla pagina **API Explorer**, raggiungibile tramite la voce di menu globale “OpenAPI” (route `/openapi`).

Requisiti:
- Quando l’utente accede a `/openapi` o seleziona la voce “OpenAPI” dalla navigazione laterale, deve essere visualizzata la pagina **API Explorer**.
- In cima alla pagina deve essere mostrato il titolo “API Explorer”.
- Sotto il titolo deve essere presente un blocco descrittivo (Paper) con testo introduttivo che spiega lo scopo della sezione: esplorare le API di backend per ingestione traffico HTTP, analisi, interrogazione SPARQL e consultazione findings.
- Il blocco descrittivo deve comparire con una animazione morbida (`Zoom in`), in coerenza con le altre pagine della dashboard.

Da prospettiva utente: “Cliccando su OpenAPI apro una pagina chiamata API Explorer che mi spiega a cosa servono le API del backend e mi permette di sfogliarle.”

---

**FR-DASH-OAPI-02 – Caricamento dinamico e stato di “loading” dello schema OpenAPI**

La pagina deve caricare lo schema OpenAPI in modo dinamico e gestire uno stato di caricamento iniziale.

Requisiti:
- All’inizializzazione, la pagina deve importare il documento locale `openapi.json` (schema OpenAPI del backend).
- Finché lo schema non è stato caricato (`schema === null`), deve essere mostrata una vista di **loading** minimale:
    - un contenitore centrato (`openApi-loading-div`);
    - uno **spinner** (`CircularProgress`) al centro.
- Solo dopo il caricamento corretto dello schema la vista deve passare alla visualizzazione completa dell’API Explorer (titolo, descrizione e gruppi di endpoint).
- Non devono essere mostrati gruppi o endpoint finché lo schema non è disponibile.

Da prospettiva utente: “Finché il catalogo delle API non è pronto, vedo solo una rotellina di caricamento; quando è pronto, compaiono elenco e gruppi di endpoint.”

---

**FR-DASH-OAPI-03 – Costruzione dell’elenco di endpoint dalle paths dello schema**

La pagina deve costruire l’elenco di endpoint a partire dalla sezione `paths` dello schema OpenAPI.

Requisiti:
- Per ogni entry di `schema.paths` deve essere considerato:
    - la stringa `path` (es. `/http/requests`);
    - l’oggetto `pathItem` che contiene metodi HTTP e, opzionalmente, parametri a livello di path.
- Per ogni coppia `[method, info]` di `pathItem`:
    - deve essere considerata **operazione valida** solo se `method.toLowerCase()` è uno tra: `get`, `post`, `put`, `delete`, `patch`, `options`, `head`;
    - chiavi non corrispondenti ad un metodo (es. `parameters`) non devono essere interpretate come operazioni.
- Per ogni operazione valida devono essere estratti e memorizzati almeno:
    - `method` (in minuscolo, derivato dalla chiave di pathItem);
    - `path` (stringa del path);
    - `summary` (breve riassunto dell’endpoint);
    - `description` (descrizione estesa, se presente);
    - `requestBody` (se presente);
    - `responses`;
    - `parameters` (derivati sia da path che da operation, vedi requisito successivo).

Da prospettiva utente: “Per ogni path definito nello schema vedo una riga per ogni metodo HTTP realmente implementato (GET, POST, ecc.).”

---

**FR-DASH-OAPI-04 – Raggruppamento degli endpoint per tag OpenAPI**

Gli endpoint devono essere raggruppati in sezioni logiche basate sui tag OpenAPI.

Requisiti:
- Per ogni operazione (`info`), il sistema deve determinare il tag principale come:
    - `info.tags[0]` se presente e non vuoto;
    - altrimenti la stringa di fallback **“General”**.
- Gli endpoint che condividono lo stesso tag devono essere raccolti in un **gruppo**:
    - ogni gruppo deve essere renderizzato come blocco separato, con un titolo di livello sezione (`Typography variant="h5"`) che mostra il nome del tag.
- All’interno di ogni gruppo, gli endpoint devono essere mostrati come lista di **Accordion** (uno per endpoint).
- L’ordine degli endpoint deve riflettere l’ordine naturale di iterazione di `paths` e delle relative operazioni, così da mantenere la coerenza con la definizione dello schema.

Da prospettiva utente: “Gli endpoint sono divisi per categorie (tag); per esempio tutti quelli legati all’ingestione HTTP sono raggruppati insieme.”

---

**FR-DASH-OAPI-05 – Merge dei parametri a livello di path e di operazione**

I parametri dichiarati a livello di path e quelli a livello di operazione devono essere unificati in una lista coerente, evitando duplicati.

Requisiti:
- I parametri a livello di path devono essere letti da `pathItem.parameters` (se presenti).
- I parametri a livello di operazione devono essere letti da `info.parameters`.
- La lista finale dei parametri per un endpoint deve essere ottenuta tramite merge:
    - ogni parametro deve essere identificato da una chiave composta `"<in>:<name>"` dove:
        - `in` è la location (`query`, `path`, `header`, `cookie`, ecc.), con default `other` se assente;
        - `name` è il nome del parametro.
    - in caso di duplicati (stessa key) deve prevalere il parametro dichiarato a livello di **operazione** rispetto a quello dichiarato a livello di **path**.
- La lista risultante deve essere quella utilizzata per il rendering dei parametri sia nell’intestazione dei gruppi che nel dettaglio dell’endpoint.

Da prospettiva utente: “Se un parametro è definito sia a livello di path che di singola operazione, vedo un solo parametro, con i dettagli della definizione più specifica (quella dell’operazione).”

---

**FR-DASH-OAPI-06 – Intestazione di ogni endpoint (Accordion summary)**

Ogni endpoint deve essere mostrato come `Accordion` con un header che sintetizza metodo, path e riassunto.

Requisiti:
- L’header di ciascun endpoint (AccordionSummary) deve contenere:
    - un **Chip** MUI con:
        - etichetta: metodo HTTP in maiuscolo (es. `GET`, `POST`);
        - colore assegnato in base al metodo:
            - `GET` → `info`
            - `POST` → `success`
            - `PUT` → `warning`
            - `DELETE` → `error`
            - `PATCH` → `primary`
            - `OPTIONS` → `secondary`
            - `HEAD` → `default`;
    - la stringa del **path** (es. `/http/requests`) visualizzata accanto al chip;
    - il **summary** dell’operazione (se presente), in testo secondario, per spiegare in breve lo scopo dell’endpoint.
- L’Accordion deve essere espandibile/collassabile per mostrare o nascondere i dettagli dell’endpoint.

Da prospettiva utente: “A colpo d’occhio vedo il metodo (colorato), il path e una breve descrizione dell’endpoint; se mi interessa lo espando per approfondire.”

---

**FR-DASH-OAPI-07 – Pannello di dettaglio: descrizione e parametri**

Espandendo un endpoint, l’utente deve trovare le informazioni di base e i parametri raggruppati in modo leggibile.

Requisiti:
- La sezione **Description** deve:
    - mostrare il titolo “Description”;
    - visualizzare il contenuto di `ep.description` se presente;
    - visualizzare la stringa “No description” se `description` è assente o vuota.
- Se esistono parametri (lista non vuota):
    - deve essere visibile una sezione “Parameters”;
    - i parametri devono essere raggruppati per location (`in`) tramite etichette user-friendly:
        - `query` → “Query parameters (filters)”
        - `path` → “Path parameters”
        - `header` → “Header parameters”
        - `cookie` → “Cookie parameters”
        - altri valori/assenza (`other`) → “Other parameters”.
    - per ogni gruppo di location:
        - deve essere mostrato il titolo della location;
        - deve essere mostrata una lista puntata (`ul`) di parametri.
- Ogni parametro deve essere reso come riga testuale con:
    - nome in **grassetto**;
    - indicazione `(required)` o `(optional)` in base al flag `param.required`;
    - tipo dedotto dal relativo schema (vedi requisito successivo, es. `string`, `array<string>`, `enum`, `object`, `any`);
    - eventuale descrizione aggiuntiva (`param.description`), appesa dopo il tipo.

Da prospettiva utente: “Nel dettaglio di un endpoint vedo prima una descrizione, poi un elenco dei parametri divisi tra query, path, header e cookie, con nome, obbligatorietà, tipo e spiegazione.”

---

**FR-DASH-OAPI-08 – Tipizzazione dei parametri e risoluzione degli schemi associati**

La pagina deve cercare di inferire un tipo umano-leggibile per ciascun parametro, basandosi sul relativo schema OpenAPI.

Requisiti:
- Per ogni parametro, lo schema di riferimento deve essere recuperato da:
    - `param.schema`, se presente;
    - in alternativa, `param.content["application/json"].schema`, se presente.
- In entrambi i casi, lo schema deve essere **dereferenziato** (vedi FR-DASH-OAPI-10) per seguire `$ref` locali all’interno dello schema OpenAPI.
- La stringa di tipo mostrata deve essere calcolata come segue:
    - se `schema.type === "array"` e `schema.items` è valorizzato:
        - il tipo deve essere `array<inner>` dove `inner` è `schema.items.type` o `"any"` se non specificato;    
    - se `schema.type` è valorizzato e non è `array`, deve essere mostrato quel tipo (`string`, `number`, `integer`, `boolean`, `object`, ecc.);
    - se `schema.type` non è presente ma lo schema contiene `enum`, il tipo deve essere reso come `"enum"`;
    - se non è possibile determinare nulla di più specifico, il tipo deve essere `"object"`;
    - se non è disponibile alcuno schema (`schemaNode` mancante), il tipo deve essere `"any"`.
- La logica di tipizzazione deve essere utilizzata sia per la sezione “Parameters” sia per eventuali schemi request/response, mantenendo una rappresentazione coerente.

Da prospettiva utente: “Per ogni parametro vedo che tipo di valore mi aspetto (es. stringa, numero, array di stringhe, enum, ecc.).”

---

**FR-DASH-OAPI-09 – Visualizzazione del Request Body (schema)**

Se un endpoint prevede un corpo di richiesta (`requestBody`), la pagina deve mostrare lo schema del payload più rilevante.

Requisiti:
- Per determinare quale schema mostrare, deve essere cercato in `requestBody.content` seguendo l’ordine di preferenza:
    1. `application/json`
    2. `multipart/form-data`
    3. `application/x-www-form-urlencoded`
- Il primo content-type disponibile nell’ordine sopra elencato con un `schema` deve essere utilizzato come schema di request body.
- Se nessuno dei content-type preferiti è presente ma esiste almeno un content con `schema`, deve essere usato il primo content disponibile.
- Lo schema selezionato deve essere:
    - dereferenziato tramite la funzione di risoluzione `$ref` (FR-DASH-OAPI-10);
    - visualizzato in una sezione “Request Body” all’interno del dettaglio dell’endpoint;
    - mostrato come JSON formattato (`JSON.stringify(schema, null, 2)`) all’interno di un blocco `<pre>` scrollabile.
- Se non esiste alcun `requestBody` o nessuno schema utilizzabile, la sezione “Request Body” non deve essere mostrata.

Da prospettiva utente: “Vedo il formato del JSON (o form) che devo mandare al backend quando l’endpoint richiede un corpo di richiesta.”

---

**FR-DASH-OAPI-10 – Visualizzazione delle Responses (schema per codice di stato)**

Per ciascun endpoint, la pagina deve mostrare una vista aggregata delle risposte possibili, mappate per codice di stato HTTP.

Requisiti:
- Deve esistere sempre una sezione “Responses Body” per ciascun endpoint (anche se vuota).
- Le risposte devono essere costruite a partire da `ep.responses` e:
    - per ogni `status` (es. `200`, `400`, `404`, `default`) deve essere costruito un oggetto con:
        - `description`: `resp.description` (testo di descrizione della risposta);
        - `schema`: schema JSON della risposta, se disponibile.
- Lo schema per la risposta deve essere ricavato esclusivamente dal content-type `application/json`:
    - `resp.content["application/json"].schema`, se presente;
    - se non presente, non viene associato alcuno schema per quel codice di stato.
- Ogni schema di risposta deve essere dereferenziato (`$ref`) con la stessa logica già descritta (FR-DASH-OAPI-10).
- L’insieme delle responses deve essere mostrato come un unico oggetto JSON in un blocco `<pre>`.
- Se non è disponibile alcuna risposta o alcuno schema JSON, il blocco deve comunque visualizzare un oggetto vuoto `{}`.

Da prospettiva utente: “Per ogni endpoint vedo quali codici di risposta può restituire il backend e, se disponibili, gli schemi JSON di tali risposte.”

---

**FR-DASH-OAPI-11 – Risoluzione locale dei riferimenti $ref nello schema OpenAPI**

La pagina deve fornire una vista il più possibile completa degli schemi dereferenziando i `$ref` locali nello schema OpenAPI.

Requisiti:
- I riferimenti `$ref` supportati sono quelli **locali** che iniziano con `"#/"` (es. `#/components/schemas/HttpRequest`).
- Per ogni nodo di schema che contiene `$ref`:
    - il riferimento deve essere risolto seguendo il percorso a partire dalla radice del documento (`schema` principale);
    - se il riferimento non è valido o non può essere risolto, il nodo originale deve essere mantenuto così com’è.
- Quando un nodo `$ref` viene risolto:
    - il contenuto referenziato deve essere dereferenziato ricorsivamente;
    - eventuali proprietà locali definite insieme a `$ref` devono **sovrascrivere** le proprietà del target referenziato (merge `target` + local overrides).
- La dereferenziazione deve proseguire ricorsivamente su:
    - `properties` di oggetti;
    - `items` di array;
    - array di composizione `allOf`, `anyOf`, `oneOf`.
- Per evitare cicli infiniti (riferimenti ricorsivi), la funzione deve mantenere un set dei `$ref` già visitati:
    - se un `$ref` è già presente nel set `seen`, il nodo non deve essere ulteriormente espanso e deve essere restituito così com’è.
- Questa logica di dereferenziazione deve essere riutilizzata per:
    - request body;
    - responses;
    - parametri.

Da prospettiva utente: “Quando uno schema rimanda ad altri schemi tramite `$ref`, vedo una versione ‘espansa’ e leggibile, senza dover seguire manualmente i riferimenti.”

---

**FR-DASH-OAPI-12 – Comportamento di sola lettura e finalità documentale**

La sezione API Explorer deve essere una vista puramente esplorativa/documentale e non deve permettere chiamate dirette alle API.

Requisiti:
- Nessun elemento dell’interfaccia deve invocare effettivamente gli endpoint descritti (nessun “Try it out” o chiamate HTTP live).
- La pagina deve limitarsi a:
    - elencare gli endpoint raggruppati per tag;
    - mostrare per ciascun endpoint metodo, path, summary e description;
    - mostrare parametri, request body e responses con gli schemi JSON dereferenziati.
- L’utente deve poter espandere e richiudere liberamente i singoli endpoint senza effetti collaterali lato backend.
- Lo scopo principale della sezione deve essere quello di fornire documentazione interattiva sulle API esposte da OntoWeb-PT, non di fungere da client API.

Da prospettiva utente: “Uso l’API Explorer come documentazione: ci leggo cosa fanno le API, che parametri accettano e che risposta danno, ma non sto realmente chiamando il backend da qui.”

---