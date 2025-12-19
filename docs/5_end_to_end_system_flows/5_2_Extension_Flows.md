# Extension → Backend Flows
---

- [Techstack Analysis Flow](./5_2_Extension_Flows/5_2_1_Techstack_Analysis_Flow.md)
- [Analyzer Scan Flow](./5_2_Extension_Flows/5_2_2_Analyzer_Scan_Flow.md)
- [HTTP Interception Flow](./5_2_Extension_Flows/5_2_3_HTTP_Interception_Flow.md)

---

Questa sezione descrive i **flussi end-to-end avviati dall’estensione browser**, analizzando come un’azione dell’utente nel popup attraversi l’intero sistema fino ai servizi backend e ritorni sotto forma di risultati, eventi o aggiornamenti di stato.

I flussi documentati in questa sezione rappresentano i casi più complessi e caratterizzanti del sistema, in quanto:
- originano in un **contesto client-side altamente dinamico** (browser);
- coinvolgono sia **ingestion continua** sia **analisi asincrone**;
- producono dati persistenti correlati semanticamente in GraphDB;
- richiedono **feedback progressivo** verso il client tramite WebSocket e REST.

---

## Inquadramento nella Flow Taxonomy

Tutti i flussi descritti in questa sezione combinano più categorie definite nella _Flow Taxonomy_:
- **Asynchronous Flows (Queue + Worker)**  
    per l’esecuzione delle analisi vere e proprie (Techstack, Analyzer, HTTP);
- **Streaming Flows (WebSocket)**  
    per il feedback operativo e lo stato di avanzamento;
- **Synchronous Flows (REST)**  
    per l’avvio delle operazioni e il recupero dei risultati.

Il pattern architetturale di riferimento è generalmente il seguente:

```
Client (Extension)   
	→ Nginx     
		→ API Server       
			→ Redis Queue         
				→ Worker           
					→ GraphDB         
				→ API / WebSocket           
					→ Extension / Dashboard
```

---

## Confini e responsabilità

All’interno dei flussi dell’estensione, i ruoli dei vari layer sono ben definiti:

- **Client Action**  
    L’estensione raccoglie dati dal contesto di navigazione (DOM, headers, traffico HTTP) e avvia le operazioni senza eseguire analisi pesanti localmente.
    
- **Ingress Layer**  
    L’API funge da punto di normalizzazione e controllo, trasformando i payload provenienti dal browser in job asincroni.
    
- **Processing Layer**  
    I worker eseguono le analisi utilizzando i resolver dedicati, isolando completamente il carico computazionale dal client.
    
- **Persistence Layer**  
    I risultati vengono salvati in GraphDB secondo l’ontologia, permettendo correlazioni tra richieste HTTP, HTML, vulnerabilità e resolver.
    
- **Feedback Channel**  
    Lo stato dei job e i risultati vengono comunicati all’estensione e al dashboard tramite WebSocket e REST.

---

## Struttura dei flussi descritti

I flussi originati dall’estensione sono suddivisi in tre macro-categorie, ciascuna trattata in un file dedicato.

### Techstack Analysis Flow

Questo flusso descrive l’analisi della **tecnologia e configurazione di sicurezza** del target.

Caratteristiche principali:
- flusso asincrono avviato esplicitamente dall’utente;
- analisi basata su header HTTP, cookie, software e WAF;
- produzione di _Techstack Findings_ e correlazioni con vulnerabilità note.

Il file dedicato analizza il flusso seguendo i layer:
- Trigger;
- Client-side preparation;
- Ingress;
- Job creation;
- Worker execution;
- Persistence;
- Feedback;
- Failure points & retries.

---

### Analyzer Scan Flow

Questo flusso descrive l’analisi **SAST-like** del contenuto HTML e JavaScript.

Caratteristiche principali:
- raccolta strutturata di DOM, script inline ed esterni;
- analisi asincrona tramite AnalyzerResolver;
- creazione di collegamenti semantici tra finding, HTML e URI.

Il flusso è particolarmente rilevante per:
- la complessità del payload client-side;
- la profondità delle correlazioni salvate in GraphDB;
- l’integrazione tra Extension e Dashboard per la visualizzazione.

---

### HTTP Interception Flow

Questo flusso descrive l’intercettazione **continua** del traffico HTTP dal browser.

Caratteristiche principali:
- flusso persistente e non puntuale;
- ingestione batch di richieste e risposte;
- analisi opzionale tramite HttpResolver;
- aggiornamenti live verso il dashboard.

È il flusso più vicino a una pipeline di ingestion real-time e costituisce la base per:
- analisi comportamentali;
- correlazione temporale delle richieste;
- individuazione di pattern di rischio nel traffico.

---