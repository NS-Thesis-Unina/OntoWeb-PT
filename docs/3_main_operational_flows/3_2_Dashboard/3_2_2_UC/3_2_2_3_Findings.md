# Findings – Casi d’uso
---

**UC-DASH-FIND-01 – Navigazione interna tra HTTP / Analyzer / Techstack Findings

- **Attore principale**  
    Utente (penetration tester / analista) che utilizza la dashboard web.
    
- **Obiettivo**  
    Spostarsi rapidamente tra le tre sottosezioni dei Findings:
    - HTTP Findings
    - Analyzer Findings
    - Techstack Findings  
        mantenendo la stessa shell di dashboard (barra superiore + nav laterale).
        
- **Precondizioni**
    - L’utente ha aperto la dashboard ed è autenticato / autorizzato all’uso (se previsto).
    - L’utente si trova in una qualunque pagina il cui path inizia con `/findings`:
        - `/findings`    
        - `/findings/analyzer`
        - `/findings/techstack`.
        
- **Postcondizioni**
    - La sottosezione selezionata è mostrata nell’area contenuto (HTTP, Analyzer o Techstack Findings).
    - Il pulsante corrispondente nella sotto-navigazione è evidenziato o disabilitato.
    - L’URL del browser riflette correttamente la sottosezione (routing client-side).
        
- **Scenario principale**
    1. L’utente apre la sezione Findings (es. clic da nav laterale su “Findings”).
    2. La barra superiore mostra tre pulsanti: **HTTP Findings**, **Analyzer Findings**, **Techstack Findings**.
    3. Di default, se l’URL è `/findings`, la sottosezione HTTP è attiva.
    4. L’utente clicca su **Analyzer Findings**.
    5. Il router aggiorna l’URL a `/findings/analyzer`.
    6. La vista centrale mostra la pagina Analyzer Findings; il pulsante “Analyzer Findings” nella sotto-nav viene segnato come attivo.
    7. L’utente può analogamente passare a **Techstack Findings**, con URL `/findings/techstack`.
        
- **Estensioni / varianti**
    - 4a. L’utente clicca sul pulsante già attivo  
        → La pagina non cambia; viene mantenuta la stessa vista senza ricarichi inutili.
    - 4b. L’utente arriva direttamente con bookmark a `/findings/analyzer` o `/findings/techstack`  
        → La sezione corretta è immediatamente caricata e il relativo pulsante è evidenziato come attivo.

---

**UC-DASH-FIND-02 – Visualizzazione lista Findings HTTP con paginazione server-side

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Consultare la lista dei Findings generati dal resolver HTTP, in forma tabellare, con paginazione server-side.
    
- **Precondizioni**
    - L’utente si trova su `/findings` (HTTP Findings come default) oppure ha selezionato la tab “HTTP Findings”.
    - Il backend OntoWeb-PT è accessibile e espone il servizio `listHttpFindings`.
        
- **Postcondizioni**
    - L’utente vede una tabella con una pagina di Findings HTTP.
    - È possibile cambiare pagina e dimensione pagina mantenendo la coerenza con i dati del backend.
        
- **Scenario principale**
    1. L’utente apre `/findings` o seleziona “HTTP Findings”.
    2. La pagina attiva una chiamata `listHttpFindings({ offset, limit })` con offset iniziale 0 e un `limit` di default (es. 100).
    3. Durante il primo caricamento, se non ci sono ancora righe:
        - viene mostrata una Backdrop bloccante con spinner.
    4. Al termine della chiamata:
        - la Backdrop scompare;
        - viene popolata una DataGrid con righe `{ id }` ricavate dall’array di ID.
    5. L’utente utilizza i controlli di paginazione (successiva/precedente, cambio page size 25/50/100).
    6. Ad ogni cambio pagina o page size, viene invocata nuovamente `listHttpFindings` con nuovi `offset`/`limit`.
    7. La DataGrid rimane visibile e utilizza il proprio stato `loading` per mostrare lo spinner interno durante i reload successivi.
        
- **Estensioni / varianti**
    - 6a. Il backend restituisce `total = 0` (nessun finding)  
        → Invece della griglia, viene mostrato un messaggio centrato “No findings to show.”.
    - 6b. L’utente cambia solo la dimensione pagina (es. da 100 a 50)  
        → Il componente ricalcola `offset`/page coerentemente e rilancia `listHttpFindings`.

---

**UC-DASH-FIND-03 – Visualizzazione lista Findings Analyzer con paginazione server-side

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Consultare l’elenco dei Findings generati dal motore Analyzer (analisi HTML / DOM), con la stessa esperienza di paginazione.
    
- **Precondizioni**
    - L’utente ha selezionato la sottosezione **Analyzer Findings** (`/findings/analyzer`).
    - Il backend espone `listAnalyzerFindings({ offset, limit })`.

- **Postcondizioni**
    - L’utente visualizza una DataGrid con la pagina corrente di Analyzer Findings.
    - La paginazione server-side e la dimensione pagina sono sincronizzate con il backend.
    
- **Scenario principale**
    1. L’utente clicca su “Analyzer Findings” nella sotto-navigazione o atterra su `/findings/analyzer`.
    2. La pagina invia `listAnalyzerFindings({ offset, limit })` con offset 0 e limit di default.
    3. Durante il primo caricamento, viene mostrata una Backdrop bloccante se non ci sono righe ancora caricate.
    4. Al termine:
        - la Backdrop scompare;
        - la DataGrid mostra righe `{ id }`, ciascuna rappresentante un finding.
    5. L’utente usa la paginazione (avanti/indietro, cambio page size).
    6. Ogni azione di paginazione richiama `listAnalyzerFindings` con nuovi parametri; la DataGrid resta visibile e mostra lo spinner integrato.
        
- **Estensioni / varianti**
    - 4a. Nessun finding restituito  
        → Messaggio “No findings to show.” al posto della tabella.
    - 5a. L’utente usa bookmark per una pagina successiva (se supportato)  
        → Il componente ricostruisce `page`/`pageSize` e ricarica i dati coerentemente.

---

**UC-DASH-FIND-04 – Visualizzazione lista Findings Techstack con paginazione server-side

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Consultare i Findings Techstack (evidenze su cookie, header, software, ecc.) con la stessa UX tabellare e paginata.
    
- **Precondizioni**
    - L’utente si trova su `/findings/techstack`.
    - Il backend espone `listTechstackFindings({ offset, limit })`.
        
- **Postcondizioni**
    - L’utente visualizza la tabella con i Techstack Findings per la pagina corrente.
    - La navigazione tra le pagine è coerente con i metadati `total`, `offset`, `limit`.
        
- **Scenario principale**
    1. L’utente seleziona **Techstack Findings** dalla sotto-nav.
    2. La pagina chiama `listTechstackFindings({ offset, limit })` con valori iniziali.
    3. Se è il primo caricamento, viene mostrata la Backdrop bloccante.
    4. Alla risposta:
        - la Backdrop viene rimossa;
        - viene popolata la DataGrid con righe `{ id }`.
    5. L’utente usa i controlli di paginazione (pagine, page size).
    6. La pagina chiama nuovamente `listTechstackFindings` con i nuovi parametri;
        - lo spinner della DataGrid indica il caricamento non bloccante.
            
- **Estensioni / varianti**
    - 4a. Nessun risultato  
        → “No findings to show.”.
    - 5a. L’utente passa frequente da una sottosezione all’altra  
        → Ogni sottosezione ricorda il proprio stato di paginazione (se previsto dall’implementazione) o riparte dalla prima pagina.

---

**UC-DASH-FIND-05 – Gestione errori nel caricamento delle liste di Findings

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Essere informato di eventuali errori nel recupero dei Findings, senza che l’interfaccia diventi inutilizzabile.
    
- **Precondizioni**
    - L’utente ha aperto una delle tre sottosezioni:
        - HTTP Findings
        - Analyzer Findings
        - Techstack Findings.
    - È in corso una chiamata di listing (`listHttpFindings`, `listAnalyzerFindings`, `listTechstackFindings`).
        
- **Postcondizioni**
    - In caso di errore, la UI:
        - mostra una snackbar con messaggio esplicito;
        - termina lo stato `loading`;
        - non va in errore fatale.
    - L’utente può riprovare (cambiare pagina, ricaricare) in un secondo momento.
        
- **Scenario principale (generico)**
    1. L’utente apre la pagina di Findings (es. HTTP).
    2. Viene chiamato `listHttpFindings`.
    3. Durante il caricamento il componente è in stato `loading`.
    4. Il backend restituisce un errore (es. 500 o timeout).
    5. Il componente imposta `loading = false` e mostra una snackbar tipo:
        - “Error while loading HTTP findings.”  
            analogamente per Analyzer/Techstack.
    6. La DataGrid può risultare vuota; in tal caso viene mostrato “No findings to show.”.
    7. L’utente può effettuare un nuovo tentativo (es. cambiare pagina, refresh).
    
- **Estensioni / varianti**
    - 5a. L’errore avviene dopo che alcuni dati erano già stati caricati in precedenza  
        → L’ultima lista valida rimane in tabella, così l’utente continua a vedere qualche dato; la snackbar informa del problema sull’ultimo fetch.

---

**UC-DASH-FIND-06 – Apertura del dettaglio di un Finding in drawer laterale

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Ispezionare i dettagli completi di un singolo Finding (HTTP, Analyzer o Techstack) aprendo un drawer sulla destra.
    
- **Precondizioni**
    - La lista di findings (HTTP/Analyzer/Techstack) è stata caricata.
    - L’utente vede almeno una riga in tabella con azione “View details”.
    - Il backend espone i servizi:
        - `getHttpFindingById(id)` 
        - `getAnalyzerFindingById(id)`
        - `getTechstackFindingById(id)`.
        
- **Postcondizioni**
    - Il drawer laterale viene aperto sulla destra.
    - I dettagli del finding selezionato vengono caricati e mostrati in forma strutturata.
    - L’utente può chiudere il drawer e tornare alla sola vista elenco.
        
- **Scenario principale (generico)**
    1. L’utente individua un finding interessante nella tabella (es. riga HTTP).
    2. Clicca sull’icona “View details” associata alla riga.
    3. La pagina apre un drawer ancorato a destra, mostra uno spinner centrale e invoca:
        - `getHttpFindingById(id)` per HTTP,
        - `getAnalyzerFindingById(id)` per Analyzer,
        - `getTechstackFindingById(id)` per Techstack.
    4. Alla risposta del backend:
        - lo spinner scompare;
        - l’header del drawer mostra titolo “Finding details – Id: …” e i metadati principali;
        - il corpo del drawer mostra le sezioni previste per quel tipo di finding.
    5. L’utente scorre il contenuto del drawer per leggere tutte le informazioni.
    6. L’utente chiude il drawer tramite:
        - icona “X” nell’header, oppure
        - click sul backdrop.
            
- **Estensioni / varianti**
    - 3a. La chiamata di dettaglio fallisce  
        → Il drawer mostra temporaneamente il loader, poi:
        - mostra una snackbar “Error while retrieving finding details.”;
        - chiude automaticamente il drawer e azzera l’oggetto `finding`.

---

**UC-DASH-FIND-07 – Visualizzazione severità e metadati principali di un Finding

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Capire a colpo d’occhio la criticità e il contesto principale di un finding attraverso l’header del drawer e la sezione “Finding”.
    
- **Precondizioni**
    - È stato aperto il drawer dettagli di un finding (HTTP, Analyzer, Techstack).
    - La risposta del backend contiene almeno:
        - `severity`
        - `ruleId` o regola ricavabile dall’ID;
        - categoria, resolver, e (a seconda del tipo) OWASP, evidenceType, remediation, ecc.
            
- **Postcondizioni**
    
    - L’header del drawer mostra:
        - chip della regola;
        - chip di severità con colore coerente;
        - breve descrizione;
        - metadati sintetici.
    - La sezione “Finding” elenca i campi principali in forma etichetta/valore.
        
- **Scenario principale (HTTP Findings)**
    1. L’utente ha aperto il dettaglio di un finding HTTP.
    2. Nell’header vede:
        - un chip con la regola (`ruleId` o derivata dall’ID);
        - un chip di severità (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) con colore:
            - LOW → info
            - MEDIUM → warning
            - HIGH/CRITICAL → error
            - default se non riconosciuta;
        - una breve description;
        - una riga con Category, OWASP, Resolver.
    3. Nella sezione “Finding” vede valori strutturati:
        - Id, Rule, Severity, Category, OWASP category, Resolver, Description, Remediation.
        
- **Scenario principale (Analyzer / Techstack)**  
    4. Per un finding Analyzer, la sezione “Finding” elenca Id, Rule, Severity, Category, OWASP, Resolver, Description.  
    5. Per un finding Techstack, la sezione include anche `Evidence type` e `Remediation` (se presente).
    
- **Estensioni / varianti**
    - 2a. La severità non è valorizzata o ha un valore non riconosciuto  
        → Il chip utilizza il colore `default`, ma viene comunque mostrata una label testuale.
    - 3a. Alcuni metadati (es. OWASP) sono mancanti  
        → La UI può mostrare “—” o omettere la riga, evitando errori.

---

**UC-DASH-FIND-08 – Consultazione del contesto HTTP di un Finding HTTP (“HTTP summary”)

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Collegare rapidamente il finding HTTP alla specifica richiesta/risposta HTTP a cui si riferisce (metodo, status, URL).
    
- **Precondizioni**
    - Il drawer di dettaglio di un finding HTTP è aperto.
    - Il backend fornisce dati sul contesto HTTP (method, status, URL, ecc.).
        
- **Postcondizioni**
    - L’utente può:
        - vedere metodo, status e URL in una sezione dedicata;
        - copiare l’URL completa negli appunti.
            
- **Scenario principale**
    1. L’utente apre il dettaglio di un HTTP Finding.
    2. Scorrendo il drawer, trova la sezione “HTTP summary”.
    3. Nella sezione vede:
        - **Method**: il metodo HTTP associato al finding;
        - **Status**: codice risposta (numero o stringa, gestito correttamente);
        - **URL**: la URL completa della richiesta incriminata, eventualmente troncata a livello visivo ma con tooltip per l’intero valore.
    4. L’utente clicca sull’icona o pulsante “Copy URL”.
    5. L’URL viene copiato in clipboard (in caso di problemi l’errore viene gestito silenziosamente).
    6. L’utente può incollare l’URL nel proprio report o in altri strumenti.
        
- **Estensioni / varianti**
    - 3a. L’URL non è disponibile o è vuota  
        → La sezione può mostrare un placeholder (“—” o “Not available”) e il pulsante di copia può essere disabilitato.

---

**UC-DASH-FIND-09 – Analisi del contesto e HTML di riferimento per un Finding Analyzer

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Comprendere il contesto in cui è stato generato un finding Analyzer (tipo di contenuto, origine, sorgente) e ispezionare gli eventuali frammenti HTML problematici.
    
- **Precondizioni**
    - Il drawer di un finding Analyzer è aperto.
    - La risposta del backend include campi per:
        - `context` (type, origin, src, ecc.);
        - eventuali nodi HTML di riferimento.
            
- **Postcondizioni**
    - L’utente vede:
        - una sezione “Context” con informazioni sul tipo di contesto e origine;
        - lo `src` (URL sorgente del documento) con pulsante copy;
        - eventualmente, una sezione “HTML reference” con lista di frammenti HTML.
            
- **Scenario principale**
    1. L’utente apre il dettaglio di un Analyzer Finding.
    2. Nella sezione “Context” legge:
        - `Type` (es. DOM node, script, attribute);
        - `Origin` (inline, external, ecc.);
        - una riga con `src`/URL del documento, mostrata per esteso con tooltip.
    3. L’utente clicca sul pulsante di copia accanto a `src` per copiarne il valore.
    4. Nella sezione “HTML reference”, se presente:
        - vede un elenco di nodi HTML, ognuno con:
            - l’IRI/identificatore dell’elemento;
            - il frammento `source` HTML evidenziato.
    5. L’utente usa queste informazioni per localizzare esattamente nel markup il problema individuato dalla regola.
        
- **Estensioni / varianti**
    - 4a. Non sono presenti nodi HTML associati  
        → La sezione “HTML reference” mostra “No HTML reference available.”.
    - 2a. Il campo `src` non è disponibile  
        → La UI mostra “—” e il pulsante di copia può essere omesso o disabilitato.

---

**UC-DASH-FIND-10 – Analisi delle evidenze Techstack (Cookie / Header / Software)

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Visualizzare le evidenze concrete (cookie, header, software) su cui si basa un finding Techstack, per verifiche manuali e documentazione.
    
- **Precondizioni**
    - Il drawer di un finding Techstack è aperto.
    - La risposta del backend può contenere array:
        - `cookies`
        - `headers`
        - `software`.
            
- **Postcondizioni**
    - L’utente vede fino a tre sezioni:
        - “Cookie evidence”
        - “Header evidence”
        - “Software evidence”
    - Ogni sezione mostra dati strutturati o un messaggio di assenza evidenze.
        
- **Scenario principale**
    1. L’utente apre il dettaglio di un finding Techstack.
    2. Nella sezione “Cookie evidence”:
        - se ci sono cookie:
            - vede IRI, Name, Domain, Secure, HttpOnly per ciascun cookie;
        - se non ci sono:
            - legge “No cookie evidence available.”.
    3. Nella sezione “Header evidence”:
        - se l’array `headers` è non vuoto:
            - ogni header viene mostrato come `name: value`;
        - altrimenti:
            - “No header evidence available.”.
    4. Nella sezione “Software evidence”:
        - se sono presenti elementi:
            - ogni software mostra Name, Version, Category, Vendor;
        - in mancanza:
            - “No software evidence available.”.
    5. L’utente correla il finding alle evidenze concrete per supportare le proprie analisi.
        
- **Estensioni / varianti**
    - 2a. Una sola categoria di evidenza è presente (es. solo cookie)  
        → La pagina mostra solo la sezione rilevante e i relativi messaggi per le sezioni vuote.
    - 2b. Alcuni attributi (es. Secure/HttpOnly) non sono noti  
        → La UI mostra ‘—’ o valori espliciti true/false quando disponibili.

---

**UC-DASH-FIND-11 – Utilizzo delle azioni di copia dai dettagli dei Findings

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Copiare velocemente informazioni chiave (URL, sorgente contesto) per incollarle in report, note o tool esterni.
    
- **Precondizioni**
    - Il drawer di un finding HTTP o Analyzer è aperto.
    - La UI espone almeno:
        - pulsante “Copy URL” nella sezione “HTTP summary” (HTTP Findings);
        - pulsante di copia per `src` nella sezione “Context” (Analyzer Findings).
            
- **Postcondizioni**
    - Il valore associato all’azione di copia viene inviato alla clipboard (quando possibile).
    - Eventuali errori di clipboard non causano crash dell’interfaccia.
        
- **Scenario principale**
    1. L’utente legge un HTTP Finding e decide di riportare l’URL incriminata in un report.
    2. Clicca su “Copy URL”.
    3. Il sistema tenta di scrivere nella clipboard l’URL (internamente con le API del browser).
    4. L’utente incolla l’URL in un documento esterno.
    5. In un secondo momento, l’utente apre un Analyzer Finding.
    6. Nella sezione “Context”, clicca sull’icona copy accanto al campo `src`.
    7. L’URL sorgente viene copiata e può essere incollata in altri strumenti (es. per riprodurre il problema).
        
- **Estensioni / varianti**
    - 3a. L’accesso alla clipboard fallisce (permessi browser, ecc.)  
        → L’errore viene gestito in silenzio o con un messaggio non bloccante; il drawer rimane comunque utilizzabile.
        
---