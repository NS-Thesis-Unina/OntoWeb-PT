# Dashboard – Flussi operativi principali
---

- [Functional Requirements](./3_2_Dashboard/3_2_1_FR.md)
- [Use Cases](./3_2_Dashboard/3_2_2_UC.md)
- [Sequence Diagrams](./3_2_Dashboard/3_2_3_SD.md)

---

La sezione “Dashboard” raccoglie tutti i flussi operativi principali dell’interfaccia web di OntoWeb-PT.  
È il punto di raccordo tra ciò che l’utente può fare dalla web-app (home, listing, wizard, pannelli di stato, documentazione API) e il comportamento atteso dal sistema, visto sia in termini di requisiti, sia di scenari d’uso, sia di dinamiche temporali (sequence diagrams).

L’obiettivo di questa sezione è:
- descrivere in modo coerente cosa la dashboard deve fare (Functional Requirements);
- mostrare come l’utente interagisce con queste funzionalità in scenari concreti (Use Cases);
- rappresentare le principali interazioni temporali tra UI, servizi interni e backend (Sequence Diagrams).

Tutte le informazioni sono organizzate lungo le aree funzionali chiave della dashboard: **Global**, **HTTP Requests**, **Findings**, **Send PCAP**, **Tool Status**, **OpenAPI**.

---

1. **Functional Requirements**  
    Il blocco “Functional Requirements” definisce cosa deve fare la dashboard dal punto di vista funzionale, senza entrare nei dettagli di implementazione.  
    Per ciascuna area (Global, HTTP Requests, Findings, Send PCAP, Tool Status, OpenAPI) vengono elencati i comportamenti attesi della UI, le interazioni con i servizi backend, le regole di validazione e i vincoli di robustezza.
2. **Use Cases**  
    Il blocco “Use Cases” traduce i requisiti funzionali in scenari narrativi centrati sull’utente (tipicamente il penetration tester / analista). Ogni caso d’uso descrive:
    - attore principale;
    - obiettivo (cosa vuole ottenere l’utente);
    - precondizioni;
    - flusso principale di interazione;
    - postcondizioni;
    - varianti ed estensioni rilevanti.
    In questo modo si chiarisce “come” la dashboard viene utilizzata nella pratica, collegando le varie pagine e funzioni (liste, dettagli, wizard, pannelli di stato) ai bisogni concreti di chi usa lo strumento.
    
3. **Sequence Diagrams**  
    Il blocco “Sequence Diagrams” fornisce una vista dinamica dei flussi principali, tramite diagrammi di sequenza (in notazione Mermaid) accompagnati da una descrizione testuale ad alto livello.  
    L’obiettivo è mostrare:
    - come interagiscono nel tempo la UI della dashboard, i servizi interni di stato e routing, e il backend OntoWeb-PT;
    - quali sono i passaggi chiave nelle operazioni di caricamento liste, apertura dettagli, esecuzione di wizard (es. Send PCAP), monitoraggio del tool e dei job, esplorazione dello schema OpenAPI;
    - come vengono gestiti stati di errore, condizioni di degrado controllato e notifiche non bloccanti all’utente.
    
---