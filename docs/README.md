# OntoWeb-PT Documentation

Questa cartella contiene la **documentazione completa e strutturata** del progetto **OntoWeb-PT**.

La documentazione descrive:
- l’architettura del sistema,
- i flussi operativi principali,
- i dettagli di implementazione,
- i flussi end-to-end,
- le procedure di deployment e configurazione.

È pensata per supportare **utenti**, **sviluppatori** e **operatori di sistema**.

---

## Come leggere la documentazione

A seconda del tuo obiettivo, puoi seguire uno dei percorsi suggeriti:

### Utente / Valutatore
- Overview → Architettura → Deployment
- Dashboard & Extension usage

### Sviluppatore
- Architecture
- Main Operational Flows
- Implementation Details
- Ontology

### Deploy / Ops
- Deployment & Setup
- Backend Configuration
- Workers, Queues & Observability
- Advanced Configuration

---

## Sezioni della documentazione

- [Index](./Index.md)
- [Overview](./1_overview/1_Overview.md)
- [Architecture](./2_architecture/2_Architecture.md)
- [Main Operational Flows](./3_main_operational_flows/3_Main_Operational_Flows.md)
- [Implementation Details](./4_implementation_details/4_Implementation_Details.md)

---

## Struttura della documentazione

La documentazione è organizzata in sezioni numerate, ciascuna focalizzata su un aspetto specifico del sistema.

### 1. [Overview](./1_overview/1_Overview.md)
Introduzione al progetto, obiettivi, concetti chiave e visione generale.

---

### 2. [Architecture](./2_architecture/2_Architecture.md)
Descrizione dell’architettura logica e fisica del sistema:
- Client Environment (Dashboard, Extension, ZSH Plugin)
- Engine / Tool (API, Worker, Redis, GraphDB, Nginx)

---

### 3. [Main Operational Flows](./3_main_operational_flows/3_Main_Operational_Flows.md)
Requisiti funzionali, casi d’uso e sequence diagram dei componenti principali:
- Extension
- Dashboard
- ZSH Plugin

---

### 4. [Implementation Details](./4_implementation_details/4_Implementation_Details.md)
Dettagli di implementazione del codice e delle componenti:
- Client (Dashboard, Extension)
- Backend (API, Worker, Job System)
- Servizi containerizzati
- Ontologia

---

### 5. [End-to-End System Flows](./5_end_to_end_system_flows/5_End_To_End_System_Flows.md)
Flussi completi che attraversano l’intero sistema:
- Techstack Analysis
- Analyzer Scan
- HTTP Interception
- PCAP Upload
- Findings Exploration
- Tool Status

---

### 6. [Deployment & Setup](./6_deployment/6_Deployment.md)
Guida completa al deployment e alla configurazione:
- Prerequisiti
- Avvio rapido con Docker
- Configurazione backend
- Setup ambiente di sviluppo
- Build Dashboard
- Worker, code e osservabilità
- Configurazioni avanzate
- Installazione Extension

---

## Indice completo

Per una navigazione dettagliata di tutti i file:

**[Indice completo della documentazione](./Index.md)**

---