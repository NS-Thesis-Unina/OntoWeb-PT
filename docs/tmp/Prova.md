- Obiettivo del sistema

- Cosa fa

- Chi lo usa e per cosa

- Flussi generali

- Output prodotti

- Architettura ad alto livello (diagramma macro-blocchi)

---

## **2. Architettura del sistema (Grey-Box)**

Per ogni componente del sistema descrivi:

- responsabilità

- tecnologie usate

- interfacce esposte

- flussi dati interni

- dipendenze

- motivazioni delle scelte

Componenti tipici:

- Frontend React

- Backend Node.js / Express

- Job queues (BullMQ)

- Worker

- Sistema di parsing PCAP

- Ontologia + GraphDB

- WebSocket server

- Browser Interceptor (se esiste)

- Modulo HTTP ingestion

---

## **3. Flussi operativi principali**

Descrive passo passo cosa succede nei vari "use case".

Esempi:

- Import di un PCAP

- Normalizzazione delle richieste

- Scrittura in ontologia

- Log realtime via WebSocket

- Visualizzazione della dashboard

- Esecuzione analizzatori automatizzati

Con sequence diagram (anche descrittivi, non UML rigidi).

---

## **4. Dettagli implementativi (White-Box)**

Qui si va nel concreto più tecnico:

### **4.1 Backend**

- Struttura delle directory

- API endpoints (specifiche)

- Processi asincroni / queue workers

- Funzioni chiave

- Gestione errori e logging

- Variabili d’ambiente e configurazione

- Sicurezza e sanitizzazione input

- Serializzazione verso ontologia

- Documentazione dei moduli (es. pcap_to_http_json.py, parser HTTP, ecc.)

### **4.2 Frontend**

- Struttura delle pagine

- Componenti principali

- Routing

- WebSocket client

- Gestione stato & hooks

- Integrazione con API

- Rendering tabelle / visualizzatori

### **4.3 Ontologia**

- Schema delle classi

- Proprietà

- Mapping dai dati reali

- SPARQL endpoint utilizzati

- Ottimizzazioni

---

## **5. Deployment**

- Come installare tutto

- Setup ambiente di sviluppo

- Build del frontend e gestione .env

- Setup backend

- Avvio delle code e dei worker

- Requisiti hardware/software

- Configurazioni avanzate

---

## **6. Testing**

- Test manuali principali

- Endpoint da verificare

- Come simulare dati

- Eventuali test automatici

---

## **7. Known Issues & Limitazioni**

- Cose ancora da migliorare

- Edge cases non gestiti

- Collo di bottiglia noti

---

## **8. Conclusioni tecniche**

Breve riassunto di:

- robustezza del sistema

- scalabilità

- estensibilità

- possibili evoluzioni future
