# OntoWebPT

OntoWebPT è un progetto pensato per sviluppare un’estensione per browser a supporto delle attività di **penetration testing**, ispirata a strumenti come *OWASP KitPT*. L’estensione consente di eseguire operazioni comuni nel contesto della sicurezza applicativa e si integra con un motore esterno per l’analisi e l’arricchimento dei risultati. Un elemento distintivo del progetto, quindi, è la capacità di comunicare con **WebPT Engine**, un motore intelligente basato su un’ontologia dedicata, in grado di fornire suggerimenti contestuali e approfondimenti utili durante le fasi di analisi.  

---

## Struttura del progetto

- **`extension/`** → contiene il codice sorgente dell’estensione browser.  
- **`engine/`** → cartella dedicata al **WebPT Engine** (ancora in fase di definizione).  

---

<br>

# Documentazione

La documentazione dettagliata con descrizione e implementazione la si può visionare al seguente link:

[Documentazione (NOTION)](https://www.notion.so/OntoWPT-Estensione-Motore-230052da91f9808ea154e1dfc152b835)

---

<br>

# Estensione

## Prerequisiti

Prima di avviare il progetto, assicurati di avere installato:

- [Node.js](https://nodejs.org/) (versione LTS consigliata)  
- [npm](https://www.npmjs.com/) (viene incluso con Node.js)  

---

## Installazione

1. Clona la repository:
   ```bash
   git clone https://github.com/NS-unina/OntoWeb-PT
   cd OntoWeb-PT/extension
   ```

2. Installa le dipendenze:
   ```bash
   npm install
   ```

---

## Avvio in modalità sviluppo

Per avviare l’estensione in modalità **dev**:

- **Chrome**:
  ```bash
  npm run dev-chrome
  ```

- **Edge**:
  ```bash
  npm run dev-edge
  ```

---

## Build dell’estensione

Per generare il pacchetto dell’estensione:

- **Chrome**:
  ```bash
  npm run build-chrome
  ```

- **Edge**:
  ```bash
  npm run build-edge
  ```

I file di build saranno disponibili nella cartella generata dallo script.

---

## Avvio dell’estensione (Build step required)

- **Chrome**:
  ```bash
  npm run start-chrome
  ```

- **Edge**:
  ```bash
  npm run start-edge
  ```

---

## Browser

### Attualmente compatibili
- Chrome
- Edge

### Futura compatibilità
- Firefox

---

<br>

# Engine

In via di sviluppo...

---

<br>

# Autori

- Francesco Scognamiglio  
- Felice Micillo
