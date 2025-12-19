# Architettura (grey-box)
---

- [Client Environment](./2_1_ClientEnv.md)
- [Engine/Tool](./2_2_Engine_Tool.md)

---

In questa sezione si descrive come OntoWeb-PT è strutturato internamente e come i diversi componenti cooperano per supportare il penetration tester nelle attività di analisi.

Dopo la vista black-box fornita nell’[Overview](../1_Overview.md), questa sezione adotta una prospettiva grey-box: esplicita la suddivisione in sottosistemi, le loro responsabilità principali e le modalità con cui si scambiano dati e comandi.

L’architettura è organizzata in due macro-aree:
- **Client Environment**, che raccoglie tutti i componenti eseguiti nel contesto dell’utente (estensione browser, dashboard web, plugin zsh) e descrive come questi producono, consumano e inviano informazioni all’Engine.
- **Engine/Tool**, che rappresenta il backend containerizzato del sistema e include lo strato applicativo Node.js, i servizi di infrastruttura (Redis, GraphDB, Nginx) e il flusso di elaborazione asincrona.

All’interno dell’Engine, il **Node.js Environment** viene descritto come sottosistema logico che raggruppa l’API server e il worker asincrono, evidenziando come condividano il modello dati, le code e l’accesso al knowledge graph pur ricoprendo ruoli diversi.

Per ogni componente che compare nelle sottosezioni architetturali, la documentazione seguirà uno schema uniforme, focalizzato su cinque aspetti:

- **Responsabilità**  
  Cosa deve fare il componente dal punto di vista del sistema: quali problemi risolve, quali dati gestisce, quali parti del flusso di penetration testing copre.

- **Tecnologie usate**  
  Stack tecnologico essenziale (linguaggi, framework, servizi di infrastruttura) necessario a comprendere le capacità e i vincoli del componente.

- **Interfacce esposte**  
  Modalità con cui il componente comunica con l’esterno: endpoint, protocolli, eventi, formati dei messaggi e principali contratti di interazione con altri elementi dell’architettura.

- **Flussi dati interni**  
  Come i dati vengono ricevuti, trasformati e inoltrati all’interno del componente: passaggi principali, uso di code o canali asincroni, relazione tra input, stato interno ed output.

Per i nodi che rappresentano **raggruppamenti logici** (come *Client Environment*, *Engine/Tool* e *Node.js Environment*), la descrizione si concentrerà sul ruolo complessivo del gruppo, sulle relazioni tra i componenti interni e sui flussi trasversali che li attraversano, lasciando alle sottosezioni il dettaglio dei singoli elementi.

---
