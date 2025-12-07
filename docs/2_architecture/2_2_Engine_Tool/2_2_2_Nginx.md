# Nginx
---

Nginx è il punto di ingresso dell’Engine/Tool e funge da reverse proxy HTTP e WebSocket verso il servizio applicativo Node.js. È l’unico componente dello stack esposto direttamente sulla rete frontend (porta 80) e rappresenta quindi il “front door” attraverso cui passano tutte le richieste provenienti dall’ambiente client, sia dalla dashboard web sia dall’estensione browser. Il suo ruolo è quello di instradare questo traffico verso il backend Node.js, aggiungendo gli header standard di proxying e gestendo aspetti tecnici come il supporto ai WebSocket, i timeout, la dimensione massima dei payload e gli healthcheck.

---

## Responsabilità

Dal punto di vista delle responsabilità, Nginx non contiene logica applicativa né conosce il modello dati di OntoWeb-PT. Si limita a: accettare connessioni HTTP dal browser, inoltrare le richieste verso l’upstream Node.js, gestire correttamente l’upgrade di protocollo per le connessioni WebSocket utilizzate da dashboard ed estensione, esporre un endpoint `/health` usato come healthcheck dallo stack Docker e applicare un limite superiore alla dimensione del body per permettere l’upload di file `.pcap` e delle TLS keys senza compromettere la stabilità del servizio. Tutta l’elaborazione applicativa (parsing, validazione, gestione dei job, accesso a GraphDB) resta a carico dell’Ambiente Node.js.

---

## Tecnologie utilizzate

La configurazione utilizza l’immagine `nginx:alpine` e una configurazione custom montata come volume (`./nginx/nginx.conf`). All’interno del blocco `http` viene definito un upstream logico, `node_upstream`, che punta all’host `host.docker.internal` sulla porta 8081: in questo modo Nginx agisce da proxy verso il processo Node.js che espone le API HTTP e i WebSocket. Il server virtuale principale ascolta sulla porta 80, imposta un limite di `client_max_body_size` pari a 15 MB e abilita opzioni standard per l’ottimizzazione del traffico (`sendfile`, `tcp_nopush`, `tcp_nodelay`, keepalive). È presente anche una `map` che traduce l’header `Upgrade` in un valore di `Connection` appropriato, requisito per il corretto funzionamento delle connessioni WebSocket proxate.

---

## Interfacce esposte

Le interfacce esposte da Nginx verso l’esterno sono sostanzialmente due: la root `/`, che inoltra tutte le richieste verso l’upstream Node.js (inclusi gli endpoint API REST e il serving della dashboard React), e l’endpoint `/health`, utilizzato unicamente come healthcheck. La location `/` effettua il proxy in HTTP/1.1, inoltra gli header standard di reverse proxy (`Host`, `X-Real-IP`, `X-Forwarded-*`) e, quando presente l’header `Upgrade`, gestisce correttamente la negoziazione del canale WebSocket tra client e backend. La location `/health` instrada una richiesta leggera verso l’upstream e viene invocata periodicamente dal meccanismo di healthcheck del Docker Compose tramite un semplice `wget`: se la risposta non è valida, il container Nginx viene marcato come non sano.

---

## Flusso dati interni

Internamente il flusso dati è lineare: le richieste della dashboard e dell’estensione arrivano su Nginx, vengono normalizzate a livello di header e inoltrate al backend Node.js. Le risposte percorrono il flusso inverso e vengono restituite ai client senza ulteriori trasformazioni. Per le richieste con body di dimensioni significative (come l’upload di file `.pcap` e TLS keys dalla dashboard), Nginx accetta fino a 15 MB per singolo body e applica timeout di connessione, invio e lettura configurati (5 s per l’instaurazione della connessione, 60 s per invio e lettura), garantendo così un compromesso tra robustezza e reattività. La configurazione abilita anche la modalità `proxy_buffering on`, che consente a Nginx di gestire in modo efficiente le risposte del backend.

---

## Dipendenze

Come dipendenze, Nginx presuppone la raggiungibilità dell’upstream Node.js sull’host configurato (`host.docker.internal:8081`). Non è connesso alla rete backend dove risiedono Redis e GraphDB: interagisce solo con la rete frontend e delega a Node.js qualsiasi accesso ai servizi interni. Il container viene configurato con una voce `extra_hosts` per risolvere `host.docker.internal` al gateway dell’host, ed è soggetto a un healthcheck che interroga periodicamente l’endpoint `/health` interno al container: se il backend Node.js non risponde correttamente attraverso Nginx, il container viene marcato come unhealthy dal motore di orchestrazione.

---

## Note di design

Tra le principali note di design vale la pena evidenziare che Nginx è volutamente mantenuto “thin”: non effettua terminazione TLS, non implementa autenticazione, rate limiting o logica di riscrittura complessa. Questi aspetti possono essere introdotti in evoluzioni future, ma nella versione attuale il suo obiettivo principale è fornire un unico punto di ingresso HTTP/WebSocket stabile e prevedibile davanti all’Ambiente Node.js, semplificando da un lato la configurazione dei client e dall’altro l’evoluzione interna del backend.

---
