# Obiettivo
---

L’obiettivo del sistema OntoWeb-PT è supportare il penetration tester nell’analisi delle vulnerabilità di applicazioni web, fornendo un unico punto di raccolta, normalizzazione e correlazione delle evidenze raccolte durante le attività di test.

In particolare, il sistema si propone di:

- **Acquisire dati eterogenei** (tecnologie utilizzate, security headers, cookie, WAF, HTML/JavaScript, traffico HTTP/HTTPS) da diverse sorgenti operative:
  - estensione browser (moduli *Techstack*, *Analyzer*, *Interceptor*),
  - plugin da linea di comando (plugin zsh con cattura PCAP).

- **Normalizzare e strutturare le informazioni raccolte** all’interno di un *knowledge graph* basato su ontologia, così da rappresentare in modo coerente:
  - richieste e risposte HTTP,
  - componenti HTML e script,
  - tecnologie e software rilevati,
  - vulnerabilità e finding associati.

- **Automatizzare l’individuazione di potenziali vulnerabilità** tramite resolver basati su regole statiche (techstack, analyzer, HTTP), riducendo il lavoro manuale ripetitivo del penetration tester e rendendo più omogenea la qualità delle analisi.

- **Consentire la consultazione e la correlazione delle evidenze** tramite una dashboard web centralizzata, che permetta di:
  - esplorare richieste HTTP e relativi dettagli,
  - visualizzare e filtrare i finding per sorgente e tipologia,
  - monitorare lo stato dei componenti del sistema (api server, GraphDB, Redis, websocket) e dei job in esecuzione.

- **Favorire analisi ripetibili e tracciabili**, mantenendo uno storico delle scansioni eseguite (sia lato estensione sia lato backend) e rendendo possibile il riutilizzo delle informazioni in fasi successive del ciclo di test o in campagne di verifica successive.

OntoWeb-PT non sostituisce il penetration tester, ma fornisce un’infrastruttura unificata per **raccogliere, organizzare e analizzare** in modo sistematico le evidenze tecniche, migliorando l’efficacia e la ripetibilità delle attività di web penetration testing.

---

# Cosa fa il sistema
---
Il sistema fornisce tre macro-funzionalità principali:

1. **Raccolta strutturata di evidenze di sicurezza**
   - Tramite **estensione browser**, il sistema acquisisce:
     - informazioni sul **tech stack** dell’applicazione (tecnologie, WAF, cookie, security headers),
     - struttura **HTML** e **script** della pagina (analisi puntuale “one time” o continua “runtime” durante la navigazione),
     - **traffico HTTP/HTTPS** generato dall’utente durante la sessione (Interceptor).
     - consultare uno **storico locale** delle scansioni (via `localStorage`).
     - inviare i risultati delle scansioni all’ontologia.
   
   - Tramite **plugin zsh**, il sistema consente di:
     - catturare il traffico di un’intera sessione all’interno di un **namespace temporaneo**,
     - salvare il traffico in un file `.pcap` e le chiavi TLS in un file di log, per analisi successive.

1. **Normalizzazione, analisi e correlazione**
   - I dati raccolti (HTML, richieste HTTP, tech stack, cookie, headers, ecc.) vengono:
     - inviati a un **backend centralizzato** (Engine/Tool),
     - elaborati da **resolver** specializzati (Analyzer, Techstack, HTTP) basati su regole statiche,
     - arricchiti, quando pertinente, con **informazioni su CPE/CVE** tramite interrogazione di fonti esterne (NVD),
     - **modellati in SPARQL** e inseriti all’interno di un **knowledge graph** ospitato in GraphDB, secondo l’ontologia OntoWeb-PT.
   - In questo modo:
     - ogni finding di sicurezza viene collegato a richieste, risposte, header, cookie, HTML, URI, tecnologie, ecc.,
     - diventa possibile effettuare query e correlazioni avanzate sulle evidenze raccolte.

1. **Visualizzazione, consultazione e monitoraggio**
   - Una **dashboard web**, servita dal backend, permette di:
     - esplorare le **richieste HTTP** salvate (con relativi dettagli tecnici),
     - consultare i **finding** suddivisi per sorgente (Analyzer, Techstack, HTTP),
     - monitorare lo **stato dei componenti** (API, worker, Redis, GraphDB, WebSocket),
     - visualizzare **log** e stato dei job in esecuzione.
     - estrapolare le richieste http dal file `.pcap`, generato dal plugin zsh, ed inviarle all'ontologia e opzionalmente eseguire il resolver per analizzare le richieste.

---

# Untilizzatori e modalità di utilizzo
---

Il sistema è pensato principalmente per:

- **Penetration tester** e security engineer che:
  - svolgono attività di **web application penetration testing**,
  - hanno bisogno di raccogliere in modo strutturato:
    - traffico HTTP/HTTPS,
    - caratteristiche del tech stack,
    - struttura delle pagine HTML e degli script,
    - potenziali vulnerabilità rilevate automaticamente.
  - vogliono **ridurre attività ripetitive** (identificazione manuale di header insicuri, cookie mal configurati, pattern di vulnerabilità noti, ecc.) delegandole ai resolver automatici.

- **Ricercatori e studenti** nell’ambito della sicurezza applicativa che:
  - desiderano **sperimentare su dataset di traffico reale**,
  - analizzare vulnerabilità attraverso un **modello ontologico**,
  - effettuare query SPARQL per studi su:
    - correlazioni tra tech stack e vulnerabilità,
    - pattern ricorrenti nel traffico,
    - distribuzione delle categorie OWASP/CWE/CVE.

In pratica, OntoWeb-PT viene utilizzato come:
- **strumento operativo di supporto** durante una sessione di test (estensione + plugin zsh),
- **motore centralizzato di analisi e knowledge graph** (Engine/Tool + GraphDB),
- **interfaccia di consultazione e reporting tecnico** (dashboard web).

---

# Descrizione dei componenti (black-box)
---

![ComponentDiagram](../images/1_overview/ComponentDiagram_Overview.png)

- **Estensione browser (Techstack / Analyzer / Interceptor)**  
  Componente lato client usato dal penetration tester durante la navigazione.
  - Raccoglie informazioni su tech stack, HTML/script e traffico HTTP.
  - Permette scansioni *one time* e *runtime*.
  - Può inviare i risultati all’Engine e consultare uno storico locale (localStorage).

- **Plugin zsh**  
  Strumento da linea di comando che:
  - esegue la navigazione all’in
  - cattura il traffico in un file `.pcap` e le chiavi TLS in un log,

- **Dashboard web (frontend React)**  
  Interfaccia web utilizzata dal penetration tester per:
  - esplorare richieste HTTP normalizzate,
  - consultare i finding (Analyzer, Techstack, HTTP),
  - monitorare lo stato dei servizi e delle code,
  - visualizzare log e risultati dei job in tempo quasi reale.
  - invia file .pcap e TLS Keys all’Engine per l’estrazione delle richieste HTTP/HTTP2 e le inserisce nell'ontologia.

- **Nginx (reverse proxy)**  
  Punto di ingresso unico al sistema:
  - espone le API pubbliche dell’Engine,
  - inoltra il traffico verso `node-api`,
  - gestisce healthcheck e routing verso la dashboard e i WebSocket.

- **node-api (API server + dashboard serving)**  
  Componente applicativo che:
  - espone le API REST (router: Techstack, Analyzer, HttpRequests, Pcap, Sparql),
  - accetta i dati provenienti da estensione e plugin zsh,
  - pubblica eventi via WebSocket (log, stato job, notifiche verso estensione/dashboard),
  - serve il bundle statico della dashboard React.

- **node-worker (Job worker / resolver)**  
  Componente dedicato all’elaborazione asincrona:
  - consuma job dalle code BullMQ su Redis,
  - esegue i resolver (Analyzer, Techstack, HTTP) basati su regole statiche,
  - arricchisce i dati (es. CPE/CVE da NVD per techstack),
  - scrive risultati e finding nel knowledge graph (GraphDB).

- **Redis (code di job)**  
  Infrastruttura di messaging per:
  - accodare job asincroni (analisi techstack, analyzer, HTTP, import PCAP),
  - permettere la cooperazione tra `node-api` (producer) e `node-worker` (consumer).

- **GraphDB (knowledge graph OntoWeb-PT)**  
  Database RDF che ospita:
  - ontologia OntoWeb-PT,
  - richieste/risposte HTTP, header, cookie, HTML, URI,
  - finding e vulnerabilità (CVE, CWE, categorie OWASP, ecc.).  
    È interrogato via SPARQL da API e worker per lettura/scrittura.

- **graphdb-init (bootstrap ontologia)**  
  Container di inizializzazione che, all’avvio dello stack:
  - verifica l’esistenza della repository `ontowebpt`,
  - la crea se assente,
  - importa l’ontologia RDF di OntoWeb-PT se non già presente.

---