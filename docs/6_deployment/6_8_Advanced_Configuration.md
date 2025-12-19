# Advanced Configuration
---

Questa sezione raccoglie le **configurazioni avanzate** e i **tuning opzionali** per adattare OntoWebPT a scenari più complessi: carichi elevati, ambienti multi-utente, maggiore sicurezza o deployment non standard.

---

## Custom named graphs

OntoWebPT separa semanticamente i dati usando **named graph** distinti.

Nel file `/engine/nodejs/.env` puoi modificare:

```
HTTP_REQUESTS_NAME_GRAPH=http://localhost/graphs/http-requests FINDINGS_NAME_GRAPH=http://localhost/graphs/findings
```

### Quando cambiarli

- vuoi isolare dataset diversi (es. ambienti, progetti, clienti);
- vuoi mantenere più ingestion parallele senza collisioni semantiche;
- stai integrando OntoWebPT in un ecosistema RDF più ampio.

### Nota importante

- i graph devono essere coerenti con l’ontologia;
- cambiare i graph **non migra automaticamente** i dati già presenti;
- è consigliato farlo **prima del primo avvio** o con GraphDB vuoto.

---

## Scaling workers

### Aumentare la concurrency

Nel file `.env`:

```
CONCURRENCY_WORKER_HTTP_REQUESTS=2 
CONCURRENCY_WORKER_SPARQL=2 
CONCURRENCY_WORKER_TECHSTACK=2 
CONCURRENCY_WORKER_ANALYZER=2
```

Aumentare questi valori consente a un singolo worker di:
- processare più job in parallelo;
- sfruttare meglio CPU multi-core.

> Attenzione: concurrency troppo alta può saturare CPU o GraphDB.

---

### Scalare orizzontalmente i worker

È possibile avviare **più container worker** collegati allo stesso Redis.

Esempio:

`docker compose up -d --scale node-worker=3`

In questo scenario:
- Redis gestisce la distribuzione dei job;
- ogni worker compete sulle stesse code;
- il throughput aumenta linearmente finché le risorse lo consentono.

> Best practice: aumentare prima le repliche, poi la concurrency.

---

## Security hardening

### WebSocket CORS

Nel file `.env`:
`SOCKETS_CORS_ORIGIN=*`

In ambienti di produzione è consigliato restringere l’origine:
`SOCKETS_CORS_ORIGIN=https://dashboard.example.com`

Questo limita:
- connessioni WebSocket non autorizzate,
- accesso indesiderato agli stream di log/eventi.

---

### Protezione GraphDB

Nel `docker-compose.yml` GraphDB espone la porta `7200`:
`ports:   - "7200:7200"`

Per ambienti più sicuri:
- rimuovere l’esposizione pubblica della porta;
- lasciare GraphDB accessibile **solo dal network `backend`**;
- accedere alla UI solo via tunnel SSH o reverse proxy autenticato.

---

## Nginx tuning for large PCAP

### Buffering e timeout

Nel file `nginx.conf`:
- `proxy_buffering on`
- `client_max_body_size 200m`
- `proxy_read_timeout 60s`

Per PCAP molto grandi o parsing lento:

`proxy_read_timeout 300s; proxy_send_timeout 300s; client_max_body_size 500m;`

### Trade-off
- timeout alti → meno errori su upload lunghi;
- timeout troppo alti → connessioni aperte più a lungo.

Regolare in base al carico reale.

---

## `host.docker.internal` and networking

### macOS / Windows

Su macOS e Windows:
- `host.docker.internal` è disponibile di default;
- Nginx può proxyare verso servizi locali (API).

Nel tuo `nginx.conf`:
`upstream node_upstream {   server host.docker.internal:8081; }`

---

### Linux considerations

Su Linux:
- `host.docker.internal` **non è sempre disponibile**;
- viene aggiunto manualmente tramite:

`extra_hosts:   - "host.docker.internal:host-gateway"`

---

### Alternative: backend-only networking

Per eliminare completamente l’host gateway:
- metti **nginx e node-api nello stesso network (`backend`)**;
- modifica l’upstream:

`upstream node_upstream {  server node-api:8081; }`

Vantaggi:
- networking più pulito;
- meno dipendenze dall’host;
- migliore portabilità tra OS.

---