# OntoWebPT - Estensione Browser

L’estensione **OntoWebPT** offre un’interfaccia intuitiva per assistere i penetration tester durante l’analisi delle applicazioni web.  
Permette di catturare e inviare richieste HTTP al motore **WebPT Engine**, che le analizza semanticamente per fornire insight contestuali.

---

## ⚙️ Prerequisiti

Assicurati di avere installato:
- **Node.js (versione LTS consigliata)**
- **npm** (incluso in Node.js)

---

## 🚀 Installazione

Clona la repository:

```bash
git clone https://github.com/NS-unina/OntoWeb-PT
cd OntoWeb-PT/extension
```

Installa le dipendenze:

```bash
npm install
```

---

## 🧪 Modalità di sviluppo

### 🔹 Chrome

```bash
npm run dev-chrome
```

### 🔹 Edge

```bash
npm run dev-edge
```

---

## 🏗️ Build dell’estensione

Per generare il pacchetto pronto all’uso:

### Chrome
```bash
npm run build-chrome
```

### Edge
```bash
npm run build-edge
```

I file di build saranno disponibili nella cartella generata dallo script.

---

## ▶️ Avvio dell’estensione (richiede build)

### Chrome
```bash
npm run start-chrome
```

### Edge
```bash
npm run start-edge
```

---

## 🌍 Browser compatibili

**Attualmente:**
- Chrome  
- Edge  

**In futuro:**
- Firefox  

---

📖 **Torna al progetto principale:** [OntoWebPT Root README](../README.md)
