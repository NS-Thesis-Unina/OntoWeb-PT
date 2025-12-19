# Tool Status
---

La pagina **Tool Status** fornisce una panoramica operativa in tempo reale sul backend di OntoWeb-PT. La vista aggrega i risultati dei controlli di salute esposti via REST con lo stato di connettività WebSocket e una coda di log live, così da avere in un’unica schermata indicazioni rapide su disponibilità e diagnosi.

---

## Ruolo e responsabilità

Tool Status copre tre obiettivi principali:
- **Consolidare lo stato complessivo della piattaforma** (tool acceso / in verifica / spento) tramite `deriveToolStatus(health)`.
- **Visualizzare lo stato dei singoli sottosistemi** (API Server, Redis, GraphDB, WebSocket) con card dedicate.
- **Mostrare un flusso di log in tempo reale**, utile per seguire job e attività del backend senza uscire dalla dashboard.

---

## Integrazione REST e modello dati

La pagina interroga periodicamente l’endpoint di health check tramite:
- `getHealth()` → recupera il payload con `components: { server, redis, graphdb }`
- `deriveToolStatus(health)` → calcola la label di stato: `tool_on | checking | tool_off`

La logica è incapsulata in uno `useEffect` che:
- effettua una chiamata iniziale al mount;
- ripete la richiesta ogni **5 secondi** (polling);
- in caso di errore o API non raggiungibile, forza `toolStatus = 'tool_off'` e `health = null`.

Lo stato applicativo principale è gestito con:

- `health` (payload REST, oppure `null`)
- `toolStatus` (badge riassuntivo)
- `wsStatus` (connettività socket root)
- `logs` (buffer circolare di eventi log)

---

## Integrazione WebSocket

Sono aperte **due connessioni socket.io** distinte:

1. **Root namespace**  
    Usato esclusivamente per tracciare la connettività del canale (`connected | disconnected`) e aggiornare `wsStatus`.
    
2. **Namespace `/logs`**  
    Riceve eventi `log` e alimenta un buffer in memoria:
    
    - la lista mantiene solo gli ultimi ~**80** elementi (`prev.slice(-80)`), per evitare crescita illimitata e mantenere fluida la UI;
    - ogni entry include campi strutturati (timestamp, livello, namespace, messaggio).

Le connessioni vengono chiuse correttamente al cleanup degli `useEffect`, evitando leak in navigazione tra route.

---

## Composizione UI

La schermata è organizzata in tre blocchi coerenti:

1. **Main status card**  
    Card prominente che mostra `Tool Status: <toolStatus>` con:
    - sfondo a gradiente diverso a seconda dello stato (`--on`, `--checking`, `--off`);
    - `LinearProgress` colorata (success/warning/error);
    - timestamp locale “Ultimo aggiornamento” calcolato lato client.

2. **Component status grid**  
    Una `Grid` MUI con quattro `StatusCard`:
    - API Server (da `health.components.server`)
    - Redis (da `health.components.redis`)
    - GraphDB (da `health.components.graphdb`)
    - WebSocket (da `wsStatus`)
        
3. **Real-Time Logs**  
    Card con pannello scrollabile (`max-height: 250px`) che renderizza il tail dei log in stile monospace.

---

## Componenti chiave

### StatusCard

`StatusCard` standardizza la rappresentazione dello stato di un sottosistema:
- intestazione con nome componente + indicatore circolare;
- testo di stato normalizzato (fallback conservativo su `down` se valore assente);
- mapping diretto stato → colore con classi CSS:
    - verde (`up`, `connected`)
    - giallo (`connecting`)
    - rosso (`down`, `disconnected`)
- animazione “pulse” per rendere immediata la scansione visiva (keyframes separati per verde/giallo/rosso).

---

## Convenzioni UX applicate

- **Segnalazione immediata dello stato globale**: card principale ben visibile, con colore e progress bar coerenti.
- **Diagnostica incrementale**: prima si guarda lo stato complessivo, poi si scende nel dettaglio per componente.
- **Log tailing in dashboard**: un buffer limitato evita rumore e problemi prestazionali, mantenendo utilità operativa.
- **Color semantics coerenti**: success/warning/error applicati sia a progress che a indicatori e livello log.

---

## Layout e responsività

- `max-width: 1200px` e `margin: 0 auto` mantengono la pagina centrata e leggibile.
- La griglia componenti usa breakpoint MUI (`xs=12`, `md=6`) per passare da una colonna su mobile a due colonne su viewport più ampie.
- Il pannello log è scrollabile e separato dal resto per non “spingere” la pagina in altezza in presenza di molti eventi.

---

## Stato e side effects

Tool Status introduce side effect controllati e coerenti con la funzione di monitoraggio:
- **Polling REST** ogni 5s con fallback su `tool_off` quando l’API non risponde.
- **Connessione WebSocket root** per stato trasporto (`wsStatus`).
- **Connessione WebSocket `/logs`** per flusso log live con buffer limitato.
- **Cleanup esplicito** di interval e socket su unmount, per evitare listener duplicati e consumo risorse.

---