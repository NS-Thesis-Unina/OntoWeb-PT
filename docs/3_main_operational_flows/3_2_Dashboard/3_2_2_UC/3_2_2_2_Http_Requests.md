# Http Requests - Casi d’uso
---

**UC-DASH-HTTP-01 – Visualizzazione iniziale della lista di richieste HTTP**

- **Attore principale**  
    Utente (penetration tester / analista) che utilizza la dashboard.
    
- **Obiettivo**  
    Vedere una prima lista significativa di richieste HTTP normalizzate presenti nell’ontologia (GraphDB), senza dover configurare nulla.
    
- **Precondizioni**
    - L’utente ha effettuato l’accesso alla dashboard (se previsto) ed è autenticato/autorizzato.
    - La dashboard è raggiungibile e viene aperta la route `/http-requests` (ad es. dalla nav laterale o da una feature card della Home).
        
- **Postcondizioni**
    - Viene caricata la prima pagina di richieste HTTP dal backend (offset 0, limit default 100).
    - La tabella mostra, per ogni riga, almeno: Method, Status (se presente), URL canonica (`uri.full`), Authority, Graph.
    - In caso di completamento con successo, lo stato di caricamento risulta disattivato (loading = false).
        
- **Scenario principale**
    1. L’utente clicca sulla voce “HTTP Requests” nella barra di navigazione laterale (o su una card corrispondente in Home).
    2. La dashboard passa alla route `/http-requests`.
    3. Il componente avvia automaticamente il caricamento della prima pagina (`offset=0`, `limit=100`) verso il backend.
    4. Finché non sono disponibili righe, viene mostrato un Backdrop bloccante con spinner al centro, al posto della tabella.
    5. Il backend restituisce l’elenco delle richieste e i metadati di paginazione (totale, pagina, ecc.).
    6. La vista rimuove il Backdrop e mostra la DataGrid popolata con le prime 100 richieste (o meno, se il totale è inferiore).
    7. L’utente può scorrere verticalmente la tabella e avere, a colpo d’occhio, un overview delle richieste HTTP presenti.
        
- **Estensioni / varianti**
    - 5a. Il backend restituisce meno righe del limite richiesto (es. 37 richieste totali)  
        → La tabella mostra comunque le righe disponibili, e la paginazione rispecchia il numero complessivo di elementi restituiti.
    - 5b. Il backend restituisce zero righe  
        → Si applica UC-DASH-HTTP-06 (assenza risultati).
        

---

**UC-DASH-HTTP-02 – Navigazione tra le pagine e cambio del page size mantenendo i filtri**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Scorrere le richieste HTTP in modo paginato e modificare il numero di elementi per pagina, mantenendo eventuali filtri già applicati.
    
- **Precondizioni**
    - La pagina “HTTP Requests” è aperta e ha già caricato almeno una pagina di risultati (vedi UC-DASH-HTTP-01).
    - L’utente può aver applicato dei filtri di ricerca (vedi UC-DASH-HTTP-03).
        
- **Postcondizioni**
    - La pagina corrente e il page size selezionato risultano sincronizzati con i parametri di chiamata al backend (`offset`, `limit`).
    - Eventuali filtri attivi rimangono invariati durante il cambio pagina o cambio page size.
    - La tabella mostra i risultati corrispondenti alla combinazione (page, pageSize, filtri) corrente.
        
- **Scenario principale (cambio pagina)**
    1. L’utente si trova nella pagina “HTTP Requests” con una DataGrid già popolata.
    2. Dalla barra di paginazione della griglia, l’utente seleziona una pagina successiva (es. passa da pagina 1 a pagina 2).
    3. Il componente calcola i nuovi parametri (`offset` = `page * limit`) mantenendo lo stesso `limit` e gli stessi filtri correnti.
    4. Viene effettuata una nuova chiamata al backend per recuperare le righe della nuova pagina.
    5. Lo spinner interno della DataGrid indica il caricamento, ma la tabella rimane visibile con i dati precedenti finché il nuovo set non è pronto.
    6. A risposta ricevuta, la DataGrid aggiorna le righe con i risultati della nuova pagina.
    7. La barra di paginazione riflette il passaggio alla pagina selezionata.
        
- **Scenario alternativo (cambio page size)**
    1. L’utente, dalla barra di paginazione, cambia il numero di righe per pagina (es. da 100 a 50).
    2. Il componente aggiorna il `limit` (50) e resetta la pagina alla prima (page 0, `offset=0`), mantenendo gli stessi filtri.
    3. Viene inviata una nuova richiesta al backend con i nuovi parametri.
    4. Al termine, la tabella mostra i risultati della prima pagina con il nuovo page size.
        
- **Estensioni / varianti**
    - 4a. Il backend restituisce un errore durante il cambio pagina o page size  
        → Si applica UC-DASH-HTTP-05 (errore nel caricamento lista), mantenendo in vista l’ultima pagina valida.

---

**UC-DASH-HTTP-03 – Ricerca tramite toolbar filtri e pulsante “Apply”**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Restringere l’elenco delle richieste HTTP tramite filtri mirati (Method, Scheme, Authority, Path, Full-text), controllando esplicitamente quando applicarli.
    
- **Precondizioni**
    - La pagina “HTTP Requests” è aperta e la DataGrid è visibile.
    - La toolbar dei filtri è mostrata sopra la lista con i campi:
        - Method (select con All, GET, POST, PUT, DELETE, HEAD, OPTIONS, PATCH…),
        - Scheme,
        - Authority,
        - Path,
        - Full-text.
            
- **Postcondizioni**
    - I filtri immessi vengono applicati a partire dalla prima pagina (offset 0) al click su “Apply”.
    - Lo snapshot di filtri “applicati” viene aggiornato e diventa il nuovo riferimento per la change detection.
    - L’utente visualizza una notifica di conferma se il caricamento va a buon fine (es. “I filtri sono stati applicati correttamente.”).
        
- **Scenario principale**
    1. L’utente compila uno o più campi nella toolbar dei filtri (es. Method = GET, Authority = `www.example.com`).
    2. Il sistema normalizza i valori (trim degli spazi, ecc.) e aggiorna lo stato dei filtri “correnti”.
    3. Poiché i valori correnti differiscono dall’ultimo set di filtri applicato, il pulsante **Apply** si abilita.
    4. L’utente clicca su **Apply**.
    5. Il componente:
        - aggiorna lo snapshot dei filtri applicati con i valori correnti;
        - resetta la paginazione alla prima pagina (page 0, `offset=0`);
        - invia una richiesta di listing al backend includendo solo i parametri filtro non vuoti.
    6. La DataGrid mostra lo spinner interno di caricamento mentre attende la risposta.
    7. Il backend restituisce la pagina filtrata di risultati.
    8. La DataGrid viene aggiornata con le nuove righe.
    9. Una snackbar informa l’utente che i filtri sono stati applicati correttamente.
        
- **Estensioni / varianti**
    - 3a. L’utente modifica i valori dei filtri ma poi li rimette esattamente come erano quando erano stati applicati l’ultima volta  
        → Il pulsante **Apply** rimane disabilitato, evitando chiamate ridondanti.
    - 5a. I filtri specificati non restituiscono alcuna richiesta  
        → Si applica UC-DASH-HTTP-06 (assenza risultati).
    - 5b. Si verifica un errore nel caricamento filtrato  
        → Si applica UC-DASH-HTTP-05 (errore nel caricamento lista).

---

**UC-DASH-HTTP-04 – Reset dei filtri e ritorno alla lista non filtrata**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Rimuovere in un solo gesto tutti i filtri di ricerca e tornare alla lista “grezza” delle richieste HTTP, a partire dalla prima pagina.
    
- **Precondizioni**
    - La pagina “HTTP Requests” è aperta.
    - È presente almeno un filtro applicato in precedenza (anche se non necessariamente attualmente modificato dall’utente).
        
- **Postcondizioni**
    - Tutti i campi della toolbar filtri vengono riportati a valori vuoti / default (es. Method = All, gli altri campi stringa vuoti).
    - Lo snapshot di filtri applicati diventa “nessun filtro”.
    - La DataGrid viene ricaricata a partire dalla prima pagina senza alcun parametro di filtraggio.
        
- **Scenario principale**
    1. L’utente si trova con una lista filtrata (es. solo richieste GET verso un certo host).
    2. Nella toolbar vede il pulsante **Reset**.
    3. L’utente clicca su **Reset**.
    4. Il componente:
        - imposta tutti i campi della toolbar ai valori vuoti/default;
        - aggiorna i filtri applicati indicando che non ci sono più filtri attivi;
        - resetta la paginazione alla prima pagina (offset 0) con l’ultimo page size selezionato.
    5. Viene inviata una nuova richiesta di listing al backend senza parametri di filtro.
    6. La DataGrid mostra lo spinner interno e, al completamento, visualizza la lista non filtrata delle richieste HTTP.
        
- **Estensioni / varianti**
    - 1a. L’utente clicca su Reset pur non avendo filtri attivi  
        → La chiamata risultante equivale a un caricamento “grezzo” della prima pagina; la UI può mantenere comunque lo stato corrente se già coerente.

---

**UC-DASH-HTTP-05 – Gestione errore nel caricamento della lista di richieste HTTP**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Essere informato in modo chiaro quando la lista di richieste non può essere caricata (o ricaricata), senza bloccare definitivamente l’interfaccia.
    
- **Precondizioni**
    - L’utente ha innescato un caricamento della lista (apertura iniziale, cambio pagina, Apply filtri, Reset).
    - Si verifica un errore lato rete o lato backend nel servizio di listing.
        
- **Postcondizioni**
    - Lo stato `loading` viene riportato a `false`.
    - L’utente visualizza una snackbar con messaggio esplicito (es. “Error while executing the request.”).
    - Se esisteva un set precedente di righe valido, questo rimane visibile; altrimenti può comparire la griglia vuota con messaggio di assenza risultati (se coerente con lo stato).
        
- **Scenario principale**
    1. L’utente provoca il caricamento o ricaricamento della lista (es. clic su Apply o cambio pagina).
    2. Il componente invia la richiesta al backend e imposta `loading = true`.
    3. La chiamata restituisce un errore (es. timeout, HTTP 5xx, eccezione).
    4. Il componente intercetta l’errore, imposta `loading = false` e non sovrascrive eventuali righe esistenti con dati inconsistenti.
    5. Viene mostrata una snackbar non bloccante con un messaggio chiaro sull’errore.
    6. L’utente può eventualmente ritentare l’operazione (es. riapplicando filtri, cambiando pagina, ricaricando la vista).
        
- **Estensioni / varianti**
    - 4a. Non era presente alcun dato valido precedente (errore al primo caricamento in assoluto)  
        → La griglia può risultare vuota; l’utente vede comunque la struttura della tabella e può tentare nuove azioni (filtri, refresh globale, ecc.).

---

**UC-DASH-HTTP-06 – Visualizzazione dello stato “nessun risultato”**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Comprendere immediatamente quando, in base ai filtri e alla pagina corrente, non esistono richieste HTTP da mostrare.
    
- **Precondizioni**
    - È stata eseguita una chiamata di listing (iniziale o filtrata).
    - Il backend restituisce un array di richieste vuoto (`rows.length === 0`).
    
- **Postcondizioni**
    - L’area della griglia mostra un messaggio esplicito di assenza dati (es. “No requests to show.”).
    - L’utente può modificare filtri o parametri di paginazione e rilanciare la ricerca.
        
- **Scenario principale**
    1. L’utente applica una serie di filtri molto restrittivi (es. Method = POST, Authority = un host specifico, Path = un path raro).
    2. Viene inviata la richiesta al backend con tali filtri.
    3. Il backend risponde con zero risultati per la combinazione `offset/limit` e filtri specificati.
    4. La DataGrid non mostra righe, ma visualizza un messaggio centrato e leggibile che informa l’utente che non ci sono richieste da mostrare.
    5. L’utente può rimuovere o allentare i filtri, cambiare pagina o tornare alla lista “grezza” (vedi UC-DASH-HTTP-03 e UC-DASH-HTTP-04).
        
- **Estensioni / varianti**
    - 4a. L’utente ripete più volte ricerche senza risultati  
        → Il comportamento rimane coerente: messaggio “No requests to show.”, nessun errore fatale, possibilità di interazione continua.

---

**UC-DASH-HTTP-07 – Apertura e consultazione del dettaglio di una richiesta HTTP**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Ispezionare nel dettaglio una singola richiesta HTTP e la relativa risposta, comprensiva di URI, headers, body e metadati, tramite un drawer laterale.
    
- **Precondizioni**
    - La pagina “HTTP Requests” è aperta e la DataGrid mostra almeno una riga.
    - La riga corrisponde a una richiesta per cui è possibile recuperare i dettagli completi dal backend.
    
- **Postcondizioni**
    - Viene aperto un drawer laterale a destra con titolo “Request details – Id: …” (o equivalente).
    - Il drawer mostra in header:
        - un chip con il metodo HTTP;
        - un chip con lo status (con codifica colore per 2xx/3xx/4xx/5xx);
        - la URL canonica con pulsante “Copy URL”;
        - una riga di metadati (Graph, Connection authority).
    - Nelle sezioni interne l’utente può consultare:
        - dettagli di Request (URI, query params, request headers),
        - dettagli di Response (status, response headers, body + “Copy body”).
    - In caso di errore nel recupero del dettaglio, il drawer viene chiuso e viene mostrata una snackbar di errore.
        
- **Scenario principale**
    1. L’utente identifica una riga di interesse nella lista (es. una richiesta con status 500 verso un endpoint critico).
    2. Nella colonna “Actions” della riga, l’utente clicca sull’icona “View details” (occhio).
    3. Il componente apre un drawer laterale e, contestualmente, invia una richiesta `getHttpRequestById(id)` al backend.
    4. Finché il dettaglio è in caricamento, il drawer mostra uno spinner centrale.
    5. Alla risposta del backend, il drawer:
        - aggiorna l’header con:
            - chip Method (es. GET),    
            - chip Status (es. “500 Internal Server Error” con colore coerente),    
            - URL completa (`uri.full`) con pulsante “Copy URL”,  
            - metadati su Graph e Connection authority;
        - mostra la sezione **Request** con:
            - Method, Scheme, Authority, Path, Query string grezza;
            - eventuali query params (nome = valore);
            - request headers formattati come elenco `nome: valore`;
        - mostra la sezione **Response** con:
            - status HTTP completo;
            - response headers;
            - body in un riquadro scrollabile, con pulsante “Copy body” attivo solo se il body esiste.
    6. L’utente può scorrere verticalmente il contenuto del drawer per leggere l’intero body o tutti gli headers.
    7. Cliccando sull’icona di chiusura (X) o sul backdrop, il drawer viene chiuso e la lista rimane visibile nello stato precedente.
        
- **Estensioni / varianti**
    - 3a. Il backend restituisce un errore durante `getHttpRequestById(id)`  
        → Il componente mostra una snackbar del tipo “Error during retrieving request.”, azzera gli eventuali dati parziali e chiude il drawer per evitare uno stato incoerente.
    - 5a. La richiesta non ha query params  
        → La sezione specifica per i query params non viene mostrata.
    - 5b. Non sono presenti request o response headers  
        → Nelle rispettive sezioni appare un messaggio esplicito “No headers”.
    - 5c. Il body della risposta non è presente  
        → Nel riquadro viene mostrato “No body” e il pulsante “Copy body” risulta disabilitato.
    - 5d. Il valore dello status HTTP è fuori dalle classi canoniche (non 2xx, 3xx, 4xx, 5xx)  
        → Il chip utilizza lo stile “default”, mantenendo comunque leggibile il codice.

---