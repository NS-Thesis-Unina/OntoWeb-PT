# Global – Requisiti Funzionali
---

**FR-DASH-GLOB-01 – Navigazione principale tra le sezioni della dashboard**

L’utente deve poter raggiungere in modo immediato, da qualsiasi pagina della dashboard, le principali sezioni funzionali di OntoWeb-PT tramite una navigazione globale sempre visibile sul lato sinistro:
- Home (panoramica e accesso rapido alle funzionalità)
- HTTP Requests
- Findings
- Send PCAP
- Tool Status
- OpenAPI

Requisiti:
- La barra di navigazione laterale deve essere sempre presente e utilizzabile mentre l’utente si sposta tra le pagine.
- Ogni voce deve portare alla pagina corrispondente con una singola azione (click sul pulsante/icone).
- La voce “Home” deve essere raggiungibile anche cliccando sul logo nella barra superiore.

Da prospettiva utente: “In qualunque pagina io sia, ho sempre sulla sinistra i pulsanti per tornare a Home o passare direttamente a Requests, Findings, invio PCAP, stato del tool o OpenAPI.”

---

**FR-DASH-GLOB-02 – Struttura di routing e coerenza delle URL**

La dashboard deve esporre una mappa di URL leggibili e stabili che riflettono le aree funzionali principali:

- `/` e `/home` → Home (Dashboard)
- `/http-requests` → HTTP Requests
- `/findings` → Findings (HTTP di default)
- `/findings/analyzer` → Analyzer Findings
- `/findings/techstack` → Techstack Findings
- `/server-status` → Tool Status
- `/send-pcap` → Send PCAP
- `/openapi` → OpenAPI

Requisiti:
- La Home deve essere accessibile sia come root (`/`) sia come `/home`, così da supportare link diretti e bookmarking.
- Tutte le pagine devono essere caricate all’interno di un layout comune (shell) che include barra superiore e navigazione laterale; il contenuto cambia, ma il frame resta coerente.
- L’utente deve poter usare il tasto “indietro/avanti” del browser senza perdere il contesto (routing client-side), mantenendo l’URL sincronizzato con la vista corrente.

Da prospettiva utente: “Posso salvare nei preferiti direttamente `/http-requests` o `/findings/analyzer` e, aprendoli, mi ritrovo esattamente nella vista attesa, dentro la stessa interfaccia della dashboard.”

---

**FR-DASH-GLOB-03 – Sotto-navigazione contestuale per la sezione Findings**

All’interno della sezione Findings, la dashboard deve offrire una sotto-navigazione contestuale nella barra superiore che permetta di passare tra:
- HTTP Findings (default per `/findings`)
- Analyzer Findings (`/findings/analyzer`)
- Techstack Findings (`/findings/techstack`)

Requisiti:
- I tre pulsanti devono comparire solo quando l’utente si trova in una qualsiasi route sotto `/findings`.
- Il pulsante relativo alla vista attiva deve risultare disabilitato o visivamente evidenziato per indicare chiaramente quale sotto-sezione si sta consultando.
- Il passaggio tra le tre sotto-sezioni deve avvenire senza cambiare il frame globale (barra superiore, nav laterale) e senza ricarichi completi della pagina.

Da prospettiva utente: “Quando entro in Findings vedo tre tab: HTTP, Analyzer e Techstack; posso cambiare vista con un click, e vedo chiaramente su quale tipo di finding mi trovo.”

---

**FR-DASH-GLOB-04 – Gestione globale del tema chiaro/scuro**

L’utente deve poter scegliere se utilizzare l’intera dashboard in:
- tema scuro (dark)
- tema chiaro (light)

tramite un controllo dedicato (Dark/Light button) sempre disponibile nella barra superiore.

Requisiti:
- Il cambio tema deve applicarsi immediatamente a tutta l’interfaccia (barra superiore, nav laterale, contenuti delle pagine).
- La preferenza dell’utente deve essere salvata in memoria locale (localStorage) e ripristinata automaticamente al caricamento successivo della dashboard, senza richiedere una nuova selezione.
- In base al tema scelto devono aggiornarsi anche gli elementi grafici principali, come il logo (versione chiara/scura) per mantenere leggibilità e coerenza visiva.
- In caso di impossibilità a leggere/scrivere sullo storage (es. modalità privata restrittiva), la dashboard deve ripiegare su un tema di default senza errori bloccanti, permettendo comunque la navigazione.

Da prospettiva utente: “Scelgo una volta il tema che preferisco e la dashboard rimane così anche la prossima volta che la apro, con il logo e i colori coerenti.”

---

**FR-DASH-GLOB-05 – Indicatore globale di stato del Tool (health backend)**

Nella barra superiore, la dashboard deve mostrare un indicatore sintetico dello stato operativo del backend (Tool / Engine) sotto forma di chip con testo e icona, che può assumere almeno i seguenti stati:
- Tool Checking – il sistema sta verificando lo stato dei componenti;
- Tool On – i componenti critici risultano operativi e le funzionalità che dipendono dal backend possono essere usate normalmente;
- Tool Off – il backend non è raggiungibile o uno o più componenti critici risultano non disponibili.

Requisiti:
- La dashboard deve interrogare periodicamente il servizio di health (polling) con cadenza regolare (es. ogni 3 secondi) per aggiornare lo stato senza intervento dell’utente.
- In caso di errore o impossibilità nel recuperare lo stato, l’indicatore deve assumere lo stato “Tool Off” e non deve bloccare il resto dell’interfaccia.
- Lo stato deve essere codificato anche visivamente (colore e icona: ad es. giallo per checking, verde per on, rosso per off) in modo da essere comprensibile a colpo d’occhio.

Da prospettiva utente: “Mentre uso la dashboard vedo sempre se il backend è su o giù; se qualcosa non va, vedo il chip in rosso ‘Tool Off’ e capisco perché certe azioni potrebbero fallire.”

---

**FR-DASH-GLOB-06 – Home/Dashboard come pagina di onboarding e accesso rapido**

Quando l’utente accede alla dashboard (su `/` o `/home`), deve visualizzare una pagina Home che:
- introduca brevemente lo scopo di OntoWeb-PT e il ruolo della dashboard;
- spieghi in linguaggio comprensibile i flussi principali (ingestione traffico HTTP, normalizzazione in ontologia, derivazione dei findings);
- offra un set di “feature card” cliccabili che portano direttamente alle sezioni principali:
    - HTTP Requests
    - Findings
    - Send PCAP
    - Tool Status
    - OpenAPI

Requisiti:
- Ciascuna card deve avere un’icona, un titolo e una descrizione sintetica che spiega cosa l’utente può fare in quella sezione.
- Il click su una card deve navigare alla route corrispondente, riutilizzando il layout globale.
- La pagina Home deve essere puramente informativa/presentazionale e non deve richiedere dati di input per essere utile.

Da prospettiva utente: “Apro la dashboard e vedo subito una descrizione di cosa fa lo strumento e cinque box che mi portano alle funzionalità principali, così so da dove cominciare.”

---

**FR-DASH-GLOB-07 – Layout responsivo e adattamento a desktop/mobile**

La shell della dashboard (barra superiore + nav laterale + area contenuti) deve adattarsi al dispositivo e alla larghezza della finestra in modo da restare usabile sia su schermi ampi che su schermi ridotti.

Requisiti:
- Sotto una certa larghezza (es. 900px) la barra di navigazione laterale deve passare da pulsanti testuali a pulsanti icona-only, preservando l’accesso alle stesse sezioni.
- I contenuti principali (area destra) devono restare leggibili e non sovrapporsi alla nav laterale.
- Il logo superiore deve adattarsi al contesto (versione compatta su mobile) ma continuare a funzionare come scorciatoia per tornare a Home.
- L’interfaccia non deve richiedere scroll orizzontale per le operazioni comuni.

Da prospettiva utente: “Se apro la dashboard da un portatile o da un monitor grande vedo i pulsanti con etichetta sulla sinistra; se la apro da uno schermo stretto vedo solo le icone, ma le funzioni sono le stesse e tutto rimane leggibile.”

---

**FR-DASH-GLOB-08 – Sistema di notifiche globali non bloccanti**

La dashboard deve fornire un meccanismo di notifiche globali (snackbar/toast) utilizzabile da tutte le sezioni per mostrare feedback brevi, ad esempio:
- conferma di operazioni completate (invio PCAP, caricamento dati, cancellazioni);
- segnalazione di errori recuperabili (es. filtro non valido, problemi temporanei di rete);
- messaggi informativi (“Archive loaded from storage successfully!”, ecc.).

Requisiti:
- Le notifiche devono comparire in una posizione coerente (es. in basso a sinistra) senza coprire permanentemente i contenuti principali.
- Le notifiche non devono bloccare l’interazione: l’utente deve poter continuare a navigare e usare i controlli mentre il toast è visibile.
- Deve essere limitato il numero di notifiche visibili contemporaneamente (es. una alla volta) per evitare sovrapposizioni rumorose.
- Ogni notifica deve chiudersi automaticamente dopo un intervallo di tempo ragionevole, con eventuale possibilità di chiuderla manualmente.

Da prospettiva utente: “Quando faccio qualcosa (es. carico un archivio o invio un job), vedo un piccolo messaggio in basso che mi dice se è andato a buon fine o no, ma non mi blocca e sparisce da solo.”

---

**FR-DASH-GLOB-09 – Coerenza di layout tra tutte le pagine**

Tutte le pagine principali (Home, HTTP Requests, Findings, Send PCAP, Tool Status, OpenAPI) devono essere renderizzate all’interno di un layout comune che garantisca:
- barra superiore fissa con logo, eventuale sotto-navigazione contestuale (es. Findings) e indicatori globali (stato tool, tema);
- barra laterale sinistra con navigazione globale;
- area contenuto a destra dove viene mostrata la pagina corrente.

Requisiti:
- Il cambio pagina deve aggiornare solo l’area contenuto, mantenendo intatti barra superiore e nav laterale.
- Il passaggio tra le sezioni non deve produrre “salti” visivi o ricarichi completi della pagina browser.
- Gli elementi di navigazione globale (logo, menu laterale) devono essere identici e coerenti a prescindere dalla pagina attiva.

Da prospettiva utente: “Qualunque vista io apra, la struttura rimane la stessa: in alto il logo e lo stato del tool, a sinistra il menu, a destra il contenuto specifico. Così non mi perdo.”

---

**FR-DASH-GLOB-10 – Degrado controllato in caso di problemi con storage locale o servizi globali**

In caso di problemi nell’accesso allo storage locale del browser o nel recupero di informazioni globali (es. health del backend):
- la dashboard deve rimanere utilizzabile nelle sue funzioni principali (navigazione tra le sezioni, consultazione di richieste, findings, ecc.);
- funzionalità di comodità collegate allo storage (persistenza del tema) o ai servizi di health (stato tool aggiornato) possono non funzionare al 100%, ma senza provocare errori bloccanti o pagine bianche.

Requisiti:
- Se la lettura/scrittura del tema fallisce, la dashboard deve ripiegare su un tema di default senza interrompere il rendering.
- Se il servizio di health non risponde o restituisce errore, l’indicatore di stato deve portarsi su “Tool Off”, ma il resto della UI deve continuare a funzionare.
- Eventuali malfunzionamenti di questi servizi globali devono essere gestiti internamente, in modo trasparente per l’utente, al massimo con un feedback informativo.

Da prospettiva utente: “Anche se il browser non mi lascia salvare il tema o se il backend è giù, la dashboard comunque si apre e posso navigare; magari vedo il tema di default e lo stato ‘Tool Off’, ma non rimango bloccato.”

---