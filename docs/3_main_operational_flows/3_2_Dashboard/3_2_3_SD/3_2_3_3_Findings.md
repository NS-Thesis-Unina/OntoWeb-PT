# Findings – Sequence Diagrams
---

**SD-DASH-FIND-01 – Navigazione interna tra HTTP / Analyzer / Techstack Findings**

![SD-DASH-FIND-01](../../../images/3_main_operational_flows/3_2_Dashboard/3_2_3_SD/3_2_3_3_Findings/SD-DASH-FIND-01.png)

Descrizione (alto livello):

Questo diagramma mostra la sotto-navigazione contestuale della sezione Findings:
- Quando la route corrente inizia con `/findings`, l’AppBar visualizza tre pulsanti: **HTTP Findings**, **Analyzer Findings**, **Techstack Findings**.
- A seconda dell’URL (`/findings`, `/findings/analyzer`, `/findings/techstack`), il router renderizza la pagina specifica, mentre la sotto-nav evidenzia o disabilita il pulsante relativo.
- I passaggi tra le sottosezioni avvengono via router client-side, senza cambiare la shell globale della dashboard.
- Se l’utente clicca la tab già attiva, non avviene alcuna nuova navigazione.

---

**SD-DASH-FIND-02 – Caricamento iniziale lista HTTP Findings (default /findings)**

![SD-DASH-FIND-02](../../../images/3_main_operational_flows/3_2_Dashboard/3_2_3_SD/3_2_3_3_Findings/SD-DASH-FIND-02.png)

Descrizione (alto livello):

Questo diagramma descrive il primo caricamento della pagina **HTTP Findings**:
- All’apertura di `/findings` (default HTTP), la pagina inizializza lo stato, mostra una **Backdrop bloccante** e invia `listHttpFindings({ offset:0, limit:default })` al backend.
- Se la chiamata va a buon fine:
    - la Backdrop scompare;
    - se ci sono risultati, la DataGrid viene popolata con righe `{ id }` e il totale per la paginazione;
    - se non ci sono risultati, la griglia mostra il messaggio “No findings to show.”.
- In caso di errore, la Backdrop viene comunque rimossa, viene mostrata una snackbar di errore e la pagina resta utilizzabile (eventualmente con tabella vuota).

---

**SD-DASH-FIND-03 – Paginazione server-side uniforme per HTTP / Analyzer / Techstack Findings**

![SD-DASH-FIND-03](../../../images/3_main_operational_flows/3_2_Dashboard/3_2_3_SD/3_2_3_3_Findings/SD-DASH-FIND-03.png)

Descrizione (alto livello):

Questo diagramma mostra il comportamento comune della paginazione server-side per tutte le liste di Findings:
- Ogni DataGrid (HTTP, Analyzer, Techstack) usa `paginationMode="server"`: un cambio pagina o page size genera una callback `onPageChange`.
- La pagina calcola `offset` e `limit`, mantiene eventuali parametri interni e chiama il servizio corretto (`listHttpFindings`, `listAnalyzerFindings`, `listTechstackFindings`).
- Al ritorno, aggiorna righe, totale e metadati di paginazione; la DataGrid mostra uno spinner **integrato**, ma non blocca l’intera pagina.

---

**SD-DASH-FIND-04 – Gestione errori nel caricamento delle liste Findings**

![SD-DASH-FIND-04](../../../images/3_main_operational_flows/3_2_Dashboard/3_2_3_SD/3_2_3_3_Findings/SD-DASH-FIND-04.png)

Descrizione (alto livello):

Questo diagramma descrive la gestione degli errori di caricamento delle liste di Findings:
- Ogni azione che scatena un fetch (apertura pagina, cambio pagina, cambio page size) imposta `loading = true` e chiama il servizio di listing.
- In caso di errore, `loading` torna a `false` e viene mostrata una snackbar esplicita (“Error while loading HTTP findings.”, ecc.).
- Se erano già presenti righe valide, queste vengono preservate; se era il primo caricamento, la griglia può risultare vuota, con il messaggio “No findings to show.”.
- L’interfaccia rimane sempre utilizzabile e l’utente può riprovare in seguito.

---

**SD-DASH-FIND-05 – Apertura dettaglio Finding, caricamento drawer e azioni di copia**

![SD-DASH-FIND-05](../../../images/3_main_operational_flows/3_2_Dashboard/3_2_3_SD/3_2_3_3_Findings/SD-DASH-FIND-05.png)

Descrizione (alto livello):

Questo diagramma illustra il flusso completo di apertura e consultazione del dettaglio di un Finding:
- L’utente clicca l’azione **“View details”** su una riga della DataGrid; la pagina apre un **drawer laterale** e mostra uno spinner interno.
- In base al tipo di finding (HTTP, Analyzer, Techstack), viene chiamato il servizio appropriato (`getHttpFindingById`, `getAnalyzerFindingById`, `getTechstackFindingById`).
- Se la risposta ha successo:
    - il drawer mostra un header con regola, severità (chip colorato), descrizione e metadati;
    - la sezione “Finding” elenca i campi principali;
    - compaiono le sezioni specializzate: “HTTP summary”, “Context/HTML reference”, “Cookie/Header/Software evidence” a seconda del tipo;
    - l’utente può usare le azioni di copia (URL o `src`) che scrivono in clipboard senza bloccare la UI.
- In caso di errore, viene mostrata una snackbar (“Error while retrieving finding details.”), l’oggetto `finding` viene azzerato e il drawer si chiude automaticamente per evitare stati incoerenti.

---