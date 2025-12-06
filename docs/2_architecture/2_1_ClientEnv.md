# Ambiente Client

---

1. [Extension](./2_1_ClientEnv/2_1_1_Extension.md)

2. [Dashboard](./2_1_ClientEnv/2_1_2_Dashboard.md)

3. [ZSH Plugin](./2_1_ClientEnv/2_1_1_Extension.md)

---

![ComponentDiagram](../images/2_architecture/ComponentDiagram_ClientEnv.png)

---

L’ambiente client raggruppa tutti i componenti che vivono nel contesto dell’utente e che interagiscono, in modo diretto o indiretto, con l’Engine/Tool. Dal punto di vista architetturale rappresenta il “punto di ingresso” delle evidenze raccolte durante il penetration test e offre all’utente sia gli strumenti per generare i dati, sia le interfacce per consultarli una volta normalizzati e arricchiti dal backend.

All’interno dell’ambiente client sono presenti tre elementi principali: l’estensione browser, la dashboard web e il plugin zsh. Pur avendo ruoli diversi, questi componenti sono progettati per coprire fasi complementari dello stesso flusso di lavoro: raccolta delle informazioni durante la navigazione, import e normalizzazione del traffico, visualizzazione e analisi dei risultati.

---

## Estensione

L’estensione browser è lo strumento utilizzato dal penetration tester direttamente all’interno del browser mentre visita l’applicazione target. È organizzata in tre sezioni funzionali (Techstack, Analyzer, Interceptor) che permettono di raccogliere informazioni sullo stack tecnologico, sull’HTML e sugli script della pagina, e sul traffico HTTP generato durante la navigazione. L’estensione può operare sia in modalità “one shot” su una singola pagina, sia in modalità “runtime” su più pagine successive, e mette a disposizione funzioni per inviare i risultati verso l’Engine e per consultare uno storico locale delle scansioni mantenuto nel browser.

---

## Dashboard

La dashboard web è l’interfaccia centralizzata attraverso cui il penetration tester esplora i dati che sono stati acquisiti, normalizzati e memorizzati nell’ontologia. Viene servita come applicazione frontend React dal server Node.js e consente di visualizzare le richieste HTTP salvate, i finding prodotti dai diversi resolver (Analyzer, Techstack, HTTP), oltre allo stato operativo dei servizi di backend (API, worker, Redis, GraphDB). La dashboard funge anche da punto di integrazione per il traffico catturato offline: permette infatti di caricare file `.pcap` e TLS keys generati esternamente e di inviarli all’Engine per l’estrazione delle richieste HTTP/HTTP2 e il loro inserimento nel knowledge graph.

---

## Plugin ZSH

Il plugin zsh completa l’ambiente client sul lato linea di comando. È pensato per scenari in cui il penetration tester desidera isolare e catturare il traffico di una sessione di test all’interno di un namespace temporaneo, ad esempio per riprodurre o automatizzare determinati percorsi applicativi. Il plugin si occupa di avviare la sessione, catturare il traffico in un file `.pcap`, salvare le chiavi TLS in un file di log e produrre altri artefatti utili all’analisi successiva. L’integrazione con il resto del sistema avviene tramite i file generati: sarà poi la dashboard, tramite le API dell’Engine, a importare questi dati e a renderli disponibili per la consultazione e la correlazione con le altre evidenze.

---
