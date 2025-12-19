# Techstack Analysis Flow
---

Questo documento descrive il **flusso end-to-end di analisi Techstack**, avviato dall’estensione browser e finalizzato all’identificazione delle tecnologie utilizzate dal target, delle configurazioni di sicurezza (header, cookie) e delle eventuali vulnerabilità note correlate.
Il flusso è un esempio tipico di **Asynchronous Flow (Queue + Worker)** con **Streaming Feedback** verso il client.

---

![SD](../../../images/5_end_to_end_system_flows/5_2_Extension_Flows/5_2_1_Techstack_Analysis_Flow/5_2_1_Techstack_Analysis_Flow_SD.png)

---
## Trigger (Client Action)

Il flusso viene avviato quando l’utente, tramite l’estensione:
- apre il popup;
- seleziona la **Techstack View**;
- avvia esplicitamente l’analisi del target corrente.

L’azione dell’utente non esegue alcuna analisi localmente, ma segnala l’intenzione di:
- analizzare il dominio principale;
- inviare al backend i dati preliminari raccolti dal browser.

---

## Client-side preparation

Prima di inviare la richiesta al backend, l’estensione esegue una fase di preparazione locale, che include:
- identificazione del **main domain**;
- raccolta dei risultati preliminari di fingerprinting (header HTTP osservati, cookie, tecnologie rilevate);
- normalizzazione del payload in una struttura serializzabile.

Questa fase:
- non include logica di analisi di sicurezza;
- serve esclusivamente a fornire al backend il contesto necessario.

---

## Ingress (Ingress Layer)

Il payload viene inviato tramite una richiesta REST:

`Extension → Nginx → API Server`

Responsabilità dell’Ingress Layer:
- terminazione della connessione HTTP;
- validazione del payload (schema, campi obbligatori);
- verifica dello stato del tool (Redis, GraphDB, worker);
- normalizzazione dei dati in una forma interna coerente.

Se la richiesta è valida, l’API risponde immediatamente con un acknowledgment.

---

## Job creation (Processing Layer – enqueue)

Una volta validato il payload, l’API Server:
- crea un job di tipo **techstack-analyze**;
- assegna un `jobId`;
- inserisce il job nella **Redis Queue** dedicata.

Questo passaggio segna la transizione da flusso sincrono a **flusso asincrono**.

Schema:

`API Server → Redis Queue (techstack-analyze)`

L’API restituisce al client:
- conferma di accettazione;
- identificativo del job per il tracciamento successivo.

---

## Worker execution (Processing Layer – execution)

Un worker disponibile preleva il job dalla coda ed esegue il **TechstackResolver**.

Attività principali del resolver:
- analisi di header di sicurezza;
- valutazione delle configurazioni cookie;
- identificazione di software, framework e WAF;
- correlazione con vulnerabilità note (CVE, CPE).

Durante l’esecuzione:
- il worker emette eventi di avanzamento;
- eventuali anomalie vengono loggate.

---

## Persistence (Persistence Layer)

Al termine dell’analisi, il worker persiste i risultati in **GraphDB**:
- creazione di **TechstackFinding**;
- collegamento dei finding al dominio principale;
- eventuale associazione con vulnerabilità (CVE);
- riferimento esplicito al **TechstackResolver** come sorgente.

Questo step è:
- write-heavy;
- progettato per essere il più possibile idempotente;
- conforme all’ontologia del sistema.

Schema:

`Worker → GraphDB`

---

## Feedback (Feedback Channel)

Il feedback verso il client avviene tramite due canali complementari:

### Streaming (WebSocket)

Durante l’esecuzione:
- eventi di stato del job;
- log del worker;
- segnalazione di completamento o errore.

Schema:

`Worker / API → WebSocket → Extension / Dashboard`

---

## Failure points & retries

Il flusso include diversi punti di possibile fallimento, ciascuno gestito in modo controllato:

- **Ingress failure**  
    Payload non valido → errore REST immediato.
    
- **Queue failure**  
    Redis non disponibile → job non accettato.
    
- **Worker failure**  
    Errore durante l’analisi → retry automatici secondo policy.
    
- **Persistence failure**  
    Scrittura GraphDB fallita → job marcato come failed.
    

Il client viene sempre informato dello stato finale tramite feedback channel.

---