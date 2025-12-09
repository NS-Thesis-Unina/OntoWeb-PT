## **1. Overview (Black-Box)

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

- (opzionale) note di design

---

## **3. Flussi operativi principali

- Requisiti funzionali

- Use Cases

- Sequence diagrams

---

## **4. Dettagli implementativi (White-Box)**

Più tecnico:

### **4.1 Engine/Tool**

- Struttura delle directory

- API endpoints (specifiche)

- Processi asincroni / queue workers

- Funzioni chiave

- Gestione errori e logging

- Variabili d’ambiente e configurazione

- Sicurezza e sanitizzazione input

- Serializzazione verso ontologia

- Documentazione dei moduli (es. pcap_to_http_json.py, parser HTTP, ecc.)

### **4.2 Ambiente Client**

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
