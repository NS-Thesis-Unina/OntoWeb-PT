# Dettagli implementativi
---

- [Repository Build Process](./4_1_Repository_Build_Process.md)
- [Client Environment](./4_2_ClientEnv.md)
- [Engine/Tool](./4_3_Engine_Tool.md)
- [Ontology](./4_4_Ontology.md)

---

La seguente sezione ha l’obiettivo di fornire una descrizione **white-box** del sistema OntoWeb-PT, cioè una vista interna orientata all’implementazione.

A differenza delle altre sezioni di architettura e dei flussi operativi (che descrivono _componenti_ e _comportamenti_ in modo più generale), qui ci si concentra su:

- come è organizzato il codice (struttura dei moduli e responsabilità);
- quali sono gli entrypoint e i collegamenti tra componenti;
- quali scelte implementative hanno guidato il funzionamento (gestione dello stato, integrazione con servizi, logging, configurazione).

Lo scopo non è “rispiegare” l’architettura, ma **spiegare come l’architettura si traduce in implementazione**, evidenziando i punti in cui esiste logica sviluppata ad hoc e i punti in cui ci si appoggia a servizi esterni.

---

## Cosa è “custom” vs “third-party”

Nel contesto di questa sezione, è utile distinguere chiaramente tra due categorie di elementi:

- **Custom (implementazione sviluppata nel progetto)**  
    Include tutto ciò che è stato progettato e scritto ad hoc: componenti UI, logica applicativa, moduli di elaborazione, servizi di integrazione, gestione job, pipeline di ingestione/analisi, mapping verso ontologia, ecc.  
    In questa parte la documentazione entra nel dettaglio: struttura del codice, responsabilità dei moduli, flussi interni e scelte implementative.
    
- **Third-party (componenti esterni utilizzati come servizio/container)**  
    Include componenti usati principalmente “as-is” tramite Docker (o dipendenze di runtime), per i quali non esiste codice applicativo scritto nel progetto ma solo **configurazione** e **integrazione**.  
    In questi casi la documentazione si concentra su:
    - ruolo nel sistema;
    - parametri/config forniti dal progetto;
    - porte/volumi/networking;
    - modalità con cui il codice custom li utilizza (contratto e dipendenze).

---

## Mappa rapida: “dove sta cosa” (repo + servizi + entrypoint)

Viene fornito un orientamento rapido su **dove si trovano i pezzi principali** e quali sono i rispettivi punti di ingresso.

- **Client**
    - **Dashboard (web app)**: codice nel relativo package/cartella client; entrypoint tipico: bootstrap dell’app React (router + layout).
    - **Extension (browser popup)**: codice nel package/cartella dell’estensione; entrypoint tipico: mount dell’app popup + router interno.
    - **ZSH Plugin**: script/plugin lato terminale; entrypoint tipico: file del plugin o comando principale invocato dalla shell.
    
- **Engine/Tool**
    - **node-api (REST API)**: servizio applicativo; entrypoint tipico: file di avvio server (Express bootstrap).
    - **node-worker (async jobs)**: processo worker; entrypoint tipico: bootstrap code che registra le queue e i consumer.
        
- **Servizi containerizzati**
    - **Nginx**: reverse proxy; “entrypoint” logico = file di configurazione montato e regole di routing.
    - **Redis**: backend per code/cache; usato dal codice custom come dipendenza, senza logica interna nel progetto.
    - **GraphDB**: triple store; “entrypoint” logico = repository configurata + endpoint SPARQL utilizzati dal tool.

Ogni sezione riprenderà questa mappa e la approfondirà con il livello di dettaglio appropriato (white-box per i moduli custom, integrazione/config per i servizi third-party).

---