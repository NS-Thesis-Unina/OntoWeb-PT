# GraphDB

---

GraphDB è il componente di persistenza centrale dell’Engine/Tool e ospita il knowledge graph di OntoWeb-PT. Al suo interno viene creata una repository dedicata, chiamata “ontowebpt”, inizializzata con l’ontologia OntoWebPT. 

---

## Responsabilità

L'ontologia definisce il modello concettuale utilizzato dal sistema per rappresentare richieste e risposte HTTP, header, cookie, URI, contenuti HTML, relazioni tra tag e campi, resolver (Analyzer, Techstack, HTTP), finding di sicurezza e vulnerabilità note (CVE, CWE, categorie OWASP, ecc.). Tutti i dati che l’Engine elabora, che provengano dall’estensione, dalle richieste HTTP normalizzate o da file PCAP importati, vengono proiettati su questo modello e memorizzati come triple RDF all’interno della repository.

---

## Tecnologie utilizzate

Dal punto di vista tecnologico, il servizio utilizza l’immagine ufficiale `ontotext/graphdb:10.8.11` e viene eseguito con parametri di memoria configurati tramite la variabile `JAVA_OPTS` . GraphDB espone la porta 7200 sulla rete `backend` e utilizza un volume Docker (`graphdb_data:/opt/graphdb/home`) per garantire la persistenza del repository e dei dati tra i riavvii del container. La repository “ontowebpt” è configurata tramite un file RDF4J (`repository.ttl`) che definisce, tra le altre cose, il tipo di repository (`graphdb:SailRepository`), il ruleset di inferenza (`rdfsplus-optimized`), la disabilitazione della semantica `owl:sameAs`, alcune impostazioni di indicizzazione (dimensione degli indici, abilitazione di literal index e predicate list) e la politica sui timeout di query (nessun limite preimpostato lato server). 

---

## Interfacce esposte

Le interfacce esposte da GraphDB sono accessibili tramite HTTP sulla porta 7200. In particolare, il servizio mette a disposizione:  

- l’endpoint di gestione delle repository `/rest/repositories`, usato per elencare, creare e verificare la presenza delle repository disponibili;

- l’endpoint SPARQL per la repository “ontowebpt”, esposto su `/repositories/ontowebpt`, utilizzato per eseguire query `SELECT`, `CONSTRUCT`, `ASK` e aggiornamenti SPARQL;  

- l’endpoint `/repositories/ontowebpt/statements`, usato per importare bulk di triple RDF (ad esempio l’ontologia iniziale in formato RDF/XML). 

L’Ambiente Node.js accede a GraphDB utilizzando l’URL base `http://graphdb:7200`, impostato tramite la variabile d’ambiente `GRAPHDB_BASE` nei container `node-api` e `node-worker`. In questo modo, tutte le operazioni di lettura e scrittura dei dati di dominio passano attraverso query SPARQL inviate da questi componenti.

---

## Flusso di dati

Il flusso dati interno legato a GraphDB si può vedere come una pipeline: da un lato, il Worker e l’API generano e inviano aggiornamenti SPARQL che inseriscono o modificano entità nel grafo (HTTP request/response, header, URI, HTML, scan, finding, legami con CVE/CWE, ecc.); dall’altro, l’API esegue query di lettura per recuperare viste aggregate o dettagliate da esporre alla dashboard e, indirettamente, all’estensione. I resolver nel Worker trasformano i risultati degli algoritmi di analisi in triple RDF attraverso un layer di builder che produce le query SPARQL di inserimento; la dashboard, al contrario, si appoggia all’API per eseguire query SPARQL di lettura, i cui risultati vengono poi convertiti in strutture JSON tramite un layer di binding. GraphDB si occupa di mantenere l’integrità del grafo, applicare il ruleset di inferenza configurato e rispondere alle query in modo efficiente.

---

## GraphDB Init

Per garantire che l’ambiente sia sempre inizializzato in modo coerente, lo stack comprende un secondo container, `graphdb-init`, basato sull’immagine `curlimages/curl`. Il container viene eseguito una sola volta all’avvio (restart “no”) e ha il compito di portare GraphDB in uno stato pronto all’uso per OntoWeb-PT. L’entrypoint è uno script shell che implementa tre passi principali:

1. Attesa della disponibilità di GraphDB: lo script esegue richieste HTTP verso `http://graphdb:7200/rest/repositories` fino a ottenere un codice 200, assicurandosi che il server sia avviato e pronto.

2. Verifica e creazione della repository: una volta disponibile il servizio, lo script recupera la lista delle repository e controlla se esiste già una repository con ID `ontowebpt`. Se non è presente, invia una richiesta `POST` multipart con il file di configurazione `repository.ttl` montato dal volume `./graphdb:/graphdb:ro`, creando così la nuova repository con i parametri previsti.

3. Verifica e import dell’ontologia: infine, lo script esegue una query SPARQL di tipo `ASK` sulla repository “ontowebpt” per verificare la presenza di almeno una risorsa di tipo `owl:Ontology`. Se l’ontologia non è ancora stata importata, lo script invia un `POST` con content type `application/rdf+xml` verso `/repositories/ontowebpt/statements`, utilizzando il file `ontology.rdf` anch’esso montato dal volume, in modo da inizializzare il knowledge graph con la versione corrente di OntoWebPT.

---

## Dipendenze

Dal punto di vista delle dipendenze, GraphDB richiede l’accesso al volume `graphdb_data` per conservare i dati, alle risorse di memoria configurate tramite `JAVA_OPTS` e alla rete `backend` per essere raggiungibile dall’Ambiente Node.js e dal container `graphdb-init`. Quest’ultimo, a sua volta, dipende dal servizio `graphdb` (tramite `depends_on`) ed esige la presenza nella directory montata (`./graphdb`) del file di configurazione della repository (`repository.ttl`) e del file dell’ontologia (`ontology.rdf`). Nessuno di questi endpoint è esposto direttamente all’esterno dello stack Docker: l’unico accesso “normale” da parte dell’utente avviene tramite la dashboard e l’estensione, che parlano con GraphDB solo transitando attraverso le API Node.js.

---

## Note di design

In termini di note di design, GraphDB e `graphdb-init` sono pensati per rendere il knowledge graph un componente auto-configurato: un nuovo deploy dello stack è in grado di creare da zero la repository “ontowebpt” e di caricare l’ontologia OntoWebPT senza interventi manuali, riducendo il rischio di errori di setup. La scelta del ruleset `rdfsplus-optimized` e la disabilitazione di `sameAs` mirano a mantenere un compromesso tra capacità di inferenza e performance, adeguato per un uso interattivo via dashboard e per analisi iterative tipiche del penetration testing.

---
