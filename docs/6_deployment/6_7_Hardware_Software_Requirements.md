# Hardware and Software Requirements
---

Questo documento riassume i **requisiti hardware e software reali** per eseguire OntoWebPT in modo stabile, con particolare attenzione a **GraphDB**, che è il componente più esigente in termini di risorse.

---

## Minimum recommended system

Questi valori rappresentano il **minimo consigliato** per un utilizzo base (demo, test funzionali, dataset ridotti).

- **CPU**:
    - 2 core (fisici o virtuali)
- **RAM**:
    - 4 GB **minimi**
    - 8 GB o più **fortemente consigliati** se:
        - carichi PCAP di grandi dimensioni,
        - esegui più analisi in parallelo,
        - produci molti finding (Techstack / Analyzer / HTTP).
- **Sistema operativo**:
    - Linux (consigliato per stabilità e performance),
    - macOS,
    - Windows (via Docker Desktop).

> Nota: su macOS e Windows la memoria disponibile a Docker è limitata dalle impostazioni di Docker Desktop. Assicurati che Docker abbia almeno 4–6 GB di RAM assegnata.

---

## GraphDB JVM memory configuration

GraphDB è il componente che consuma più memoria. Nel `docker-compose.yml` è configurato con:

`environment:   - JAVA_OPTS=-Xms1g -Xmx2g`

### Significato dei parametri

- `-Xms1g`  
    Heap iniziale JVM (1 GB).
- `-Xmx2g`  
    Heap massimo JVM (2 GB).

Questa configurazione è adeguata per:
- ontologia di dimensioni moderate,
- carichi di test o analisi non massivi.

### Quando aumentare la memoria

Considera di aumentare `-Xmx` se:
- vedi errori di **OutOfMemoryError** nei log di GraphDB,
- le query SPARQL diventano molto lente sotto carico,
- carichi grandi PCAP o molti batch di richieste HTTP.

Esempio per ambienti più pesanti:

`environment:   - JAVA_OPTS=-Xms2g -Xmx4g`

> Importante: la RAM assegnata a GraphDB deve rientrare nella RAM totale disponibile a Docker. Non impostare `-Xmx` troppo vicino al limite globale.

---

## Storage and persistence

OntoWebPT usa **volumi Docker persistenti** per evitare la perdita di dati tra riavvii.

### Volumi principali

- **GraphDB**
    - Contiene:
        - repository RDF,
        - ontologia importata,
        - dati persistiti dai worker.
    - Volume: `graphdb_data`
- **Redis**
    - Contiene:
        - stato delle code,
        - job completati/falliti (finché non rimossi),
        - metadati temporanei.
    - Volume: `redis_data`

### Implicazioni

- `docker compose down`  
    Ferma i container ma **mantiene i dati**.
- `docker compose down -v`  
    **Distrugge completamente** i dati di GraphDB e Redis  
    (repository, ontologia, job state).

Usa `-v` solo se vuoi un reset totale dell’ambiente.

---

## Upload limits and large PCAP files

L’upload dei PCAP è uno degli scenari più “pesanti” lato I/O.

### Nginx configuration

Nel file `nginx.conf`:
- `client_max_body_size`:
    - impostato a `200m` per la route PCAP (`/pcap/pcap-http-requests`).

Questo consente l’upload di:
- PCAP/PCAPNG di grandi dimensioni,
- file SSL key log associati.

### Considerazioni pratiche

- File molto grandi:
    - aumentano uso RAM durante l’estrazione,
    - allungano il tempo di parsing (`tshark`),
    - generano molti job di ingestion.

Se carichi PCAP > 200 MB:
- aumenta `client_max_body_size`,
- verifica timeouts (`proxy_read_timeout`),
- assicurati di avere RAM sufficiente su API e Worker.

---

## Summary

- **Minimo consigliato**: 2 CPU / 4 GB RAM
- **Uso reale consigliato**: 4 CPU / 8+ GB RAM
- **GraphDB**:
    - componente critico per RAM,
    - configurare attentamente `JAVA_OPTS`.
- **Storage**:
    - usare sempre volumi persistenti,
    - attenzione a `docker compose down -v`.
- **PCAP grandi**:
    - richiedono RAM, tempo e tuning Nginx.

---