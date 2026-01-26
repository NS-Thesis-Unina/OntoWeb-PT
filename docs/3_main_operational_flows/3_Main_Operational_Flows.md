# Main Operational Flows
---

- [Extension](./3_1_Extension.md)
- [Dashboard](./3_2_Dashboard.md)

---

La sezione della documentazione “Main Operational Flows” descrive il modo in cui il sistema viene effettivamente usato dal penetration tester nelle attività di tutti i giorni. Se nella sezione di Architettura abbiamo descritto i componenti e le loro responsabilità a livello strutturale (che cosa esiste e come è collegato), qui ci concentriamo invece sul comportamento: quali funzioni sono offerte, come vengono attivate, quali passi compie l’utente e quali scambi avvengono tra client ed engine lungo il flusso operativo.

Il focus è volutamente “dal punto di vista dell’utente”: non entriamo nei dettagli implementativi di singole funzioni interne, ma descriviamo cosa può fare il penetration tester con i tre elementi dell’ambiente client (Estensione browser, Dashboard) e come questi strumenti orchestrano le interazioni con l’engine (analisi, code di job, knowledge graph) durante una sessione di lavoro reale.

Per ogni macro-componente client (Extension, Dashboard) la documentazione segue sempre la stessa struttura in tre livelli complementari:

- i Functional Requirements (FR), che elencano in modo sistematico le funzionalità offerte e i vincoli di comportamento attesi;

- gli Use Cases (UC), che raccontano scenari d’uso concreti, passo-passo, dal punto di vista del penetration tester;

- i Sequence Diagrams (SD), che traducono quegli scenari in sequenze di messaggi tra attori (utente, client, engine) per chiarire tempi e direzioni delle interazioni.

Nel caso dell’Estensione e della Dashboard, i FR, gli UC e i diagrammi di sequenza sono ulteriormente suddivisi per ambito funzionale (Global, Techstack, Analyzer, Interceptor per l’estensione; Global, Http Requests, Findings, Send PCAP, Tool Status, OpenAPI per la dashboard). Questa suddivisione permette di isolare i flussi principali di ogni “modulo” funzionale, mantenendo leggibile la descrizione e facilitando il collegamento con i requisiti di sicurezza e gli obiettivi di test.

---
