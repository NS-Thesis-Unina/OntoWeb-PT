# Extension

---

- [Popup Architecture](./4_2_2_Extension/4_2_2_1_Popup_Architecture.md)
- [Application state and patterns](./4_2_2_Extension/4_2_2_2_State_Patterns.md)
- [Core Modules](./4_2_2_Extension/4_2_2_3_Core_Modules.md)
- [Tool integration (REST/WS) + Tool status](./4_2_2_Extension/4_2_2_4_Tool_Integration.md)
- [Storage & persistence](./4_2_2_Extension/4_2_2_5_Storage_Persistence.md)
- [Extension Views Overview](./4_2_2_Extension/4_2_2_6_Extension_Views_Overview.md)

---

La sezione **Extension** descrive la componente browser di OntoWeb-PT dal punto di vista implementativo: come viene costruito il popup dell’estensione, come vengono coordinati i moduli di analisi (Analyzer / Interceptor / Techstack) e in che modo i dati raccolti nel contesto della pagina vengono normalizzati e inviati al Tool backend.

L’obiettivo è fornire una lettura “white-box” dell’estensione, mettendo in evidenza:
- architettura del popup e gestione del routing interno (o delle viste) con lifecycle effimero;
- pattern usati per stato locale e stato per-tab (selezione tab, cache, lock e deduplicazione eventi);
- integrazione con API del Tool (REST e, dove previsto, aggiornamenti asincroni/polling) e gestione di stati “Tool OFF / unreachable”;
- componenti principali e responsabilità dei moduli Analyzer / Interceptor / Techstack, inclusi i punti di contatto con content script e browser APIs;
- persistenza e coerenza dello storage (chrome storage/local storage) con fallback e cleanup.

---

## Ambito e collegamenti principali

- **Tecnologia e packaging**  
    L’estensione è distribuita come client browser separato dalla dashboard web: è composta da UI popup e da logica di raccolta dati legata al tab corrente. La build produce asset compatibili con l’ambiente extension e usa variabili/configurazioni dedicate per raggiungere i servizi del Tool (base URL REST e, se presenti, URL socket).
- **Relazione con pagina e browser runtime**  
    Le funzionalità operano nel contesto del browser: la UI del popup orchestrata le azioni, mentre la raccolta effettiva avviene tramite integrazione con tab attivo e meccanismi di isolamento tipici delle estensioni (content script, messaging, permissions). La chiave operativa è spesso il `tabId`, usato per mantenere stato e risultati per singola pagina visitata.
- **Relazione con l’Engine/Tool**  
    L’estensione invia al Tool payload derivati dal browser (DOM snapshot, tecnologie rilevate, metadati HTTP e contesto di navigazione). La comunicazione è orientata a job asincroni: enqueue via REST, eventuale polling dei risultati, e gestione robusta dei fallimenti (tool non disponibile, timeout, errori di validazione).
- **Coerenza UI e feedback utente**  
    Le viste del popup seguono convenzioni coerenti: stati di loading non invasivi durante acquisizione/analisi, blocco delle azioni concorrenti quando un lock è attivo, empty state espliciti quando non ci sono dati raccolti, notifiche compatte per success/error e messaggi chiari quando il Tool risulta OFF o non raggiungibile.

---