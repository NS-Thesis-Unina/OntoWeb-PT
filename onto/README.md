# OntoWeb-PT Ontology

Questa cartella contiene l’**ontologia OWL/RDF di OntoWeb-PT**, utilizzata come **modello semantico centrale** per rappresentare, correlare e interrogare i dati prodotti dall’engine di analisi.

L’ontologia costituisce il fondamento concettuale dell’intera piattaforma: tutte le analisi (HTTP, Techstack, Analyzer, PCAP) persistono i risultati in **GraphDB** seguendo le classi e le relazioni definite in questo modello.

---

## Ontologia attuale

L’**ultima versione stabile** dell’ontologia è:

`ontowebpt_1.0.3.rdf`

Questa versione è:
- caricata automaticamente in GraphDB all’avvio del sistema (tramite `graphdb-init`);
- utilizzata da **API, Worker e Resolver** per la persistenza RDF;
- allineata con i flussi descritti nella documentazione End-to-End.

---

## Struttura della cartella

```
onto/
├── ontowebpt_1.0.3.rdf # Ontologia OWL/RDF attuale
├── old/ # Versioni precedenti dell’ontologia
│ ├── ontowebpt_1.0.0.rdf
│ ├── ontowebpt_1.0.1.rdf
│ └── ...
└── README.md
```

La cartella `old/` contiene **versioni storiche** mantenute a scopo di:
- tracciabilità evolutiva,
- confronto semantico,
- riproducibilità di esperimenti passati.

---

## Ambito semantico

L’ontologia OntoWeb-PT modella i seguenti domini principali:

### HTTP & Network Traffic
- richieste HTTP (`Request`)
- risposte HTTP (`Response`)
- URI, path, query e parametri
- header HTTP
- correlazioni request ↔ response

### Findings & Security Analysis
- findings di sicurezza
- categorie (es. OWASP)
- severità
- evidenze
- remediation
- correlazione finding ↔ contesto

### Resolver & Analysis Context
- resolver instance (Techstack, Analyzer, HttpResolver)
- collegamento finding ↔ resolver
- metadati di analisi
- contesto di origine (estensione, dashboard, PCAP)

### Techstack & Software
- tecnologie web rilevate
- software e versioni
- mapping verso CVE/CPE (quando disponibile)
- relazione tecnologia ↔ dominio

---

## Integrazione con il backend

L’ontologia è utilizzata in modo **operativo** dal backend:

- **GraphDB**:
  - repository RDF dedicato (`ontowebpt`);
  - persistenza tramite named graph (HTTP, findings, ecc.).

- **Worker & Resolver**:
  - ogni job produce entità RDF coerenti con l’ontologia;
  - linking semantico tra risultati eterogenei.

- **Dashboard**:
  - interrogazioni SPARQL per esplorare dati e correlazioni;
  - navigazione basata sulle relazioni ontologiche.

---

## Named graphs (concetto)

Sebbene l’ontologia definisca il **vocabolario**, i dati sono organizzati in GraphDB tramite **named graph**:

- HTTP Requests Graph
- Findings Graph

I rispettivi URI sono configurabili tramite environment variables del backend.

---

## Evoluzione dell’ontologia

L’ontologia è progettata per essere:

- **estensibile** (nuove classi/relazioni);
- **compatibile** con analisi future;
- **orientata alla correlazione semantica**.

Ogni nuova versione:
- incrementa il numero di versione (`ontowebpt_X.Y.Z.rdf`);
- viene mantenuta in `old/`;
- può richiedere l’aggiornamento dei resolver o delle query SPARQL.

---

## Note operative

- L’import dell’ontologia in GraphDB è **idempotente**:
  - se già presente, l’import viene saltato.
- La modifica dell’ontologia **richiede il riavvio** dei container GraphDB e dei worker.
- Per ambienti di sviluppo è possibile caricare manualmente versioni sperimentali.

---

## Collegamenti utili

- [Documentazione completa](../docs/README.md)
- [Deployment & GraphDB bootstrap](../docs/6_deployment/6_Deployment.md)
- [Worker & Resolver](../docs/4_implementation_details/4_3_Engine_Tool.md)

---

## Autori

Ontologia OntoWeb-PT sviluppata da:

- Francesco Scognamiglio  
- Felice Micillo
