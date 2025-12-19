# Dashboard → Backend Flows
---

- [PCAP Upload and Analysis Flow](./5_3_Dashboard_Flows/5_3_1_PCAP_Upload_Flow.md)
- [Findings Exploration Flow](./5_3_Dashboard_Flows/5_3_2_Findings_Exploration_Flow.md)
- [Tool Status & Health Flow](./5_3_Dashboard_Flows/5_3_3_Tool_Status_Flow.md)

---

Questa sezione descrive i **flussi end-to-end avviati dal Dashboard**, analizzando come un’azione dell’utente nell’interfaccia web attraversi l’intero sistema fino ai servizi backend e ritorni sotto forma di risultati, eventi o aggiornamenti di stato.

Rispetto ai flussi originati dall’estensione, quelli del dashboard si distinguono perché:
- includono sia operazioni **data-ingestion** (es. upload PCAP) sia operazioni **read-heavy** (esplorazione risultati);
- rappresentano spesso il punto di convergenza dei dati prodotti da più sorgenti (Extension, PCAP, Worker);
- richiedono un feedback chiaro sullo stato del sistema (health, readiness, job state) per garantire usabilità e operatività.

---

## Inquadramento nella Flow Taxonomy

I flussi descritti in questa sezione coprono tutte le categorie definite nella _Flow Taxonomy_:
- **Asynchronous Flows (Queue + Worker)**  
    per il parsing/processing di input pesanti (PCAP) e l’esecuzione di job lunghi;
- **Synchronous Flows (REST)**  
    per interrogazioni read-only su GraphDB (findings, correlazioni, filtri) e per richieste di controllo (tool status);
- **Streaming Flows (WebSocket)**  
    per log, job events e osservabilità mentre il backend elabora o mentre il dashboard monitora lo stato.

I pattern architetturali più ricorrenti sono:

- ingestion asincrona:

```
Client (Dashboard) 	
	→ Nginx 		
		→ API Server 			
			→ Redis Queue 				
				→ Worker 					
					→ GraphDB 				
				→ API / WebSocket 					
					→ Dashboard
```

- query sincrone read-heavy:

```
Client (Dashboard) 	
	→ Nginx 		
		→ API Server 			
			→ GraphDB (read) 		
		← API Server 	
	← Client
```

---

## Confini e responsabilità

Nei flussi avviati dal dashboard, i layer mantengono responsabilità nette:

- **Client Action**  
    Il dashboard avvia operazioni (upload, query, status) e gestisce la presentazione dei risultati. Non esegue analisi complesse: delega al backend.
- **Ingress Layer**  
    Nginx e API Server gestiscono routing, validazione, limiti (es. upload), normalizzazione delle richieste e orchestrazione verso queue/GraphDB.
- **Processing Layer**  
    Redis e Worker eseguono processing asincrono quando richiesto (PCAP parsing, enrichment, scritture massicce).
- **Persistence Layer**  
    GraphDB è la fonte persistente dei dati interrogabili (HTTP requests, findings, correlazioni). Redis conserva stato temporaneo (queue, job state).
- **Feedback Channel**  
    REST fornisce risposte immediate e fetch dei risultati; WebSocket fornisce streaming di log e job events, essenziale per operazioni lunghe e monitoraggio.

---

## Struttura dei flussi descritti

I flussi originati dal dashboard sono suddivisi in tre macro-categorie, ciascuna trattata in un file dedicato.

### PCAP Upload and Analysis Flow

Questo flusso descrive l’upload di un file **PCAP** e la sua trasformazione in dati strutturati interrogabili.

Caratteristiche principali:
- ingestion di un asset potenzialmente grande e costoso da processare;
- utilizzo del layer Nginx anche come punto di buffering/handling upload;
- parsing lato API tramite **script Python / tshark** e successiva pipeline asincrona (queue+worker);
- persistenza in GraphDB di richieste/risposte e (se applicabile) finding derivati.

Il file dedicato analizza il flusso seguendo i layer:
- File upload;
- Nginx buffering;
- API → Python script;
- Job enqueue;
- Worker execution;
- GraphDB persistence;
- Findings visualization.

---

### Findings Exploration Flow

Questo flusso descrive l’esplorazione e consultazione dei risultati dal dashboard.

Caratteristiche principali:
- flusso **prevalentemente sincrono (REST)** e **read-heavy**;
- interrogazioni su GraphDB con filtri e paginazione;
- correlazioni semantiche (resolver, severity, vulnerability, HTTP/HTML context);
- nessun job di processing nella maggior parte dei casi (focus su query e aggregazioni).

Il file dedicato copre:
- REST queries;
- Filtering & pagination;
- Correlations;
- Read-only GraphDB access.

---

### Tool Status & Health Flow

Questo flusso descrive come il dashboard ottenga una vista unificata sullo **stato operativo del tool**.

Caratteristiche principali:
- richiesta sincrona al backend per stato/health;
- aggregazione di segnali da componenti eterogenei:
    - Redis health (connessione + ping);
    - GraphDB probe (endpoint / repository readiness);
    - Worker heartbeat / capacità di processing;
    - eventuali segnali WebSocket (logs live).

Il file dedicato analizza:
- Status request;
- Redis health;
- GraphDB probe;
- Worker heartbeat;
- WebSocket logs.

---