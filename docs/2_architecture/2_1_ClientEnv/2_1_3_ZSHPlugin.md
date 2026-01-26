# ZSH Plugin

---
## Panoramica

Il **Plugin ZSH** è il componente client di OntoWeb-PT dedicato alla **cattura offline del traffico** tramite linea di comando.
A differenza di **Extension** e **Dashboard**, il plugin non interagisce con l’Engine/Tool via REST/WebSocket: la sua integrazione avviene **tramite artefatti su filesystem** (PCAP + TLS key log + metadati), successivamente importati dalla dashboard con il wizard **Send PCAP**.

---
## Ruolo nell’Ambiente Client

Nel contesto dell’[Ambiente Client](../2_1_ClientEnv.md), il plugin copre scenari in cui il penetration tester:
- desidera una cattura **dataset-scoped** (una sessione = un dataset), più semplice da archiviare e confrontare;
- vuole produrre evidenza da **riprodurre** o **automatizzare** (workflow terminal-first);
- preferisce separare la cattura dal browser (riducendo dipendenze dalla logica dell’estensione).

Il plugin completa quindi il triangolo client:
- **Extension**: osservazione in-browser (DOM/HTML/Techstack + traffico HTTP intercettato dal browser);
- **Dashboard**: import guidato e consultazione dei risultati nel knowledge graph;
- **ZSH Plugin**: preparazione degli **artefatti di cattura** per l’import offline.

---
## Responsabilità chiave

1. **Session orchestration**
   - inizializza una directory di sessione (naming deterministico, tipicamente timestamp-based);
   - gestisce avvio/stop e chiusura “pulita” della cattura;
   - produce metadati minimi per tracciabilità.

2. **Network capture**
   - orchestralizza tool di sistema (es. `tcpdump` o equivalenti) per generare **PCAP/PCAPNG**;
   - mantiene la cattura come componente esterno: il plugin governa parametri, output e ciclo di vita.
   
3. **TLS key logging (opzionale)**
   - supporta la produzione di un **TLS key log** associato alla sessione, utile al backend per decifrare HTTPS/HTTP2 in fase di parsing;
   - se il key log non è disponibile, l’import resta possibile ma può risultare parziale (solo traffico decodificabile senza decrittazione).
   
4. **Artifact handoff**
   - produce una directory “pronta per l’import” selezionabile dall’utente e caricabile nella dashboard.
---

  

## Artefatti prodotti

Una capture session produce una directory che contiene gli output minimi necessari per l’import.

Struttura tipica:
```text

session_<timestamp>/

  traffic.pcap        # oppure .pcapng

  sslkeys.log         # oppure .txt (opzionale)

  session-metadata.json

```

I **metadati di sessione** hanno lo scopo di preservare contesto e tracciabilità (ad es. timestamp di start/end, note dell’operatore, interfaccia/contesto di cattura, eventuale label del dataset). A livello architetturale, i metadati non sono “necessari” per il parsing PCAP, ma risultano utili per rendere il dataset riproducibile e confrontabile.

---
## Componenti architetturali

Il plugin è un orchestration layer “thin” che coordina tool esterni e filesystem.
### Shell layer (ZSH)

- Espone comandi di alto livello per **attivare** e **terminare** la cattura.
- Centralizza configurazione e default (es. directory base delle sessioni, naming, logging a console).
### Capture layer (tool di sistema)

- Esegue la cattura a basso livello e produce il PCAP.
- È trattato come dipendenza esterna: il plugin ne gestisce lifecycle e output.
### TLS keys layer (sorgente chiavi)

- Produce il file di key log associato alla sessione (quando abilitato).
- Dal punto di vista del sistema, è un artefatto indispensabile per la decodifica del traffico cifrato durante il parsing (tshark).
### Filesystem boundary

Il filesystem è il contratto di integrazione:
- **producer**: ZSH Plugin (scrittura artefatti);
- **consumer**: Dashboard (upload) → Engine/Tool (parsing) → ingest pipeline.
---
## Flussi dati principali (overview)

### PCAP capture → Dashboard import → Engine parsing

![2_1_3_ZSH_PLUGIN](../../../images/2_architecture/2_1_ClientEnv/2_1_3_ZSH_Plugin.png)


Dal punto di vista del plugin, l’integrazione con OntoWeb-PT si ferma al livello di **artefatti pronti**.

Il parsing del PCAP, l’estrazione delle HTTP request e l’inserimento nel knowledge graph sono responsabilità della pipeline Dashboard→API→Worker.

---

## Assunzioni e vincoli

- **Ambiente ZSH**: si assume che l’operatore utilizzi ZSH e possa attivare il plugin nel proprio ambiente.
- **Tool di cattura e privilegi**: la cattura richiede strumenti di sistema e privilegi/capability adeguati per sniffare traffico.
- **Spazio disco**: PCAP e key log possono crescere rapidamente; la directory di sessione deve risiedere su uno storage adeguato.
- **Sensibilità dei dati**: i PCAP possono includere credenziali, token e dati personali; la gestione degli artefatti resta responsabilità dell’operatore.
- **Key log opzionale**: se il TLS key log non è disponibile, l’import può risultare parziale (HTTPS/HTTP2 non decodificato).

---
## Motivazioni di design

- **Separazione delle responsabilità**: il plugin è un *producer* di evidenza; normalizzazione, persistenza e finding generation sono nel backend.
- **Riproducibilità**: la session directory e i metadati facilitano dataset confrontabili e re-importabili.
- **Basso accoppiamento**: nessuna dipendenza diretta dall’Engine (handoff via filesystem), utile anche in contesti offline.
- **Interoperabilità**: PCAP + TLS key log sono formati standard e compatibili con la pipeline di parsing del Tool.
---