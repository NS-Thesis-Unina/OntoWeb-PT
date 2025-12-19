# **Storage & Persistence**
---

Questa sezione descrive in modo sistematico **dove vengono memorizzati i dati**, **con quale durata**, e **quali meccanismi vengono adottati per evitare inconsistenze e leak di memoria** all’interno dell’estensione.

L’obiettivo principale è garantire:
- persistenza affidabile dei risultati;
- isolamento corretto tra tab e componenti;
- continuità dello stato anche in presenza di popup multipli o reload della UI.

---

## **Storage**

L’estensione utilizza principalmente le API di storage fornite dal browser, che garantiscono persistenza controllata e accesso condiviso tra le varie parti dell’estensione (UI, background, content scripts).

### `browser.storage.local`

È il **livello di persistenza principale**.

Viene utilizzato per:
- risultati di scan (Interceptor, Analyzer, TechStack);
- snapshot HTML e metadati associati;
- dataset completi necessari a riaprire wizard e flussi guidati;
- informazioni che devono sopravvivere:
    - alla chiusura del popup;
    - al refresh dell’estensione;
    - al riavvio del browser.

Caratteristiche principali:
- persistenza su disco;
- accessibile da background, popup e pagine UI;
- asincrono e non bloccante;
- quota sufficiente per dataset strutturati di medie dimensioni.

Esempi tipici di contenuto:
- `interceptorRun_<timestamp>`
- `analyzerResults_<timestamp>`
- `techstackResults_<timestamp>`

---

### `browser.storage.session`

Quando presente, viene impiegato per **stato temporaneo di sessione**, non critico e non destinato a persistere oltre la vita del browser.

Usi tipici:
- flag runtime;
- stato transitorio di wizard;
- cache volatile di supporto alla UI.

Caratteristiche:
- vive solo per la sessione corrente del browser;
- viene automaticamente eliminato alla chiusura;
- riduce il rischio di persistenza involontaria di dati temporanei.

---

### Persistenza cross-popup

Un punto chiave dell’architettura è il supporto a **più aperture e chiusure del popup** senza perdita di stato.

Per questo motivo:
- nessun dato critico viene mantenuto esclusivamente in memoria del popup;
- ogni informazione necessaria al ripristino dello stato viene serializzata su `browser.storage.local`;
- il popup, all’avvio, ricostruisce lo stato leggendo dallo storage.

In questo modo:
- il flusso dell’utente non viene interrotto;
- job in background continuano a essere tracciati anche se la UI viene chiusa;
- eventi websocket non vanno persi, grazie al fallback REST.

---

## **Local Storage Fallback**

In casi specifici viene utilizzato anche `window.localStorage` come **fallback**.

### Quando e perché

Il fallback viene adottato principalmente quando:
- l’API `browser.storage` non è ancora disponibile (early bootstrap);
- è richiesto accesso sincrono immediato;
- il dato è strettamente locale alla UI e non condiviso con il background.

Si tratta sempre di una **scelta secondaria**, mai del canale principale di persistenza.

---

### Limiti del localStorage

L’uso di `localStorage` comporta alcune limitazioni:
- accessibile solo dal contesto della pagina;
- nessuna sincronizzazione automatica con background o content scripts;
- gestione manuale delle chiavi;
- rischio di dati obsoleti se non ripuliti correttamente.

Per questi motivi:
- non viene utilizzato per risultati di scan;
- non contiene jobId o stati di backend;
- non è considerato una fonte autorevole.

---

### Gestione delle inconsistenze

Quando viene rilevata una discrepanza tra:
- stato in memoria;
- contenuto del localStorage;
- dati persistenti in `browser.storage.local`,

la regola è:
1. `browser.storage.local` ha priorità;
2. il fallback viene invalidato;
3. lo stato viene ricostruito da fonte persistente.

Questo approccio evita:
- duplicazioni;
- stati zombie;
- mismatch tra UI e backend.

---

## **Storage per-tab**

Alcune informazioni devono essere **isolate per singola tab del browser**.

### Mappa `tabId → analysis state`

Per questi casi viene mantenuta una struttura logica del tipo:

`tabId → {   analysisState,   runtimeFlags,   temporaryResults }`

Utilizzi tipici:
- runtime scan dell’Analyzer;
- Interceptor attivo su una specifica pagina;
- stato di cattura eventi legato a una singola tab.

Questo mapping può vivere:
- in memoria nel background;
- oppure serializzato in `browser.storage.session` se necessario.

---

### Cleanup su chiusura tab

Per prevenire accumulo di stato non più valido:
- il background intercetta gli eventi di chiusura tab;
- tutte le entry associate al `tabId` vengono rimosse;
- eventuali listener o hook vengono deregistrati.

Questo meccanismo garantisce che:
- nessun dato rimanga referenziato inutilmente;
- la memoria resti stabile anche con molte tab aperte e chiuse.

---

### Prevenzione dei memory leak

Le seguenti pratiche sono adottate in modo sistematico:
- uso di `Set` e `Map` con rimozione esplicita;
- unsubscribe esplicito di listener su cleanup;
- nessun riferimento persistente a tab non più esistenti;
- separazione netta tra:
    - stato persistente (storage);
    - stato volatile (runtime).

Il risultato è un sistema che:
- scala correttamente nel tempo;
- non degrada con l’uso prolungato;
- mantiene isolamento e coerenza tra componenti.

---