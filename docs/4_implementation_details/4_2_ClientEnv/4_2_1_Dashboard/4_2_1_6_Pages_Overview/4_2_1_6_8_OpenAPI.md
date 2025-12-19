# OpenAPI
---

La pagina **OpenAPI** (titolo UI: _API Explorer_) offre un esploratore client-side dello schema OpenAPI del backend OntoWeb-PT. L’obiettivo è consentire la consultazione degli endpoint disponibili (HTTP Requests, Analyzer, Techstack, SPARQL, PCAP, Health), con parametri, body e risposte, raggruppati per **tag**.

---

## Ruolo e responsabilità

OpenAPI agisce come vista di **documentazione interattiva**:
- carica lo schema OpenAPI locale (`openapi.json`) a runtime;
- costruisce una lista di endpoint a partire da `schema.paths`;
- raggruppa gli endpoint per _tag_ (primo tag disponibile, fallback `General`);
- normalizza i parametri unendo quelli a livello di path con quelli a livello di operazione;
- delega la resa dell’elenco e dei dettagli a `OpenAPIGroup`.

Non effettua chiamate REST verso il backend: lo schema è un asset incluso nel bundle.

---

## Flusso dati

1. **Caricamento schema**
    - `useEffect()` esegue `import('./openapi.json')`
    - `schema` viene memorizzato nello state (`useState(null)`)
2. **Stato di loading**
    - finché `schema` è `null`, viene mostrato uno spinner centrato (`CircularProgress`)
3. **Costruzione gruppi**
    - iterazione su `Object.entries(schema.paths || {})`
    - per ogni path:
        - lettura `pathItem.parameters` come parametri path-level
        - iterazione delle operazioni HTTP filtrate da `HTTP_METHODS`
        - scelta del tag (`info.tags?.[0] || 'General'`)
        - merge dei parametri via `mergeParameters(pathParams, opParams)`
        - inserimento endpoint nel gruppo corrispondente
4. **Rendering**
    - per ogni gruppo (`tag → endpoints`) viene montato `OpenAPIGroup`

---

## Normalizzazione dei parametri

La funzione `mergeParameters(pathParams, opParams)` implementa una deduplicazione:
- chiave composita: `${in}:${name}` (es. `query:limit`)
- precedenza effettiva: la seconda scrittura sul `Map` vince
- ordine di inserimento: prima path-level, poi operation-level  
    → i parametri dichiarati nell’operazione **sovrascrivono** quelli dichiarati sul path in caso di collisione

---

## Composizione UI

La schermata risulta composta da tre blocchi:
1. **Header**
    - `Typography` centrata con testo “API Explorer”
2. **Pannello descrittivo**
    - `Paper` con testo introduttivo
    - animazione di ingresso `Zoom`
3. **Sezioni per tag**
    - una lista di `OpenAPIGroup`, ognuno relativo a un tag OpenAPI

---

## Componenti chiave

### OpenAPIGroup

`OpenAPIGroup` rende un blocco per tag e, per ogni endpoint, un `Accordion` con:
- **Summary**: chip con metodo HTTP + path + summary
- **Details**:
    - description testuale
    - parametri raggruppati per `in` (query/path/header/cookie)
    - request body schema (se presente)
    - responses schema (JSON), indicizzate per status code

#### Colori e scanning rapido

- il metodo HTTP viene mostrato tramite `Chip` con color mapping (`METHOD_COLORS`), così da distinguere a colpo d’occhio GET/POST/PUT/DELETE ecc.

#### Parametri raggruppati

- `groupParameters()` costruisce un dizionario per location (`query`, `path`, `header`, `cookie`)
- `prettyLocation()` converte la location in label leggibile (es. “Query parameters (filters)”)

#### Risoluzione dei `$ref`

Per rendere leggibili gli schemi, il componente implementa dereferenziazione **solo locale**:

- `resolveRef(ref, rootSchema)` risolve puntatori del tipo `#/components/schemas/...`
- `derefSchema(schemaNode, rootSchema, seen)`
    - risolve `$ref` e unisce eventuali override locali
    - gestisce cicli semplici con `Set` (`seen`)
    - attraversa `properties`, `items`, `allOf`, `anyOf`, `oneOf`

#### Request body: scelta del content-type

`getResolvedRequestSchema()` preferisce, in ordine:
1. `application/json`
2. `multipart/form-data`
3. `application/x-www-form-urlencoded`

In assenza di match, seleziona il primo content-type disponibile che espone uno `schema`.

#### Responses

`getResolvedResponses()` considera le risposte e dereferenzia lo schema solo per `application/json`.

---

## Convenzioni UX applicate

- **Progressive disclosure**: la lista endpoint rimane compatta, i dettagli emergono via `Accordion`.
- **Affordance visiva**: chip colorati per metodo HTTP e blocchi `pre` per schemi JSON.
- **Intro animata**: `Zoom` sul pannello descrittivo per un ingresso più morbido.
- **Compattezza**: buffer informativo concentrato su summary/description e JSON schema senza funzioni di “try it out”.

---

## Layout e stile

### openApi.css

- contenitore centrato con `max-width: 1200px` e `margin: 0 auto`
- titolo centrato e dimensionato (30px)
- description con padding e margini verticali

### openApiGroup.css

- spacing verticale tra accordion
- summary in flex row (chip + path + summary)
- code block con stile “dark” e font monospace, scrollabile (`overflow: auto`)

---

## Stato e side effects

- `OpenAPIExplorer` mantiene un solo stato:
    - `schema` (null → oggetto OpenAPI una volta caricato)
- side effect:
    - dynamic import in `useEffect` al mount
- nessun polling, nessun WebSocket, nessuna integrazione diretta con servizi runtime  
    → comportamento deterministico e indipendente dalla disponibilità del backend, una volta ottenuto l’asset JSON.

---