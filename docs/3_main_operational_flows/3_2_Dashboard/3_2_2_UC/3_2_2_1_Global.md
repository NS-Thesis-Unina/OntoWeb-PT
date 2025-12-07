# Global – Casi d’uso
---

**UC-DASH-GLOB-01 – Navigazione tra le sezioni principali dalla barra laterale**

- **Attore principale**  
    Utente (penetration tester) che utilizza la dashboard web.
    
- **Obiettivo**  
    Spostarsi rapidamente tra le sezioni principali della dashboard:
    - Home
    - HTTP Requests
    - Findings
    - Send PCAP
    - Tool Status
    - OpenAPI
    
- **Precondizioni**
    - L’utente ha aperto la dashboard nel browser.
    - Il layout globale (barra superiore + nav laterale) è correttamente caricato.
        
- **Postcondizioni minime garantite**
    - La sezione selezionata diventa la pagina attiva nell’area contenuto.
    - La barra laterale evidenzia la sezione corrente.
    - L’URL del browser è aggiornato alla route corrispondente alla sezione scelta.
        
- **Scenario principale**
    1. L’utente visualizza la dashboard con la barra laterale sinistra sempre visibile.
    2. Nella barra laterale vede le voci di menu: Home, HTTP Requests, Findings, Send PCAP, Tool Status, OpenAPI.
    3. L’utente clicca su una voce, ad esempio “HTTP Requests”.
    4. L’area contenuto a destra viene aggiornata e mostra la pagina “HTTP Requests”.
    5. L’URL del browser diventa `/http-requests`.
    6. La voce “HTTP Requests” nella nav laterale appare evidenziata come sezione corrente.
        
- **Estensioni / varianti**
    - 3a. L’utente clicca su “Home”  
        → Il contenuto centrale mostra la pagina di onboarding/riassunto principale, e la route diventa `/` o `/home` (a seconda del link cliccato).
    - 3b. L’utente clicca su una voce che corrisponde alla pagina già attiva  
        → Il contenuto rimane invariato; la route rimane la stessa e non vengono eseguiti caricamenti inutili.

---

**UC-DASH-GLOB-02 – Navigazione tramite URL dirette e coerenza del routing**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Raggiungere direttamente una sezione specifica della dashboard digitando o salvando l’URL corrispondente, mantenendo il layout globale coerente.
    
- **Precondizioni**
    - La dashboard è pubblicata su un endpoint noto (es. `https://.../dashboard`).
    - L’utente dispone di un browser moderno con supporto alla history API (routing client-side).
        
- **Postcondizioni**
    - La pagina aperta corrisponde alla route richiesta (es. `/findings/analyzer` → pagina Analyzer Findings).
    - Il layout globale (barra superiore + nav laterale) è visibile e coerente.
    - La nav laterale evidenzia la sezione principale corretta (es. “Findings”).
        
- **Scenario principale**
    1. L’utente digita direttamente nel browser un URL come `/findings/analyzer` o lo apre da un bookmark.
    2. L’applicazione client-side interpreta la route e carica la vista corrispondente all’interno del layout globale.
    3. La barra laterale mostra "Findings" come sezione attiva.
    4. La sotto-navigazione (vedi UC-DASH-GLOB-03) evidenzia la sotto-sezione “Analyzer Findings”.
    5. L’utente può utilizzare i pulsanti Indietro/Avanti del browser mantenendo sincronizzati URL e contenuto visualizzato.
        
- **Estensioni / varianti**
    - 1a. L’utente apre `/` oppure `/home`  
        → La dashboard mostra la Home come pagina principale, con struttura e layout standard.
    - 1b. L’utente modifica l’URL passando da `/send-pcap` a `/server-status` usando la barra degli indirizzi  
        → Il routing client-side aggiorna la sola area contenuto, lasciando intatte barra superiore e nav laterale.

---

**UC-DASH-GLOB-03 – Sotto-navigazione contestuale per Findings (HTTP / Analyzer / Techstack)**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Passare rapidamente tra le tre sotto-sezioni di Findings (HTTP/Analyzer/Techstack) tramite una sotto-navigazione dedicata nella barra superiore della dashboard.
    
- **Precondizioni**
    - L’utente ha aperto una route che inizia con `/findings`:
        - `/findings`
        - `/findings/analyzer`
        - `/findings/techstack`
    
- **Postcondizioni**
    - La sotto-sezione selezionata è attiva e visibile nell’area contenuto.
    - Il pulsante corrispondente nella sotto-navigazione appare disabilitato o evidenziato come corrente.
    - L’URL rispecchia correttamente la sotto-sezione scelta.
        
- **Scenario principale**
    1. L’utente si trova nella sezione Findings, ad esempio su `/findings` (HTTP Findings).
    2. Nella barra superiore appare la sotto-navigazione con tre pulsanti:
        - HTTP Findings
        - Analyzer Findings
        - Techstack Findings
    3. L’utente clicca su “Analyzer Findings”.
    4. La dashboard aggiorna l’area contenuto, caricando la pagina Analyzer Findings.
    5. L’URL diventa `/findings/analyzer`.
    6. Il pulsante “Analyzer Findings” risulta disabilitato o visivamente attivo, mentre gli altri restano cliccabili.
        
- **Estensioni / varianti**
    - 2a. L’utente accede inizialmente a `/findings` senza specificare sotto-percorso  
        → Viene mostrata HTTP Findings come default, con il pulsante “HTTP Findings” evidenziato.
    - 3a. L’utente clicca sulla tab già attiva (es. è su Analyzer e clicca di nuovo “Analyzer Findings”)  
        → Non viene effettuata una nuova navigazione; la vista resta invariata.

---

**UC-DASH-GLOB-04 – Cambio tema chiaro/scuro e persistenza della preferenza**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Passare dal tema chiaro al tema scuro (o viceversa) per tutta la dashboard, e ritrovare la stessa preferenza alle aperture successive.
    
- **Precondizioni**
    - La dashboard espone un controllo per il tema (es. pulsante Dark/Light) nella barra superiore.
    - Il browser consente l’uso di `localStorage` (salvo varianti di degrado).
        
- **Postcondizioni**
    - Il tema grafico di tutta la dashboard è aggiornato immediatamente (barra superiore, nav laterale, contenuti).
    - La scelta di tema è salvata e riapplicata al caricamento successivo.
        
- **Scenario principale**
    1. L’utente apre la dashboard, di default in tema chiaro.
    2. Nella barra superiore vede il controllo di toggle per il tema.
    3. L’utente clicca il toggle per passare al tema scuro.
    4. La dashboard applica il tema scuro all’intera interfaccia (colori di sfondo, testo, nav, card, ecc.).
    5. Il valore della scelta (es. `"dark"`) viene salvato su `localStorage`.
    6. Alla successiva apertura della dashboard (anche via URL diretta), il codice legge la preferenza e imposta direttamente il tema scuro senza intervento dell’utente.
        
- **Estensioni / varianti**
    - 5a. Il browser blocca l’accesso a `localStorage` o la scrittura fallisce  
        → Il tema viene comunque applicato per la sessione corrente, ma alla prossima apertura si tornerà al tema di default (vedi UC-DASH-GLOB-10 per degrado controllato).

---

**UC-DASH-GLOB-05 – Consultazione dello stato del Tool (backend engine) tramite indicatore globale**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Comprendere in modo immediato, da qualunque pagina, se il backend (Tool / Engine) è:
    - in verifica (Checking),
    - operativo (Tool On),
    - non disponibile/problematico (Tool Off).
        
- **Precondizioni**
    - La dashboard è in esecuzione e ha accesso all’endpoint di health del backend.
    - È attivo un meccanismo di polling periodico per lo stato del tool.
        
- **Postcondizioni**
    - L’utente vede un chip/indicatore aggiornato con uno dei tre stati.
    - L’indicatore cambia in caso di variazioni (es. Tool On → Tool Off) senza dover ricaricare manualmente la pagina.
        
- **Scenario principale**
    1. L’utente apre la dashboard.
    2. Nel header, vicino al logo o ai controlli globali, vede un chip con stato iniziale (es. “Tool Checking”).
    3. La dashboard effettua una chiamata al servizio di health.
    4. Se i componenti critici risultano operativi, lo stato viene aggiornato a “Tool On” (colore verde).
    5. L’utente naviga verso altre sezioni (HTTP Requests, Findings, ecc.) e continua a vedere il chip aggiornato.
    6. A intervalli regolari, il sistema ripete il health check e aggiorna lo stato in caso di problemi.
        
- **Estensioni / varianti**
    - 4a. Il servizio di health non risponde, va in errore o segnala componenti critici down  
        → L’indicatore passa a “Tool Off” (colore rosso) e l’utente sa che alcune azioni (es. invio PCAP, Analyze) potrebbero fallire o essere bloccate.

---

**UC-DASH-GLOB-06 – Atterraggio sulla Home/Dashboard e accesso rapido alle funzionalità principali**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Avere una pagina di ingresso (Home) che spieghi il ruolo della dashboard e permetta un accesso rapido alle sezioni principali tramite “feature card”.
    
- **Precondizioni**
    - L’utente apre la dashboard sulla route `/` oppure `/home`.
        
- **Postcondizioni**
    - La pagina Home viene mostrata con una descrizione introduttiva dello strumento.
    - L’utente può raggiungere direttamente HTTP Requests, Findings, Send PCAP, Tool Status, OpenAPI tramite card o pulsanti.
        
- **Scenario principale**
    1. L’utente visita la root della dashboard (`/`).
    2. La UI mostra la Home con:
        - un titolo introduttivo su OntoWeb-PT;
        - un testo che spiega i flussi principali (raccolta traffico, normalizzazione, findings, monitoraggio backend, esplorazione API).
    3. Sotto il testo, l’utente vede una serie di card, ad esempio:
        - “HTTP Requests”
        - “Findings”
        - “Send PCAP”
        - “Tool Status”
        - “OpenAPI”
    4. L’utente clicca su una card, ad esempio “Send PCAP”.
    5. La dashboard naviga alla pagina `/send-pcap`, mantenendo layout globale e aggiornando la nav laterale.
        
- **Estensioni / varianti**
    - 1a. L’utente arriva direttamente a `/http-requests` o altra pagina  
        → La Home viene saltata, ma è sempre raggiungibile dal menu laterale o dal logo.

---

**UC-DASH-GLOB-07 – Adattamento responsivo a differenti ampiezze dello schermo

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Utilizzare la dashboard in modo confortevole sia da schermi ampi (desktop) che da schermi più stretti (laptop piccoli, tablet), mantenendo sempre accessibili le sezioni principali.
    
- **Precondizioni**
    - La dashboard è aperta in un browser con dimensioni variabili della finestra.
        
- **Postcondizioni**
    - La barra laterale rimane utilizzabile anche su schermi stretti, eventualmente passando a icone-only.
    - Il contenuto principale resta leggibile senza richiedere scroll orizzontale.
        
- **Scenario principale**
    1. L’utente apre la dashboard su un monitor ampio.
    2. La barra laterale mostra icone + etichette testuali per ciascuna sezione.
    3. L’utente ridimensiona la finestra fino a scendere sotto una soglia predefinita (es. < 900px).
    4. La dashboard si adatta:
        - la nav laterale può rimpicciolirsi, mostrando solo le icone delle sezioni; 
        - il logo e gli elementi dell’header si adattano (versione più compatta).
    5. L’utente continua a navigare tra le sezioni tramite le icone, senza perdita di funzionalità.

- **Estensioni / varianti**
    - 4a. Su schermi molto ristretti (quasi mobile)  
        → È possibile prevedere ulteriori adattamenti (es. scrollbar verticale, nav collassabile), mantenendo comunque sempre raggiungibili le sezioni principali.

---

**UC-DASH-GLOB-08 – Ricezione di feedback non bloccante (notifiche globali)

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Ricevere conferme, avvisi o errori relativi alle azioni svolte nella dashboard (invio PCAP, caricamenti, errori di rete) attraverso notifiche non bloccanti.
    
- **Precondizioni**
    - La dashboard utilizza un sistema di notifiche globale (es. snackbar/notistack) condiviso da tutte le pagine.
        
- **Postcondizioni**
    - Per ogni azione significativa può comparire un messaggio sintetico in basso (es. low corner).
    - L’utente è informato sull’esito delle operazioni ma può continuare a usare l’interfaccia.
        
- **Scenario principale (esempio generico)**
    1. L’utente avvia un’operazione, ad esempio invia richieste HTTP all’ontologia dalla pagina Send PCAP.
    2. Al termine della chiamata, il backend risponde con esito positivo.
    3. La dashboard mostra una snackbar: “Requests accepted by the backend: X/Y. Waiting for results from the worker...”.
    4. La notifica rimane visibile per alcuni secondi, poi si chiude automaticamente.
    5. L’utente può ignorarla e proseguire le sue attività senza essere bloccato.
        
- **Estensioni / varianti**
    - 3a. L’operazione va in errore (es. problema di rete)  
        → Viene mostrata una snackbar di tipo errore (es. “Error while executing the request.”) ma la pagina rimane utilizzabile.

---

**UC-DASH-GLOB-09 – Coerenza di layout tra tutte le pagine della dashboard**

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Muoversi tra tutte le pagine principali (Home, HTTP Requests, Findings, Send PCAP, Tool Status, OpenAPI) percependo una struttura di layout stabile e coerente.
    
- **Precondizioni**
    - Il routing della dashboard è correttamente configurato a usare una shell comune (layout globale).
        
- **Postcondizioni**
    - Il cambio pagina modifica solo il contenuto centrale.
    - L’header e la nav laterale rimangono identici e persistenti.
        
- **Scenario principale**
    1. L’utente si trova sulla pagina “HTTP Requests”.
    2. Clicca “Findings” nella nav laterale.
    3. Il contenuto di destra viene sostituito dalla pagina Findings (es. HTTP Findings), ma:
        - la barra superiore rimane la stessa (logo, chip Tool Status, toggle tema, eventuale sotto-nav);  
        - la barra laterale rimane la stessa (stesse voci di menu).
    4. L’utente passa a “Send PCAP”; il layout resta invariato, cambia solo il corpo centrale (stepper PCAP).
    5. In nessun caso si verifica un “page reload” completo percepibile dall’utente: la navigazione è fluida.
        
- **Estensioni / varianti**
    - 3a. Dentro Findings, compare la sotto-navigazione dedicata  
        → È un arricchimento coerente, non sostituisce né altera la struttura globale (vedi UC-DASH-GLOB-03).

---

**UC-DASH-GLOB-10 – Degrado controllato in caso di problemi con storage locale o servizi globali

- **Attore principale**  
    Utente.
    
- **Obiettivo**  
    Continuare a usare la dashboard anche quando si verificano problemi nell’accesso a `localStorage` (tema) o nel recupero di informazioni globali (health backend).
    
- **Precondizioni**
    - Si verifica almeno una delle seguenti condizioni:
        - accesso a `localStorage` negato o malfunzionante;    
        - chiamata al servizio di health fallita o non raggiungibile.
            
- **Postcondizioni**
    - La dashboard resta navigabile e le funzionalità core (es. consultare richieste, findings) continuano a funzionare.
    - Alcune funzionalità di comodità (tema persistente, stato tool aggiornato) possono degradare a valori di default.
    
- **Scenario principale**
    1. All’avvio della dashboard, il codice tenta di leggere la preferenza di tema da `localStorage`.
    2. L’operazione fallisce (eccezione, permessi, dati corrotti, ecc.).
    3. L’applicazione intercetta l’errore e applica un tema di default (es. light) senza interrompere il rendering.
    4. In parallelo, la dashboard tenta di chiamare il servizio di health.
    5. La chiamata fallisce (timeout, rete, backend down).
    6. L’indicatore globale viene impostato su “Tool Off”, ma la UI principale continua a funzionare: l’utente può comunque consultare pagine che non richiedono contatto immediato col backend o vedere l’ultimo stato disponibile.
        
- **Estensioni / varianti**
    - 3a. Il problema riguarda solo il salvataggio, non la lettura del tema  
        → La preferenza può valere solo per la sessione corrente; alla successiva apertura si userà il default.
    - 5a. Il servizio di health torna disponibile dopo qualche minuto  
        → I successivi cicli di polling ripristinano uno stato coerente (es. “Tool On”) senza che l’utente debba ricaricare la pagina.
        
---