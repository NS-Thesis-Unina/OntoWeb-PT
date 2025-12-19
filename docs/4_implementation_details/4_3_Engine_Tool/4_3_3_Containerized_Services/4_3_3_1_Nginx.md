# Nginx
---

Nel progetto Nginx è utilizzato come **reverse proxy** frontale e rappresenta il **punto di ingresso HTTP** dell’intero Engine/Tool. È eseguito come container dedicato (`nginx:alpine`) ed espone un’unica porta verso l’esterno (**80/tcp**). Tutto il traffico in ingresso viene inoltrato all’API Node.js (container `node-api`) tramite una configurazione centralizzata (`nginx.conf`).

In questa architettura Nginx svolge tre funzioni principali:

- **Reverse proxy e routing**: inoltra tutte le richieste HTTP verso il backend applicativo.
- **Gestione connessioni long-lived**: abilita correttamente `Upgrade`/`Connection` per WebSocket e flussi in streaming.
- **Hardening operativo**: applica limiti e timeout (es. `client_max_body_size`, `proxy_*_timeout`) e fornisce un endpoint di healthcheck.

---

## 1) Definizione nel docker-compose

Nel `docker-compose.yml` il servizio è definito come:

- **Image**: `nginx:alpine`
- **Container name**: `nginx`
- **Port mapping**: `80:80`
- **Config mount**: `./nginx/nginx.conf:/etc/nginx/nginx.conf:ro`
- **Restart policy**: `unless-stopped`
- **Healthcheck**:
  - test: `wget -qO- http://localhost/health || exit 1`
  - interval: 10s, timeout: 5s, retries: 12
- **Networking**: rete `frontend`
- **extra_hosts**: `host.docker.internal:host-gateway`

L’uso di `host.docker.internal` consente a Nginx di raggiungere servizi esposti sul nodo host (in questo caso l’API sulla porta 8081), indipendentemente dall’IP effettivo del sistema.

---

## 2) Upstream e modello di forwarding

La configurazione definisce un upstream dedicato:

```nginx
upstream node_upstream {
  server host.docker.internal:8081 max_fails=3 fail_timeout=10s;
  keepalive 32;
}
```
Caratteristiche:
- **backend target**: `host.docker.internal:8081` (API Node)
- **resilienza**: `max_fails=3` e `fail_timeout=10s` per evitare retry aggressivi su backend momentaneamente instabili
- **keepalive**: riuso delle connessioni HTTP/1.1 verso il backend, riducendo overhead e latenza

---

## 3) Gestione WebSocket upgrade

Per supportare correttamente WebSocket e connessioni che richiedono upgrade, viene definita una mappa:

```nginx
map $http_upgrade $connection_upgrade {   
	default upgrade;   
	''      close; 
}
```

e poi applicata nelle location proxy:

```nginx
proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection $connection_upgrade;
```

Questa configurazione garantisce:
- upgrade quando il client invia `Upgrade`,
- comportamento standard (“close”) quando non è richiesto upgrade.

---

## 4) Endpoint e location principali

### 4.1 Healthcheck

```nginx
location = /health {   
	proxy_pass         http://node_upstream/health;   
	proxy_http_version 1.1;   
	proxy_set_header   Connection "";   
	...   
	proxy_read_timeout 5s; 
}
```

Aspetti rilevanti:
- path dedicato e “exact match” (`=`), quindi non intercettato da altre regole
- timeout breve (`proxy_read_timeout 5s`) per fail-fast
- `Connection ""` per evitare side effect su keepalive/upgrade

---

### 4.2 Upload PCAP ad alta dimensione

```nginx
location = /pcap/pcap-http-requests {   client_max_body_size 200m;   ...   proxy_read_timeout 60s;   proxy_buffering on; }
```

Questa location è specializzata per un endpoint che può ricevere payload grandi (PCAP):
- **body size dedicata**: 200 MB solo per questa rotta
- **timeout più alto**: invio/lettura fino a 60s per gestire parsing/import
- **buffering**: abilitato (trade-off: maggiore uso memoria/disk temporanea ma migliore gestione di upload grandi)

---

### 4.3 Default routing

```nginx
location / {   
	proxy_pass http://node_upstream;   
	...   
	proxy_read_timeout 60s;   
	proxy_buffering on; 
}
```

Tutte le altre richieste vengono inoltrate al backend senza riscrittura path.

---

## 5) Headers di forwarding e tracciabilità

Nginx imposta esplicitamente gli header tipici per preservare informazioni del client e del contesto:
- `Host`
- `X-Real-IP`
- `X-Forwarded-For`
- `X-Forwarded-Proto`
- `X-Forwarded-Host`
- `X-Forwarded-Port`

Questi header permettono all’API di:
- ricostruire la richiesta originale,
- loggare correttamente IP e protocollo,
- gestire eventuali logiche basate su host/proto.

---

## 6) Limiti e timeout globali

Nel blocco `server` è impostato:

```nginx
client_max_body_size 15m;
```

che limita la dimensione massima delle richieste **di default**.  
La location PCAP sovrascrive questo valore con 200m.

Timeout proxy (default e PCAP):
- `proxy_connect_timeout 5s`
- `proxy_send_timeout 60s`
- `proxy_read_timeout 60s`

Questi valori evitano che richieste lente restino aperte indefinitamente.

---

## 7) Networking e isolamento

Il container Nginx è collegato alla rete `frontend`, mentre Node API/Worker, Redis e GraphDB vivono sulla rete `backend`. Questo modello:
- espone verso l’esterno solo Nginx,
- mantiene i servizi interni non direttamente raggiungibili dall’host (salvo porte esposte esplicitamente nel compose).

Nota: nel compose attuale l’API espone anche `8081:8081`; Nginx resta comunque l’entrypoint previsto e “stabile” per l’accesso da browser o client esterni.

---

## 8) Considerazioni di sicurezza

- **TLS termination**: nella configurazione fornita Nginx opera in HTTP su porta 80; l’eventuale TLS può essere aggiunto estendendo il server block con `listen 443 ssl` e certificati.
- **Upload PCAP**: la location dedicata separa i limiti e i timeout, riducendo l’impatto sulle altre richieste.
- **Forwarded headers**: la logica applicativa deve considerare che gli header `X-Forwarded-*` possono essere “spoofati” se Nginx non è l’unico ingresso; l’assunzione corretta è che Nginx sia il frontdoor unico del sistema in produzione.

---