# Client Environment
---

- [Dashboard](./4_2_ClientEnv/4_2_1_Dashboard.md)
- [Extension](./4_2_ClientEnv/4_2_2_Extension.md)
- [ZSH Plugin](./4_2_ClientEnv/4_2_3_ZSHPlugin.md)

---

La sezione **Client Environment** raccoglie i dettagli implementativi delle componenti lato utente di OntoWeb-PT: web dashboard, estensione browser e plugin ZSH. L’attenzione resta su aspetti **white-box**, quindi su come il comportamento osservabile si traduce in codice, pattern applicativi e integrazioni concrete.

Il taglio è intenzionalmente pratico: routing, gestione dello stato, chiamate REST, uso dei WebSocket, componenti UI riutilizzabili e convenzioni uniformi (loading, empty state, error state). In parallelo, viene chiarito il contratto di integrazione verso l’Engine/Tool: quali endpoint vengono invocati, come vengono composte le URL, quali variabili d’ambiente guidano il collegamento e come vengono gestite condizioni di degrado.

---

## Cosa viene coperto

- **Routing e struttura delle viste**  
    Organizzazione delle pagine (o route) e regole di navigazione, inclusi layout condivisi e sotto-navigazioni contestuali.
- **Gestione dello stato e pattern applicativi**  
    Scelte di implementazione su state management (hook, context, servizi dedicati), modellazione dello stato “remoto” (liste, dettagli, job, log) e sincronizzazione con la UI.
- **Integrazione REST**  
    Strato di client HTTP, costruzione delle request, normalizzazione delle risposte, gestione errori e comportamento in caso di fallimenti (fallback, preservazione dell’ultimo dato valido, notifiche).
- **Integrazione WebSocket**  
    Connessione socket.io, namespace/eventi rilevanti, lifecycle (connect/disconnect/reconnect) e propagazione dello stato verso i componenti che consumano stream (job updates, log real-time).
- **Componenti e convenzioni UI trasversali**  
    Elementi riusati (layout, drawer di dettaglio, datagrid, snackbar/notification center) e linee guida di rendering coerente (spinner, backdrop, messaggi “no data”, error non bloccanti).

---

## Struttura della sezione

1. **Dashboard**  
    Focus su struttura delle pagine, routing, componenti core riutilizzati, integrazione con REST e WebSocket, e convenzioni UI applicate in modo uniforme tra liste, dettagli e wizard.
2. **Extension**  
    Focus su architettura della popup, routing interno, storage per-tab e persistenza del contesto, lock service, moduli Analyzer/Interceptor/Techstack e modalità di integrazione con il Tool (REST/WS) inclusa la gestione dello “Tool status”.
3. **ZSH Plugin**  
    Focus su entrypoint, comandi supportati, configurazione, formato dell’output e modalità di interazione con il backend quando presente (oppure flusso locale quando applicabile).

---