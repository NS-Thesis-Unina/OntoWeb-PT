# Prerequisites
---

Questo file elenca i **requisiti minimi** necessari per installare ed eseguire OntoWebPT.  
I dettagli di sizing avanzato (memoria, CPU, tuning) sono approfonditi nella sezione **6.7 Hardware and Software Requirements**.

---

## Docker e Docker Compose

OntoWebPT è progettato per essere eseguito tramite **Docker Compose**.

### Requisiti minimi

- **Docker Engine** (versione recente consigliata)
- **Docker Compose** (plugin `docker compose` o `docker-compose` standalone)

Verifica rapida:

```bash
docker --version
docker compose version
```

Non sono richieste installazioni manuali di Redis, GraphDB, Node.js o Python sull’host: **tutte le dipendenze runtime sono incluse nelle immagini Docker**.

---

## Risorse hardware consigliate (anticipazione)

Per un utilizzo standard (demo, sviluppo, analisi PCAP di dimensioni moderate) sono consigliate:
- **CPU**: almeno 2 core
- **RAM**: almeno 4 GB
- **Storage**: spazio persistente per volumi Docker (GraphDB + Redis)

Note importanti:
- GraphDB utilizza una **JVM** dedicata (configurata tramite `JAVA_OPTS` nel `docker-compose.yml`);
- analisi di PCAP grandi o dataset estesi possono richiedere più memoria.

Per dettagli completi e tuning avanzato fare riferimento a **6.7 Hardware and Software Requirements**.

---

## Porte utilizzate

Il deployment standard utilizza le seguenti porte sull’host:

|Porta|Servizio|Descrizione|
|--:|---|---|
|80|Nginx|Entry point HTTP (REST + WebSocket via proxy)|
|8081|Node API|API Express e WebSocket (interno / debug)|
|7200|GraphDB|UI e endpoint REST/SPARQL|
|6379|Redis|Message broker e persistence|

Assicurarsi che queste porte non siano già occupate o filtrate da firewall locali.

---

## Sistema operativo e note di compatibilità

OntoWebPT è compatibile con:
- **Linux** (consigliato per ambienti server)
- **macOS** (Docker Desktop)
- **Windows** (Docker Desktop + WSL2)

### `host.docker.internal`

Il reverse proxy Nginx utilizza `host.docker.internal` per raggiungere il backend in alcuni scenari:
- **Windows/macOS**: disponibile nativamente tramite Docker Desktop;
- **Linux**: supportato tramite la direttiva:
    ```yaml
    extra_hosts:
      - "host.docker.internal:host-gateway"
    ```

Questa configurazione è già inclusa nel `docker-compose.yml` fornito.

---

## PCAP capture e tshark

L’analisi dei file **PCAP** richiede `tshark`.
- `tshark` è **già incluso** nell’immagine Docker del backend (`node-api` e `node-worker`);
- non è necessaria alcuna installazione sull’host;
- il path è configurato tramite la variabile d’ambiente:
    ```text
    TSHARK_BIN=/usr/bin/tshark
    ```

L’elaborazione dei PCAP avviene **all’interno dei container**, senza necessità di privilegi di cattura sull’host.

---

## Riepilogo

Prima di procedere assicurarsi di avere:
- Docker e Docker Compose installati e funzionanti;
- almeno 4 GB di RAM disponibili;
- porte 80, 8081, 7200 e 6379 libere;
- accesso a filesystem per volumi Docker persistenti.

Una volta soddisfatti questi requisiti, è possibile procedere direttamente con il **Quick Start** descritto nella sezione successiva.

---