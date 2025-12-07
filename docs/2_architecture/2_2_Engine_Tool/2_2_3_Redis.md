# Redis
---

Redis è il componente di messaggistica interna dell’Engine/Tool e viene utilizzato principalmente come backend per le code di job gestite tramite BullMQ. Non contiene logica applicativa specifica di OntoWeb-PT e non viene utilizzato come database principale dei dati di dominio: il suo ruolo è quello di fornire uno storage veloce in memoria per code, stati dei job e metadati operativi, consentendo di disaccoppiare temporalmente le richieste ricevute dal backend dalle elaborazioni più pesanti eseguite dal Worker.

---

## Responsabilità

Le responsabilità principali di Redis all’interno del sistema sono:
- ospitare le code BullMQ su cui l’API Node.js inserisce i job asincroni (analisi techstack, analyzer HTML/JS, analisi del traffico HTTP, import di richieste da PCAP);
- mantenere lo stato dei job (in coda, in esecuzione, completati, falliti) e i relativi dati tecnici necessari al Worker per riprenderli ed elaborarli;
- fungere da punto di cooperazione tra `node-api` (producer dei job) e `node-worker` (consumer), senza esporre direttamente queste strutture verso l’esterno o verso l’utente finale.

---

## Tecnologie utilizzate

Dal punto di vista tecnologico, lo stack utilizza l’immagine ufficiale `redis:latest`, avviata con il comando `redis-server --appendonly yes` per abilitare la persistenza tramite AOF (Append Only File). I dati vengono salvati su un volume Docker dedicato (`redis_data:/data`), in modo da preservare le code e lo stato dei job tra i riavvii del container. Il servizio espone la porta standard `6379`, ma è connesso esclusivamente alla rete `backend`, risultando raggiungibile solo dagli altri container interni (in particolare `node-api` e `node-worker`). Un healthcheck basato su `redis-cli ping` verifica periodicamente che il server Redis sia disponibile e risponda correttamente.

---

## Interfacce esposte

Le interfacce esposte da Redis sono quelle native del protocollo Redis sulla porta 6379. Non ci sono endpoint HTTP, API REST o WebSocket direttamente esposti: l’accesso avviene esclusivamente tramite i client Redis integrati nello strato Node.js e utilizzati internamente da BullMQ. In pratica, i componenti applicativi vedono Redis come un servizio remoto identificato dall’host `redis` (risolto tramite DNS interno Docker) e dalla porta 6379, configurato attraverso variabili d’ambiente come `REDIS_HOST` nei container Node.js. Non sono previste molestie o accessi esterni diretti da parte dell’ambiente client o di strumenti operativi, se non eventualmente per scopi di debug.

---

## Flusso dati interni

Il flusso dati interno legato a Redis segue uno schema tipico producer–consumer. Quando l’API riceve una richiesta che richiede un’elaborazione asincrona (ad esempio l’analisi del tech stack proveniente dall’estensione o l’elaborazione di un batch di richieste HTTP estratte da un file PCAP), costruisce un job e lo inserisce in una coda BullMQ corrispondente. Redis memorizza questo job, i relativi parametri e gli stati intermedi; successivamente il container `node-worker`, tramite BullMQ, si sottoscrive alle stesse code, recupera i job in attesa, li elabora applicando i resolver e, una volta finito, aggiorna lo stato del job (successo, errore, eventuali metadati). Le informazioni di stato possono poi essere lette dall’API per esporre verso l’esterno l’avanzamento dei job o per fornire dettagli sui risultati alla dashboard.

---

## Dipendenze

Per quanto riguarda le dipendenze, Redis richiede unicamente lo storage associato al volume `redis_data` e la corretta connessione alla rete `backend`. È un servizio generico, agnostico rispetto al dominio, e non ha conoscenza diretta di GraphDB o Nginx. 

---

## Note di design

Dal punto di vista delle assunzioni, la configurazione è volutamente minimale: non sono impostati autenticazione, TLS o configurazioni avanzate di clustering e alta affidabilità. Si assume che Redis giri in un ambiente controllato (lo stack Docker dell’Engine) e che sia raggiungibile con latenze contenute dai container Node.js. In evoluzioni future, si potrebbe introdurre autenticazione, cifratura del traffico, oppure un’istanza Redis gestita con replica e clustering; nella versione attuale, Redis svolge il ruolo di componente infrastrutturale semplice e concentrato sulla gestione affidabile delle code di lavoro.

---
