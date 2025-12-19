# Dashboard Pages Overview
---

- [Home](./4_2_1_6_Pages_Overview/4_2_1_6_1_Home.md)
- [HTTP Requests](./4_2_1_6_Pages_Overview/4_2_1_6_2_HTTP_Requests.md)
- [Findings - Techstack](./4_2_1_6_Pages_Overview/4_2_1_6_3_Findings_Techstack.md)
- [Findings - Analyzer](./4_2_1_6_Pages_Overview/4_2_1_6_4_Findings_Analyzer.md)
- [Findings - Http](./4_2_1_6_Pages_Overview/4_2_1_6_5_Findings_Http.md)
- [Send PCAP](./4_2_1_6_Pages_Overview/4_2_1_6_6_Send_PCAP.md)
- [Tool Status](./4_2_1_6_Pages_Overview/4_2_1_6_7_Tool_Status.md)
- [OpenAPI](./4_2_1_6_Pages_Overview/4_2_1_6_8_OpenAPI.md)

---

La sezione **Dashboard Pages Overview** introduce una serie di sotto-pagine dedicate alle singole viste renderizzate dentro il layout globale (`NavigationWrapper` → `Outlet`). L’obiettivo non è replicare il codice riga-per-riga, ma descrivere le **caratteristiche implementative generali** di ciascuna pagina: quali dati consuma, quali pattern UI adotta, come gestisce stato locale/remoto e quali integrazioni (REST/Socket) risultano centrali per la funzionalità.

Ogni sotto-pagina segue un taglio “white-box leggero”:
- **responsabilità della pagina** e ruolo funzionale nel prodotto;
- **stato principale** (loading, filtri, paginazione, selezioni, wizard state, ecc.);
- **flusso dati** (endpoint REST e, quando presente, stream WebSocket);
- **componenti chiave** (DataGrid, Drawer, Stepper, pannelli di dettaglio, ecc.);
- **convenzioni UX** applicate in quel contesto (empty/error/loading).

Per approfondimenti puntuali (struttura dei payload, mapping dei campi, edge cases o logiche di parsing), il riferimento rimane direttamente il codice sorgente delle rispettive pagine e dei componenti collegati.