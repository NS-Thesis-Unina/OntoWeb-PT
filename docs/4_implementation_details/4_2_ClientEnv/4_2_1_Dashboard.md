# Dashboard

---

- [Page Structure And Routing](./4_2_1_Dashboard/4_2_1_1_Page_Structure_And_Routing.md)
- [Application state and patterns](./4_2_1_Dashboard/4_2_1_2_State_Pattern.md)
- [REST integration](./4_2_1_Dashboard/4_2_1_3_REST_Integration.md)
- [WebSocket integration](./4_2_1_Dashboard/4_2_1_4_WebSocket_Integration.md)
- [UI conventions](./4_2_1_Dashboard/4_2_1_5_UI_Conventions.md)
- [Dashboard Pages Overview](./4_2_1_Dashboard/4_2_1_6_Pages_Overview.md)

---

La sezione **Dashboard** descrive la componente web di OntoWeb-PT dal punto di vista implementativo: come viene composta l’app React, come viene gestita la navigazione tra pagine, in che modo vengono orchestrate le chiamate al backend e come vengono presentati dati e stati all’utente.

L’obiettivo è fornire una lettura “white-box” della dashboard, mettendo in evidenza:

- organizzazione delle route e dei layout condivisi;
- pattern usati per stato locale/remoto (liste, dettagli, wizard, pannelli di stato);
- integrazione con API REST e gestione errori lato client;
- uso di socket.io per stream real-time (log e aggiornamenti);
- componenti UI ricorrenti (layout shell, griglie, drawer, snackbar) e regole coerenti di rendering.

---

## Ambito e collegamenti principali

- **Tecnologia e build**  
    La dashboard risiede in `engine/nodejs-dashboard`, è basata su React e Vite e usa variabili `VITE_*` per configurare l’accesso al Tool (base URL REST e URL WebSocket/log).
- **Relazione con l’Engine/Tool**  
    Le pagine della dashboard consumano endpoint esposti da `node-api` e, dove previsto, si collegano a namespace socket.io (ad esempio per log in tempo reale o monitoraggio stati), mantenendo un comportamento non bloccante e orientato all’osservabilità.
- **Coerenza UI**  
    Le varie sezioni applicano convenzioni comuni: spinner integrati per loading “leggero”, backdrop quando serve bloccare operazioni iniziali, empty state espliciti quando mancano risultati, notifiche non bloccanti per errori e successi.
    
---