# OpenAPI – Sequence Diagrams
---

**SD-DASH-OAPI-01 – Apertura pagina API Explorer e caricamento dello schema OpenAPI**

![SD-DASH-OAPI-01](../../../images/3_main_operational_flows/3_2_Dashboard/3_2_3_SD/3_2_3_6_OpenApi/SD-DASH-OAPI-01.png)

**Descrizione (alto livello):**

Questo diagramma mostra il flusso quando l’utente accede alla pagina **API Explorer**: il router monta il componente, che inizializza lo stato, mostra uno spinner di caricamento e importa dinamicamente `openapi.json`. Se il caricamento ha successo, viene aggiornato lo stato, si costruiscono i gruppi di endpoint e vengono mostrati titolo, descrizione e lista di tag; in caso di errore lo schema resta `null` e la pagina continua a mostrare solo lo stato di loading (o un eventuale fallback).

---

**SD-DASH-OAPI-02 – Costruzione della lista di endpoint e raggruppamento per tag**

![SD-DASH-OAPI-02](../../../images/3_main_operational_flows/3_2_Dashboard/3_2_3_SD/3_2_3_6_OpenApi/SD-DASH-OAPI-02.png)

**Descrizione (alto livello):**

Questo diagramma illustra come, una volta caricato lo schema, la pagina costruisce la lista di endpoint a partire da `schema.paths`: per ogni path vengono considerati solo i metodi HTTP validi, si effettua il merge dei parametri di path e di operazione (con precedenza a quelli di operazione) e si determina il **tag** principale. Gli endpoint vengono quindi raggruppati per tag e salvati nello stato, così che l’utente veda sezioni logiche (HTTP Requests, Findings, SPARQL, ecc.) con una lista di Accordion per ogni endpoint.

---

**SD-DASH-OAPI-03 – Espansione di un Accordion e visualizzazione descrizione + parametri**

![SD-DASH-OAPI-03](../../../images/3_main_operational_flows/3_2_Dashboard/3_2_3_SD/3_2_3_6_OpenApi/SD-DASH-OAPI-03.png)

**Descrizione (alto livello):**

Questo diagramma mostra cosa succede quando l’utente espande un endpoint: l’Accordion recupera dal componente principale descrizione e parametri, raggruppa i parametri per posizione (query, path, header, cookie, other) e costruisce la sezione **Description** più la sezione **Parameters** (se ci sono effettivamente parametri). L’utente vede così, in un’unica vista, la descrizione estesa e l’elenco dei parametri con obbligatorietà, tipo e breve spiegazione.

---

**SD-DASH-OAPI-04 – Tipizzazione dei parametri con schemi dereferenziati**

![SD-DASH-OAPI-04](../../../images/3_main_operational_flows/3_2_Dashboard/3_2_3_SD/3_2_3_6_OpenApi/SD-DASH-OAPI-04.png)

**Descrizione (alto livello):**

Questo diagramma dettaglia come viene calcolato il tipo umano-leggibile di ogni parametro: il renderer dei parametri chiede al **TypeResolver** il tipo, che recupera lo schema appropriato (da `param.schema` o da `param.content["application/json"].schema`), dereferenzia eventuali `$ref` locali usando il **DerefEngine**, e applica le regole di tipizzazione (array, tipo esplicito, enum, fallback object/any). Il risultato è una stringa sintetica (`string`, `array<string>`, `enum`, `object`, `any`) utilizzata nella sezione **Parameters**.

---

**SD-DASH-OAPI-05 – Visualizzazione del Request Body dell’endpoint**

![SD-DASH-OAPI-05](../../../images/3_main_operational_flows/3_2_Dashboard/3_2_3_SD/3_2_3_6_OpenApi/SD-DASH-OAPI-05.png)

**Descrizione (alto livello):**

Questo diagramma descrive come viene costruita la sezione **Request Body**: se l’endpoint prevede un corpo di richiesta, il renderer seleziona il content-type più rilevante (priorità `application/json`, poi `multipart/form-data`, poi `application/x-www-form-urlencoded`, altrimenti il primo disponibile con schema), dereferenzia lo schema, lo serializza come JSON formattato e lo mostra in un blocco `<pre>` scrollabile. Se non esiste alcuno schema utile, la sezione “Request Body” non viene mostrata.

---

**SD-DASH-OAPI-06 – Visualizzazione delle Responses Body per codice di stato**

![SD-DASH-OAPI-06](../../../images/3_main_operational_flows/3_2_Dashboard/3_2_3_SD/3_2_3_6_OpenApi/SD-DASH-OAPI-06.png)

**Descrizione (alto livello):**

Questo diagramma mostra come viene costruita la sezione **Responses Body**: per ogni codice di stato definito nello schema OpenAPI si preleva la descrizione e, se presente, lo schema `application/json`, che viene dereferenziato tramite il motore `$ref`. Si costruisce un unico oggetto JSON indicizzato per status code, che l’utente vede in un blocco `<pre>`, potendo così comprendere le forme delle risposte previste per successi ed errori.

---

**SD-DASH-OAPI-07 – Utilizzo della sezione API Explorer in sola lettura**

![SD-DASH-OAPI-07](../../../images/3_main_operational_flows/3_2_Dashboard/3_2_3_SD/3_2_3_6_OpenApi/SD-DASH-OAPI-07.png)

**Descrizione (alto livello):**

Questo diagramma riassume il comportamento di **sola lettura** dell’API Explorer: l’unico “caricamento” è l’import locale di `openapi.json`; tutte le successive interazioni (espansione/chiusura degli Accordion, consultazione di parametri, request body e responses) avvengono in memoria, senza invocare realmente gli endpoint documentati. L’utente usa quindi la pagina come documentazione interattiva, senza generare traffico verso le API oltre al caricamento iniziale dello schema.

---