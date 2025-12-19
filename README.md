# OntoWeb-PT

**OntoWeb-PT** è una piattaforma per l’analisi del traffico web e delle applicazioni web che combina:
- analisi del traffico HTTP (live e da PCAP),
- analisi statica e tecnologica delle applicazioni web,
- persistenza semantica dei risultati tramite ontologia OWL/RDF,
- visualizzazione e controllo tramite Dashboard ed Estensione Browser.

L’obiettivo del progetto è fornire uno **strumento di analisi web security e traffic intelligence** basato su un **modello semantico condiviso**, capace di correlare richieste HTTP, tecnologie, findings e risultati di analisi in un’unica base dati interrogabile.

---

## High-level architecture

OntoWebPT è composto da più componenti integrati:

- **Engine / Tool (Backend)**
  - API REST + WebSocket
  - Job system asincrono con Redis + Worker
  - GraphDB per persistenza RDF
  - Nginx come reverse proxy

- **Dashboard Web**
  - Visualizzazione richieste HTTP
  - Esplorazione findings
  - Upload PCAP
  - Stato del sistema

- **Browser Extension**
  - Intercettazione traffico HTTP
  - Analisi Techstack
  - Analyzer scan
  - Integrazione live con il backend

- **Ontologia**
  - Modello OWL/RDF che descrive:
    - richieste e risposte HTTP
    - tecnologie
    - findings
    - relazioni semantiche tra entità

---

## Repository structure

```
├── README.md
├── docs/ # Documentazione completa (architettura, flussi, deployment)
├── engine/ # Backend Engine / Tool
│ ├── docker-compose.yml
│ ├── graphdb/ # Ontologia RDF + repository.ttl
│ ├── nginx/ # Nginx reverse proxy configuration
│ ├── nodejs/ # API Server + Worker
│ └── nodejs-dashboard/ # Dashboard frontend (Vite)
├── extension/ # Browser extension (Edge / Chrome / Firefox)
├── onto/ # Ontologia OWL/RDF
│ └── old/ # Versioni precedenti dell’ontologia
└── zsh-plugin/ # Plugin ZSH per integrazione CLI
```

---

## Documentation

La documentazione completa del progetto è disponibile nella cartella `docs/` ed è strutturata in modo modulare.

[Documentazione](./docs/README.md)

**Sezioni**:
- [**Index**](./docs/Index.md)
- [**Overview**](./docs//1_overview/1_Overview.md)
- [**Architecture**](./docs/2_architecture/2_Architecture.md)
- [**Main Operational Flows**](./docs/3_main_operational_flows/3_Main_Operational_Flows.md)
- [**Implementation Details**](./docs/4_implementation_details/4_Implementation_Details.md)
- [**End-to-End System Flows**](./docs/5_end_to_end_system_flows/5_End_To_End_System_Flows.md)
- [**Deployment & Setup**](./docs/6_deployment/6_Deployment.md)

---

## Quick start (TL;DR)

Per avviare l’intero backend (Engine + Dashboard + servizi):

```bash
cd engine
docker compose up -d
```

### Verifica:

- **API health**: http://localhost/health
- **GraphDB UI**: http://localhost:7200
- **Dashboard**: http://localhost/

Per configurazioni avanzate, environment variables e build frontend, fare riferimento alla sezione Deployment della documentazione.

---

## Submodules README

Ogni componente principale ha un README dedicato:

**Engine / Backend**:
- [engine/README.md](./engine/README.md)

**Browser Extension**:
- [extension/README.md](./extension/README.md)

**Ontology**:
- [onto/README.md](./onto/README.md)

**ZSH Plugin**:
- [zsh-plugin/README.md](./zsh-plugin/README.md)

**Documentation**:
- [docs/README.md](./docs/README.md)

---

## License & authorship

OntoWebPT è un progetto di ricerca/sviluppo.

Autori principali:
- Francesco Scognamiglio
- Felice Micillo

---