# WebPT Engine

Il **WebPT Engine** è il motore di analisi semantica e orchestrazione del progetto **OntoWebPT**.  
Gestisce la comunicazione con l’ontologia (tramite **GraphDB**), l’elaborazione asincrona di job su **Redis**, e fornisce API HTTP per l’interazione con l’estensione browser.

---

## ⚙️ Inizializzazione e avvio

### ✅ Prerequisiti
- **Docker** e **Docker Compose** installati  
- **Node.js LTS** installato per l’esecuzione dei processi applicativi  

---

### 1️⃣ Avvio dei servizi di base

Posizionarsi nella cartella:

```bash
cd engine
```

Avviare i container:

```bash
docker compose up -d
```

Questo comando avvia:

- **Redis** (con persistenza AOF e healthcheck)
- **GraphDB** (con volume persistente della home)

Verifica stato:
```bash
docker compose ps
```

---

### 2️⃣ Preparazione di GraphDB

1. Aprire l’interfaccia Web di GraphDB (default: [http://localhost:7200](http://localhost:7200)).  
2. Creare una **repository** con nome `ontowebpt`.  
3. Importare l’ontologia del progetto:  
   ```
   onto/ontology.rdf
   ```
4. L’ontologia definisce il vocabolario semantico usato dall’Engine (classi, proprietà, individui).

---

### 3️⃣ Configurazione dell’applicazione

Entrare nella cartella Node.js:

```bash
cd nodejs
```

Verificare/aggiornare il file `.env` con:
- Host e porte di GraphDB e Redis  
- Nomi delle code  
- Concorrenza dei worker  
- Prefissi ontologici e grafo applicativo  

Installare le dipendenze:

```bash
npm install
```

---

### 4️⃣ Avvio degli esecutori

Avviare l’**Executor API**:

```bash
npm run dev:api
```

Avviare l’**Executor Worker**:

```bash
npm run dev:worker
```

A regime:
- L’API gestisce richieste e letture sincrone da GraphDB  
- Il Worker consuma i job dalle code Redis e applica aggiornamenti sul grafo semantico  

---

### 5️⃣ Verifiche rapide

- **GraphDB** → [http://localhost:7200](http://localhost:7200)  
- **Redis** → porta 6379  
- **API** → in ascolto sulla porta definita in `.env` (es. `SERVER_PORT=8081`)  
- **Worker** → attivo con concorrenza configurata (`CONCURRENCY_WORKER_*`)  

---

📖 **Torna al progetto principale:** [OntoWebPT Root README](../README.md)
