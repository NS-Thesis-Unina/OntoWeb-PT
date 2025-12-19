# Extension Views Overview
---

- [Analyzer View](./4_2_2_6_Extension_Views_Overview/4_2_2_6_1_Analyzer_View.md)
- [Interceptor View](./4_2_2_6_Extension_Views_Overview/4_2_2_6_2_Interceptor_View.md)
- [Techstack View](./4_2_2_6_Extension_Views_Overview/4_2_2_6_3_Techstack_View.md)

---

La sezione **Extension Views Overview** introduce le principali viste renderizzate all’interno del **popup dell’estensione**.  
A differenza delle Dashboard Pages, queste viste operano in un contesto più vincolato (dimensioni ridotte, lifecycle breve, interazione diretta con il background) e fungono da **entry point operativo** per le funzionalità di scansione, analisi e integrazione con il backend Tool.

L’obiettivo di questa sezione non è documentare in modo esaustivo ogni componente React, ma fornire una panoramica strutturata delle **scelte architetturali e implementative** che caratterizzano ciascuna vista.

---

## Ambito e contesto

Le viste del popup:
- sono montate all’interno del layout principale dell’estensione;
- condividono uno stato backend comune (Tool status, job events, scan lock);
- comunicano con il backend esclusivamente tramite:
    - `toolReactController`;
    - background script;
    - REST + WebSocket (Socket.io).

Ogni vista è progettata per:
- funzionare correttamente anche se il popup viene chiuso e riaperto;
- tollerare disconnessioni temporanee dal backend;
- degradare in modo controllato quando il Tool non è disponibile.

---

## Struttura delle sottosezioni

Ciascun file dedicato a una singola vista segue una struttura coerente, analoga a quella adottata per le Dashboard Pages:

- **Ruolo della vista**  
    Funzione principale nel flusso dell’estensione e responsabilità operative.
    
- **Gestione dello stato**  
    Stato locale della UI, stato derivato dal backend, lock globali, wizard state e tracking dei job.
    
- **Integrazione backend**  
    Modalità di interazione con il Tool:
    - chiamate REST;
    - subscription WebSocket;
    - fallback di polling;
    - gestione degli errori.
        
- **Convenzioni UX**  
    Pattern condivisi:
    - stepper guidati;
    - disabilitazione progressiva delle azioni;
    - feedback asincroni (loading, warning, job dialog);
    - resilienza alla chiusura del popup.
        
- **Limiti noti**  
    Vincoli tecnici e scelte intenzionali:
    - assenza di editing avanzato;
    - visibilità limitata dei job storici;
    - focus su operazioni puntuali e one-shot.

---

## Differenze rispetto alla Dashboard

Le Extension Views presentano alcune differenze strutturali rispetto alle pagine della dashboard web:
- contesto **user-centric** e non multi-utente;
- stato fortemente legato alla sessione del browser;
- uso intensivo di `chrome.storage` e background script;
- UX orientata a task brevi e guidati, non a esplorazione estesa;
- maggiore enfasi su:
    - prevenzione di errori;
    - feedback immediato;
    - fallback automatici.

---

Le sottosezioni seguenti approfondiscono ciascuna vista singolarmente, mantenendo un livello di astrazione sufficiente a comprendere **come** e **perché** sono state implementate, lasciando al codice sorgente il dettaglio operativo puntuale.

---