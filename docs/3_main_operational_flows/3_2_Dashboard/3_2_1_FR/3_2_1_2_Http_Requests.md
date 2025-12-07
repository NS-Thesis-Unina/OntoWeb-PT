# Http Requests - Requisiti Funzionali
---

**FR-DASH-HTTP-01 – Vista paginata delle richieste HTTP dall’ontologia**

La sezione “Http Requests” deve mostrare all’utente una lista tabellare di tutte le richieste HTTP che sono state ingerite e normalizzate nell’ontologia (GraphDB).  

Requisiti:
- la lista deve essere paginata lato server (server-side pagination), passando a backend `offset` e `limit`;
- il numero di elementi per pagina deve essere configurabile dall’utente tra almeno i valori 25, 50 e 100, con default 100 alla prima apertura;
- per ogni riga devono essere visualizzate almeno le seguenti informazioni sintetiche:
    - Method (verbo HTTP);
    - Status (codice di risposta HTTP, se presente);
    - URL canonica (campo `uri.full`);
    - Authority (prioritariamente `connection.authority`, in alternativa `uri.authority`);
    - Graph (identificativo del grafo / contesto di ingestione).

L’utente deve poter scorrere le pagine mantenendo costanti i filtri correnti.

---

**FR-DASH-HTTP-02 – Gestione dello stato di caricamento (initial load vs reload)**

All’apertura iniziale della pagina “Http Requests”:
- deve essere avviato automaticamente un caricamento della prima pagina (offset 0, limit 100);
- mentre il primo caricamento è in corso e non sono ancora disponibili righe, va mostrato un Backdrop bloccante con spinner centrale, in modo da evitare la visualizzazione di una tabella vuota “fittizia”.

Per i caricamenti successivi (paginazione o applicazione filtri):
- la tabella deve rimanere visibile;
- lo stato di caricamento deve essere indicato dal solo spinner integrato nella griglia, senza bloccare l’intera pagina.

---

**FR-DASH-HTTP-03 – Filtri di ricerca per metodo, schema, authority, path e full-text**

L’utente deve poter restringere il set di richieste visualizzate tramite una toolbar di filtri, con i seguenti campi:

- **Method**: select che permette di scegliere tra i metodi standard (GET, POST, PUT, DELETE, HEAD, OPTIONS, PATCH) più l’opzione “All” (nessun filtro su method);
- **Scheme**: campo di testo (es. `https`);
- **Authority**: campo di testo per dominio/host (es. `www.example.com`);
- **Path**: campo di testo per path (es. `/index.html`);
- **Full-text**: campo di testo che abilita una ricerca full-text lato server su dati di richiesta/risposta (URL, headers, body indicizzati, ecc.).

Ogni valore deve essere normalizzato (trim degli spazi iniziali/finali) e solo i campi non vuoti devono essere effettivamente inviati come parametri di query al backend, così da non influenzare la ricerca quando lasciati in bianco.

---

**FR-DASH-HTTP-04 – Toolbar filtri controllata con Apply/Reset e “change detection”**

La toolbar dei filtri deve essere “controllata” e avere la seguente logica:
- i campi visualizzati sono sempre coerenti con lo stato dei filtri attuali del componente padre;
- il pulsante **Apply** deve essere abilitato solo quando i valori correnti differiscono dall’ultimo set di filtri applicato (rilevato tramite confronto normalizzato), in modo da evitare richieste ridondanti;
- al click su **Apply**:
    - i filtri correnti devono essere considerati come “applied”;
    - deve essere eseguita una nuova chiamata di listing a partire dalla prima pagina (offset 0), con i filtri correnti;
    - al termine del caricamento andato a buon fine, deve comparire una snackbar di conferma (es. “I filtri sono stati applicati correttamente.”);
- il pulsante **Reset** deve:
    - riportare tutti i campi filtro a valori vuoti;
    - aggiornare lo snapshot dei filtri applicati di conseguenza;
    - rilanciare il caricamento dalla prima pagina senza alcun filtro (ricerca “grezza”).

---

**FR-DASH-HTTP-05 – Gestione errori nel caricamento della lista**

In caso di errore durante la chiamata al servizio di listing delle richieste HTTP:
- deve essere mostrata una notifica non bloccante (snackbar) con messaggio esplicito (es. “Error while executing the request.”);
- lo stato `loading` deve essere correttamente ripristinato a `false` al termine del tentativo, in ogni caso;
- la tabella deve continuare a mostrare l’ultimo set di righe valido (se presente), senza andare in errore fatale o lasciare la UI in uno stato incoerente.
    

---

**FR-DASH-HTTP-06 – Messaggio in assenza di risultati**

Quando, a seguito di una ricerca (sia iniziale sia filtrata), non viene restituita alcuna riga:
- l’area della griglia deve mostrare un messaggio chiaro, centrato, che indichi l’assenza di dati (es. “No requests to show.”);
- l’utente deve poter modificare filtri o paginazione e rilanciare la ricerca senza ostacoli.

---

**FR-DASH-HTTP-07 – Apertura dettaglio richiesta tramite drawer laterale**

Per ogni riga della tabella deve essere disponibile un’azione esplicita “View details” (icona occhio):

- al click, deve aprirsi un drawer ancorato a destra, con titolo “Request details” (completo di Id quando disponibile);
- l’apertura del drawer deve innescare una chiamata al backend `getHttpRequestById(id)` per recuperare il dettaglio completo di quella richiesta/risposta;
- mentre i dettagli sono in caricamento, il drawer deve mostrare uno spinner centrale;
- in caso di errore nel recupero, deve essere mostrata una snackbar (es. “Error during retrieving request.”) e il drawer deve chiudersi, evitando di lasciare contenuti parziali.

Il click sulle righe della tabella non deve selezionare né aprire dettagli; l’unico entry point al dettaglio è l’icona azione.

---

**FR-DASH-HTTP-08 – Contenuto del dettaglio: intestazione e metadati**

Nella parte alta del drawer devono essere sempre visibili:
- un chip con il **metodo HTTP** della richiesta;
- un chip con lo **status** HTTP (eventualmente arricchito da `reason`, es. “200 OK”) e colore dipendente dalla classe di codice (2xx, 3xx, 4xx, 5xx);
- la **URL canonica** (`uri.full`) della richiesta, mostrata per esteso con eventuale troncamento solo visivo, e un pulsante “Copy URL” per copiarla in clipboard;
- una riga di metadati che indichi almeno:
    - Graph: identificativo del grafo / contesto (`request.graph`);
    - Connection: authority della connessione (`request.connection.authority`), o “—” se assente.

Questi elementi fungono da riepilogo veloce della richiesta selezionata.

---

**FR-DASH-HTTP-09 – Sezione Request (URI, query params, headers)**

Nella sezione “Request” del drawer, l’utente deve poter vedere, in forma strutturata:
- i campi principali della URI:
    - Method (di nuovo, per comodità);
    - Scheme (`uri.scheme`);
    - Authority (`uri.authority`);
    - Path (`uri.path`);
    - Query string grezza (`uri.queryRaw`);
- eventuali **query parameters** parsati (`uri.params`), elencati come coppie `name = value`;
- l’elenco dei **request headers**, mostrati come lista verticale `nome: valore`.

Requisiti aggiuntivi:
- se non sono presenti query params, il blocco dedicato non deve essere mostrato;
- se non sono presenti headers, deve comparire un testo esplicito (es. “No headers”).

---

**FR-DASH-HTTP-10 – Sezione Response (status, headers, body)**

Nella sezione “Response” del drawer, l’utente deve poter esaminare:

- lo **status HTTP** (codice e, se disponibile, reason phrase es. “404 Not Found”);
- l’elenco dei **response headers** con la stessa resa della sezione Request (“nome: valore”);
- il **body** della risposta:
    - il body deve essere mostrato così come salvato (ad es. Base64), all’interno di un riquadro scrollabile;  
    - se il body non è presente, deve essere indicato chiaramente (es. “No body”);  
    - deve essere disponibile un’azione “Copy body” che copi il contenuto del body in clipboard;
    - il pulsante “Copy body” deve risultare disabilitato quando il body non è presente.

In questo modo il penetration tester può recuperare rapidamente il payload esatto restituito dal server.

---

**FR-DASH-HTTP-11 – Codifica visiva dello stato HTTP**

Il sistema deve utilizzare una codifica visiva coerente per lo status HTTP sia nella colonna della tabella che nel dettaglio:
- 2xx → stato “success” (esito positivo);
- 3xx → stato “info” (redirezioni);
- 4xx → stato “warning” (errori lato client);
- 5xx → stato “error” (errori lato server);
- altri codici → stato “default”.

Questa codifica deve essere resa tramite chip colorati, così che l’utente possa distinguere al volo l’esito delle richieste nella lista e nel dettaglio.

---

**FR-DASH-HTTP-12 – Interazione tra filtri, paginazione e richieste al backend**

Il comportamento combinato di filtri e paginazione deve essere il seguente:
- la paginazione (cambio pagina o page size) deve sempre mantenere i filtri correnti, limitandosi ad aggiornare `offset` e `limit` nella chiamata al backend;
- l’applicazione dei filtri (pulsante Apply) deve:
    - resettare il paging alla prima pagina (offset 0);
        
    - aggiornare `limit` usando l’ultimo page size selezionato;
- il reset dei filtri deve anch’esso riportare la lista alla prima pagina non filtrata;
- il componente deve mantenere allineati:
    - lo stato interno dei filtri (per la toolbar),
    - lo stato della paginazione (metadati `page` restituiti dal server),
    - e i parametri effettivamente usati nell’ultima chiamata (`params`).

In questo modo l’utente percepisce una UI coerente dove i risultati, la pagina mostrata e i filtri attivi sono sempre sincronizzati con lo stato reale delle query al backend.

---