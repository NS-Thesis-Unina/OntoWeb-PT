# Estensione – Flussi operativi principali

---

- [Functional Requirements](./3_1_Extension/3_1_1_FR.md)

- [Use Cases](./3_1_Extension/3_1_2_UC.md)

- [Sequence Diagrams](./3_1_Extension/3_1_3_SD.md)

---

La sezione “Extension” raccoglie tutti i flussi operativi principali della componente estensione del browser (popup). È il punto di raccordo tra ciò che l’utente può fare dall’interfaccia dell’estensione e il comportamento atteso dal sistema, visto sia in termini di requisiti, sia di scenari d’uso, sia di dinamiche temporali (sequence diagrams).

L’obiettivo di questa sezione è:

- descrivere in modo coerente cosa l’estensione deve fare (Functional Requirements);

- mostrare come l’utente interagisce con queste funzionalità in scenari concreti (Use Cases);

- rappresentare le principali interazioni temporali tra UI, servizi interni e backend (Sequence Diagrams).

Tutte le informazioni sono organizzate lungo le quattro aree funzionali chiave dell’estensione: Global, Technology Stack, Analyzer, Interceptor.

1. Functional Requirements 
   Il blocco “Functional Requirements” definisce cosa deve fare l’estensione dal punto di vista funzionale, senza entrare nei dettagli di implementazione.

2. Use Cases
   Il blocco “Use Cases” traduce i requisiti funzionali in scenari narrativi centrati sull’utente (tipicamente il penetration tester). Ogni caso d’uso descrive:
   
   - attore principale;
   
   - obiettivo (cosa vuole ottenere l’utente);
   
   - precondizioni;
   
   - flusso principale di interazione;
   
   - postcondizioni;
   
   - varianti ed estensioni rilevanti.

3. Sequence Diagrams
   Il blocco “Sequence Diagrams” fornisce una vista dinamica dei flussi principali, tramite diagrammi di sequenza (in notazione Mermaid) accompagnati da una descrizione testuale ad alto livello. L’obiettivo è mostrare:
   
   - come interagiscono nel tempo la UI della popup, i controller interni dell’estensione, lo storage locale, i servizi di lock e lo strato backend (Tool/Engine);
   
   - quali sono i passaggi chiave nell’avvio di una scansione, nel caricamento di archivi e risultati, nell’esecuzione di wizard di analisi/invio verso l’ontologia;
   
   - come vengono gestiti stati di errore, blocchi da lock globale e notifiche all’utente.

---