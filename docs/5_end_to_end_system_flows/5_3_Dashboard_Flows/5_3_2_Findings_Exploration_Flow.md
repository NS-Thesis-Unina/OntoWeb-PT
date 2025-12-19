# Findings Exploration Flow
---

Questo documento descrive il **flusso end-to-end di esplorazione dei findings dal Dashboard**, comune alle tre aree:
- **Techstack Findings**
- **Analyzer Findings**
- **HTTP Findings**

A differenza dei flussi di analisi/ingestione, questo è un flusso **read-only** e **read-heavy**, in cui il Dashboard:
- carica una lista paginata di finding (tipicamente per ID);
- recupera on-demand il **dettaglio** di un finding selezionato;
- presenta **correlazioni** (es. target/domain, HTML evidence, URI/HTTP request, resolver, severity, OWASP, ecc.).

Il flusso è un esempio tipico di **Synchronous Flow (REST)**:
- non crea job in coda;
- non coinvolge worker;
- si appoggia a query verso GraphDB (e/o caching Redis dove presente) per soddisfare richieste UI.

---

![SD](../../../images/5_end_to_end_system_flows/5_3_Dashboard_Flows/5_3_2_Findings_Exploration_Flow/5_3_2_Findings_Exploration_Flow_SD.png)

---

## REST queries (Client Action)

Il flusso viene avviato quando l’utente, tramite il Dashboard:
- apre una pagina findings (Techstack / Analyzer / HTTP);
- interagisce con paginazione o filtri;
- clicca su una riga per aprire il **drawer di dettaglio**.

Dal punto di vista client-side, il pattern ricorrente (es. pagina Analyzer Findings) è:
1. chiamata REST per ottenere una lista paginata (`offset`, `limit`) di ID;
2. (opzionale) fetch dettagli per ciascun ID per arricchire le righe visibili;
3. fetch dettaglio completo quando l’utente apre una riga (drawer).

---

## Filtering & pagination (Ingress Layer)

Il Dashboard invia richieste sincrone:
`Dashboard → Nginx → API Server`

Responsabilità dell’Ingress Layer:
- **Nginx**: reverse proxy e routing verso API.
- **API Server**:
    - validazione dei parametri di query (limit/offset, filtri);
    - normalizzazione (default, bounds, sorting);
    - mapping verso query GraphDB (SPARQL / repository query);
    - risposta immediata con:
        - `items` (lista di ID o record compatti),
        - `page` metadata (`total`, `hasNext`, `nextOffset`, ...).

Esempi di parametri tipici:
- `offset`, `limit` (server-side pagination);
- filtri logici, a seconda del tipo finding:
    - `mainDomain` / target,
    - `severity`,
    - `findingCategory`,
    - `resolver`,
    - time window (se disponibile per HTTP),
    - correlazioni (es. ruleId/document per Analyzer).

---

## Correlations (Persistence Layer – read)

Una volta ricevuta una lista paginata, il Dashboard può:
- mostrare colonne derivate dall’ID (es. `rule`/`document` nell’Analyzer findings);
- recuperare il dettaglio via endpoint `get...ById(id)` e popolare il drawer.

Nel drawer, il dettaglio include tipicamente:
- attributi del finding:
    - `id`, `severity`, `description`, `findingCategory`, `owaspCategory`, `resolver`, `mainDomain`;
- contesto di analisi (se applicabile):
    - `context.type`, `context.origin`, `context.src`;
- evidenze e linking semantico:
    - `html[]` con IRI + snippet (Analyzer),
    - collegamenti a URI/Request/Response (HTTP),
    - correlazioni a CVE/CPE o software rilevati (Techstack).

Queste correlazioni sono rese possibili dal fatto che i worker, nei flussi asincroni precedenti, hanno persistito i dati secondo ontologia:
- `Finding → detectedByResolver → ResolverInstance`
- `Finding → relatedToHTML → HTML/Tag/Field` (Analyzer)
- `Finding → httpFindingOfRequest → Request` e `Request → resp → Response` (HTTP)
- `TechstackFinding → relatedToDomain → Domain` e link a CVE (Techstack)

---

## Read-only GraphDB access (Persistence Layer)

Il flusso è **read-only**:
- nessuna scrittura su GraphDB;
- nessuna creazione di job;
- nessun worker coinvolto.

Schema concettuale (taxonomia “Synchronous REST”):
`Dashboard → Nginx → API → GraphDB → API → Dashboard`

Nota operativa: in alcuni casi l’API può usare Redis come cache o per metadati (es. stato tool), ma l’accesso principale ai finding è GraphDB.

---

## Feedback Channel (REST-only)

Il feedback verso il Dashboard è esclusivamente sincrono:
- risposta immediata con lista + paging info;
- risposta immediata con dettaglio finding.

Non è previsto WebSocket in questo flusso perché:
- non c’è processing asincrono,
- non c’è progress da comunicare.

---