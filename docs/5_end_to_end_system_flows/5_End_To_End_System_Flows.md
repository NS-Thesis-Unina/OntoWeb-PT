# End-to-End System Flows
---

 - [Flow Taxonomy](./5_1_Flow_Taxonomy.md)
 - [Extension Flows](./5_2_Extension_Flows.md)
 - [Dashboard Flows](./5_3_Dashboard_Flows.md)

---

Questa sezione descrive i **flussi operativi system-wide** che attraversano l’intero ecosistema della piattaforma, partendo da un’azione dell’utente e propagandosi attraverso **tutti i livelli architetturali**, dal client fino ai servizi backend e ai layer di persistenza.
SI ha come obiettivo quello di fornire una **visione end-to-end**, focalizzata su **come i componenti collaborano tra loro** per realizzare un flusso completo.

---

## Obiettivo della sezione

La sezione _End-to-End System Flows_ documenta:

- come un’azione dell’utente:
    - dall’**Extension**,
    - dal **Dashboard**,
    attraversa l’intero sistema fino a produrre:
    - elaborazioni asincrone,
    - persistenza dei risultati,
    - feedback verso il client;

- come i flussi attraversano i principali layer infrastrutturali:
    - **Ingress Layer** (Nginx),
    - **API Layer** (API Server),
    - **Processing Layer** (Queue + Worker),
    - **Persistence Layer** (GraphDB, Redis),
    - **Feedback Channels** (REST, WebSocket);
- quali sono i **confini di responsabilità** tra i componenti e i punti di integrazione espliciti tra client, backend e servizi containerizzati.

---

## Ambito e livello di astrazione

Questa sezione **non** descrive:
- dettagli di UX o di interazione utente (già trattati nella Sezione 3);
- implementazioni interne di singoli moduli, resolver o servizi (già trattati nella Sezione 4);
- strutture dati o query specifiche di basso livello.

La descrizione dei flussi è volutamente mantenuta a un **livello architetturale e operativo**, concentrandosi su:
- **sequenza logica dei passaggi**;
- **componenti coinvolti**;
- **tipologia di comunicazione** (sincrona, asincrona, streaming);
- **effetti persistenti** prodotti dal flusso;
- **meccanismi di feedback verso il client**.

---

## Tipologia di flussi descritti

All’interno di questa sezione vengono documentati:
- flussi **iniziati dal Browser Extension**, che includono:
    - cattura del contesto,
    - invio dati verso il backend,
    - analisi asincrona tramite job e resolver;
- flussi **iniziati dal Dashboard**, tipicamente orientati a:
    - importazione di dati,
    - interrogazione e correlazione dei risultati,
    - monitoraggio dello stato del sistema;
- flussi **read-heavy**, che non generano job ma interrogano GraphDB;
- flussi **long-running**, che coinvolgono code, worker e aggiornamenti progressivi.

Ogni flusso è descritto come un’unità coerente, ma utilizzando convenzioni comuni per evitare ridondanze.

---