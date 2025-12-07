# Findings - Requisiti Funzionali
---
**FR-DASH-FIND-01 – Navigazione interna alla sezione Findings (HTTP / Analyzer / Techstack)**

Quando l’utente si trova in una qualunque sottosezione di Findings (`/findings`, `/findings/analyzer`, `/findings/techstack`), la barra superiore (AppBar) deve mostrare una sotto-navigazione dedicata con tre voci:
- **Http Findings**
- **Analyzer Findings**
- **Techstack Findings**

Requisiti:
- il pulsante corrispondente alla sottosezione corrente deve risultare disabilitato (o comunque chiaramente non cliccabile);
- cliccando su ciascuna voce l’utente viene portato alla route relativa:
    - `Http Findings` → `/findings`
    - `Analyzer Findings` → `/findings/analyzer`
    - `Techstack Findings` → `/findings/techstack`
- la sotto-navigazione deve comparire **solo** quando il pathname inizia con `/findings`, così da non “sporcare” la UI nelle altre sezioni della dashboard.

---

**FR-DASH-FIND-02 – Pagina di default per la sezione Findings (HTTP Findings)**

Quando l’utente accede alla route generale `/findings` (senza specificare un sotto-percorso):
- deve essere mostrata di default la pagina **HTTP Findings** (elenco dei findings dal resolver HTTP);
- la sotto-navigazione deve evidenziare `Http Findings` come tab/sezione attiva;
- l’URL `/findings` e l’URL `/findings/` devono essere equivalenti ai fini del routing (stessa pagina).

In questo modo l’utente ha sempre un punto di ingresso chiaro nella sezione, basato sul caso d’uso più frequente (le evidenze sul traffico HTTP).

---

**FR-DASH-FIND-03 – Layout comune delle pagine di Findings (titolo, descrizione, lista)**

Ogni pagina di Findings (HTTP, Analyzer, Techstack) deve seguire uno schema visivo coerente:
- un **titolo di pagina** in alto (es. “HTTP Findings”, “Analyzer Findings”, “Techstack Findings”);
- un **blocco descrittivo introduttivo** (Paper) che:
    - spiega in linguaggio naturale che tipo di evidenze vengono mostrate;
    - suggerisce all’utente come usare la vista (aprire le righe, leggere regola, severità, ecc.);
    - compare con una animazione morbida (es. `Zoom in`);
- un’area principale con la **griglia (DataGrid) dei findings** oppure un messaggio esplicito di assenza dati:
    - se `rows.length > 0` → mostra DataGrid;
    - se `rows.length === 0` → mostra un messaggio tipo “No findings to show.” centrato.

---

**FR-DASH-FIND-04 – Paginazione server-side uniforme per tutte le liste di Findings**

Per ciascuna delle tre liste (HTTP, Analyzer, Techstack):

- il backend espone una paginazione basata su offset/limit (`offset`, `limit`, `total` e metadati come `hasNext`, `hasPrev`);
- la DataGrid deve usare **paginazione server-side** (`paginationMode="server"`), mappando:
    - `offset` e `limit` in un **modello di paginazione** (page, pageSize);
    - gli eventi di cambio pagina/page size della DataGrid in chiamate a una funzione di callback (`onPageChange`) che richiede nuove righe al backend;
- la lista deve permettere all’utente di cambiare page size tra almeno 25, 50, 100 elementi per pagina;
- il numero totale di elementi (`rowCount`) deve riflettere il valore `total` ritornato dal backend, così che la barra di paginazione sia coerente.

---

**FR-DASH-FIND-05 – Gestione stati di caricamento iniziale e successivi**

Per ciascuna pagina di Findings:

- al **primo caricamento** (cuando `loading === true` e non ci sono ancora righe) deve essere mostrata una **Backdrop bloccante** con spinner (`CircularProgress`), così che l’utente percepisca che la pagina si sta inizializzando;
- ai caricamenti successivi (cambio pagina, pagina già popolata) la DataGrid deve rimanere visibile e utilizzare lo stato `loading` per mostrare lo spinner integrato nel componente, senza bloccare l’intera schermata;
- il comportamento deve essere coerente tra HTTP Findings, Analyzer Findings e Techstack Findings.

---

**FR-DASH-FIND-06 – Gestione errori di caricamento liste Findings**

Durante il recupero dei dati per le liste:

- in caso di errore di rete o di backend (fallimento delle chiamate `listHttpFindings`, `listAnalyzerFindings`, `listTechstackFindings`), l’app deve:
    - mostrare una **notifica non bloccante** (snackbar) con messaggio esplicito, ad esempio:    
        - “Error while loading HTTP findings.”   
        - “Error while loading analyzer findings.”
        - “Error while loading techstack findings.”
    - terminare lo stato di caricamento (`loading = false`) per permettere eventuali nuovi tentativi (es. cambiando pagina o ricaricando la vista);
- la UI non deve andare in errore fatale: se la lista resta vuota, compare comunque il messaggio “No findings to show.”.

---

**FR-DASH-FIND-07 – Apertura del dettaglio finding in drawer laterale**

Da ciascuna riga delle DataGrid di Findings (HTTP, Analyzer, Techstack), l’utente deve poter:
- cliccare su un’azione dedicata (icona “View details”) per aprire un **drawer laterale** (a destra) che mostra il dettaglio del finding;
- all’apertura del drawer la pagina deve:
    - richiedere i dettagli completi al backend tramite:
        - `getHttpFindingById(id)` per HTTP Findings;    
        - `getAnalyzerFindingById(id)` per Analyzer Findings;
        - `getTechstackFindingById(id)` per Techstack Findings;
    - mostrare uno stato di caricamento interno al drawer (spinner centrato) finché i dati non sono disponibili;
- il drawer deve utilizzare un wrapper comune (DrawerWrapper) con:
    - **header fisso** contenente il titolo “Finding details – Id: …”; 
    - pulsante di chiusura (icona “X”) che chiude il drawer;
    - comportamento standard di chiusura anche cliccando sul backdrop.

---

**FR-DASH-FIND-08 – Gestione errori nel caricamento del dettaglio finding**

Se durante il caricamento del dettaglio:
- la chiamata `get…FindingById(id)` fallisce o restituisce errore, la UI deve:
    - mostrare uno snackbar con un messaggio esplicito (es. “Error while retrieving finding details.”);
    - azzerare l’oggetto di dettaglio interno (`finding = null`);
    - chiudere automaticamente il drawer (per evitare che l’utente resti in una vista inconsistente).

In ogni caso lo stato di caricamento del drawer deve essere riportato a `false` una volta gestito l’errore.

---

**FR-DASH-FIND-09 – Visualizzazione e codifica colore della severità dei Findings**

Nel dettaglio di tutti i tipi di finding (HTTP, Analyzer, Techstack), la severità deve:
- essere mostrata come **Chip** MUI con etichetta testuale (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`);
- usare una codifica colore coerente:
    - `LOW` → `info`
    - `MEDIUM` → `warning`
    - `HIGH` → `error`
    - `CRITICAL` → `error`
    - valore non riconosciuto / assente → `default`
- la severità deve essere visibile sia in forma sintetica nell’header del drawer (assieme alla regola) sia, dove previsto, nella sezione “Finding”.

---

## HTTP Findings

---

**FR-DASH-FIND-10 – Caricamento elenco findings HTTP**

La pagina **HTTP Findings** deve:
- invocare il servizio `listHttpFindings({ offset, limit })` per recuperare una pagina di risultati;
- adattare l’array di ID ritornati a righe DataGrid del tipo `{ id }`;
- aggiornare lo stato di paginazione (`page`) e dei parametri correnti (`params`) in base ai valori `limit` e `offset` restituiti dal backend;
- attivare nuovamente il caricamento (`fetchFindings`) ogni volta che la paginazione viene modificata (cambio pagina o page size da DataGrid).

---

**FR-DASH-FIND-11 – Colonne sintetiche per la tabella HTTP Findings (Rule / Target)**

La DataGrid HTTP Findings deve esporre almeno le seguenti colonne:
- **Finding ID**:
    - mostra l’ID completo del finding (potenzialmente lungo) con testo troncato e tooltip contenente il valore completo; 
- **Rule**:
    - ricavata parsando l’ID come stringa codificata (decodeURIComponent + split su `:`);
    - corrisponde al segmento dopo il token `http` nel formato `ns:resolver:http:rule:target...`;    
- **Target**:
    - ricavata sempre dall’ID, unendo i segmenti successivi alla regola (tipicamente identificano l’oggetto/risorsa colpita);
- **Actions**:
    - colonna senza header testuale, con icona “View details” che apre il drawer per il finding selezionato.

---

**FR-DASH-FIND-12 – Dettaglio Finding HTTP: header e attributi principali**

Nel drawer di dettaglio di un finding HTTP, la UI deve presentare:
- **Header** con:
    - chip con il `ruleId` (se disponibile e, in fallback, la regola estratta dall’ID) per riconoscere rapidamente la regola che ha generato il finding;
    - chip con la severità colorata;
    - descrizione testuale sintetica del finding;
    - riga di metadati con:
        - `Category` (findingCategory);
        - `OWASP` (owaspCategory);
        - `Resolver` (resolver utilizzato);
- **Sezione “Finding”** con righe etichetta/valore:
    - Id;
    - Rule (da `ruleId` o dall’ID);
    - Severity;
    - Category;
    - OWASP category;
    - Resolver;
    - Description;
    - Remediation (suggerimento di mitigazione, se presente).

---

**FR-DASH-FIND-13 – Sezione “HTTP summary” nel dettaglio HTTP Findings**

Il dettaglio di un finding HTTP deve includere una sezione dedicata “HTTP summary” che mostri:
- il **metodo HTTP** associato al finding (Method);
- lo **status code** della risposta (Status), con gestione corretta del caso in cui lo status sia numerico o stringa;
- l’**URL completo** della richiesta, mostrato in una riga dedicata con:
    - testo troncato ma interamente visibile tramite `title`/tooltip;
    - pulsante per **copiare** l’URL negli appunti;

Questa sezione consente al penetration tester di collegare immediatamente il finding alla specifica richiesta HTTP incriminata.

---

## Analyzer Findings

---

**FR-DASH-FIND-14 – Caricamento elenco findings Analyzer**

La pagina **Analyzer Findings** deve:
- invocare `listAnalyzerFindings({ offset, limit })` per ottenere la lista degli ID dei findings;
- trasformare l’array di ID in righe DataGrid del tipo `{ id }`;
- aggiornare lo stato di paginazione e dei parametri correnti secondo la risposta del backend;
- richiamare `fetchFindings` ogni volta che l’utente cambia pagina o page size nella griglia.

---

**FR-DASH-FIND-15 – Colonne sintetiche per Analyzer Findings (Rule / Document)**

La DataGrid Analyzer Findings deve mostrare almeno:
- **Finding ID**:
    - cella testuale con ID troncato e tooltip per visualizzare il valore completo;
- **Rule**:
    - campo calcolato a partire dall’ID (decodeURIComponent + split `:`), tipicamente il terzo segmento;
- **Document**:
    - campo calcolato dall’ID (solitamente il quarto segmento), rappresenta il documento/pagina di origine della scansione;
- **Actions**:
    - colonna con pulsante “View details” per aprire il drawer sul finding selezionato.

---

**FR-DASH-FIND-16 – Dettaglio Finding Analyzer: header e sezione “Finding”**

Nel drawer di dettaglio di un finding Analyzer, la UI deve presentare:
- **Header** con:
    - chip contenente la `ruleId` (o la regola derivata dall’ID) per identificare la regola di analisi HTML che ha generato il finding;
    - chip di severità colorato;
    - descrizione testuale del finding (description);
    - metadati in formato compatto:
        - Category (findingCategory);   
        - OWASP (owaspCategory);
        - Resolver (resolver);
- **Sezione “Finding”** con righe etichetta/valore:
    - Id;
    - Rule;
    - Severity;
    - Category;
    - OWASP category;
    - Resolver;
    - Description.

Questa sezione definisce la natura del problema individuato a livello semantico e di regola.

---

**FR-DASH-FIND-17 – Sezioni “Context” e “HTML reference” per Analyzer Findings**

Nel dettaglio di un finding Analyzer devono essere presenti:
- **Sezione “Context”** che descrive il contesto di analisi in cui il finding è stato rilevato, includendo:
    - `Type` (tipologia di contesto: es. nodo DOM, script, ecc.);
    - `Origin` (origine del contenuto: es. inline, esterno, ecc.);
    - una riga specifica per la sorgente (`src` / URL del documento), visualizzata come testo completo con:
        - tooltip per la visualizzazione integrale;
        - pulsante per copiare la sorgente negli appunti.
- **Sezione “HTML reference”** che elenca gli eventuali frammenti HTML legati al finding:
    - se non sono presenti nodi HTML, deve essere mostrato un messaggio “No HTML reference available.”;
    - altrimenti, per ciascun nodo deve essere mostrato:
        - l’IRI dell’elemento (in forma di caption);
        - il frammento di sorgente HTML (`source`) evidenziato.

Queste informazioni permettono al penetration tester di risalire rapidamente al markup problematico e al contesto applicativo.

---

### Techstack Findings

---

**FR-DASH-FIND-18 – Caricamento elenco findings Techstack**

La pagina **Techstack Findings** deve:
- invocare `listTechstackFindings({ offset, limit })` per ottenere una pagina di ID di findings;
- mappare l’array di ID in righe DataGrid `{ id }`;
- sincronizzare i metadati di paginazione (`page`) e i parametri correnti (`params`) con la risposta del backend;
- ricaricare i dati (`fetchFindings`) quando la paginazione della griglia cambia.

---

**FR-DASH-FIND-19 – Colonne sintetiche per Techstack Findings (Type / Scope / Subject)**

La DataGrid Techstack Findings deve esporre almeno:
- **Finding ID**:
    - visualizzato con troncamento e tooltip full-value;
- **Type**:
    - derivato dall’ID (tipicamente terzo segmento), indica la tipologia di evidenza (es. header, cookie, software, ecc.);
- **Scope**:
    - derivato dall’ID (quarto segmento), descrive l’ambito (es. dominio, host, contesto specifico);
- **Subject**:
    - derivato dall’ID (quinto segmento), identifica il soggetto concreto dell’analisi (es. nome header, nome cookie, tecnologia specifica);
- **Actions**:
    - colonna azioni con icona “View details” per aprire il drawer.

---

**FR-DASH-FIND-20 – Dettaglio Finding Techstack: header e sezione “Finding”**

Il drawer di dettaglio per un finding Techstack deve includere:
- **Header** con:
    - chip della regola (`ruleId` o rule estratta dall’ID) che ha prodotto il finding;
    - chip di severità;
    - eventuale chip con il `evidenceType` (es. COOKIE, HEADER, SOFTWARE) per chiarire su che tipo di evidenza si basa il finding;
    - testo descrittivo del finding;
    - riga di metadati con Category e Resolver.
- **Sezione “Finding”** con righe:
    - Id;
    - Rule (da `ruleId` o derivata dall’ID);
    - Severity;
    - Category;
    - Evidence type;
    - Resolver;
    - Description;
    - Remediation (se presente).

Questa sezione fornisce al penetration tester una visione immediata del problema e della regola ontologica che lo ha generato.

---

**FR-DASH-FIND-21 – Sezioni di evidenza (Cookie / Header / Software) nel dettaglio Techstack**

Il dettaglio Techstack deve rendere esplicite le evidenze su cui si basa il finding, organizzandole in sezioni:

- **Cookie evidence**
    - se l’array di `cookies` è vuoto, mostrare “No cookie evidence available.”;
    - altrimenti, per ciascun cookie mostrare:
        - IRI;
        - Name;
        - Domain;
        - Secure (true/false o ‘—’ se non noto);
        - HttpOnly (true/false o ‘—’ se non noto).
- **Header evidence**
    - se l’array di `headers` è vuoto, mostrare “No header evidence available.”;
    - altrimenti, per ogni header mostrare almeno `name: value`.
- **Software evidence**
    - se l’array di `software` è vuoto, mostrare “No software evidence available.”;
    - altrimenti, per ciascun software:
        - Name;
        - Version;
        - Category;
        - Vendor.

Questo consente di collegare immediatamente il finding alla tecnologia, header o cookie coinvolto, e supporta eventuali verifiche manuali aggiuntive.

---

**FR-DASH-FIND-22 – Azioni di copia negli appunti dai dettagli dei Findings**

Dove rilevante, il dettaglio dei findings deve permettere di copiare rapidamente alcuni valori critici negli appunti:
- per **HTTP Findings**:
    - copia dell’URL nella sezione “HTTP summary”;
- per **Analyzer Findings**:
    - copia del campo `src` (URL sorgente del contesto) nella sezione “Context”;

Le azioni di copia devono:
- essere esposte con una piccola icona “copy”;
- non generare errori fatali in caso di impossibilità di accesso alla clipboard (eventuali errori vengono gestiti in silenzio).

Questo facilita l’incollaggio dei riferimenti in report, note o tool esterni usati dal penetration tester.

---