# Dashboard Build and Environment
---

Questo documento descrive come funziona la **Dashboard** nel progetto OntoWebPT:
- di default è **già precompilata** e “bundled” dentro l’Engine (node-api);
- se vuoi modificarla (UI o env), devi **ricompilarla** e **aggiornare l’immagine Docker** del backend.

---

## Dashboard already bundled in node-api

In modalità “prod dockerizzata” (`docker compose up -d`), la Dashboard:
- non viene buildata al volo;
- viene servita come asset statico dall’**API server** (`node-api`);
- è quindi parte del contenuto copiato/buildato nell’immagine Docker di `/engine/nodejs`.

Conseguenza pratica:
- se cambi la dashboard, **il container `node-api` non vede le modifiche** finché non ricrei l’immagine.

---

## Dashboard environment variables

Il file `.env` della Dashboard è in:
`/engine/nodejs-dashboard/.env`

Variabili principali:
```
# Tool Base URL 
VITE_API_BASE_URL=http://localhost  

# Logs Socket 
VITE_LOGS_WS_URL=http://localhost:8081 VITE_LOGS_WS_URL_LOGS=http://localhost:8081/logs
```

### Note operative

- `VITE_API_BASE_URL` deve puntare alla base URL esposta da Nginx (di default `http://localhost` su porta 80).
- `VITE_LOGS_WS_URL` e `VITE_LOGS_WS_URL_LOGS` devono puntare al server WebSocket/Socket.io esposto dall’API (di default `http://localhost:8081`).


---

## Build della Dashboard

Entrare nella cartella Dashboard:
`cd engine/nodejs-dashboard`

Installare dipendenze:
`npm install`

Eseguire la build:
`npm run build`

Output tipico:
- cartella `dist/` con bundle statico pronto per essere servito.

---

## Deploy della build dentro node-api

Dopo la build, il contenuto di `dist/` deve essere copiato nella cartella che `node-api` serve come static assets (cioè “dentro” il progetto nodejs, prima della build Docker).

Nel tuo workflow questo significa:
- prendere `engine/nodejs-dashboard/dist/`
- copiarlo dentro `/engine/nodejs` nella directory usata come public/static (quella già configurata nel backend per servire la dashboard)

Esempio concettuale (il path esatto dipende da come l’API serve i file statici):

`cp -r engine/nodejs-dashboard/dist/* engine/nodejs/<STATIC_DIR>/`

> Nota: l’obiettivo non è “servire dist da Vite”, ma includere gli asset compilati nel build Docker del backend.

---

## Importante: rebuild delle immagini Docker

Se hai già eseguito in precedenza:

`docker compose up -d`

allora le immagini `node-api` e `node-worker` potrebbero essere già state buildate e cached.

Per rendere effettive le modifiche alla Dashboard devi **ricreare le immagini**.

### Opzione 1 — rebuild senza cache (consigliata)

```
docker compose down 
docker compose build --no-cache node-api node-worker 
docker compose up -d
```

### Opzione 2 — rimuovere immagini e ricreare

1. Spegnere stack:
	`docker compose down`

2. Rimuovere immagini (esempi):
	`docker rmi node-api node-worker`
3. Ricostruire e avviare:
	`docker compose up -d --build`

> Se i nomi immagine non corrispondono (perché Docker Compose usa nomi tipo `<project>_node-api`), individua i nomi corretti con `docker images` e rimuovi quelli giusti.

---

## Checklist rapida post-build

Dopo il rebuild:
- Dashboard raggiungibile da browser:
    - `http://localhost/`
- Health endpoint:
    - `curl http://localhost/health`
- WebSocket / logs (pagina Tool Status):
    - status “connected”
    - log che scorrono nel pannello “Real-Time Logs”

---