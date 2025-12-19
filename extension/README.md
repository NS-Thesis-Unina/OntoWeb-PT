# OntoWeb-PT Browser Extension

La **OntoWeb-PT Browser Extension** è il componente client-side che consente l’integrazione diretta tra il browser dell’utente e il backend OntoWeb-PT.

L’estensione permette di:
- intercettare il traffico HTTP generato dal browser;
- avviare analisi **Techstack** sulle applicazioni web;
- eseguire **Analyzer scan** (SAST-like) su risorse web;
- inviare eventi e dati al backend OntoWeb-PT in tempo reale;
- visualizzare lo stato del tool direttamente dall’estensione.

L’estensione è compatibile con:
- **Google Chrome**
- **Microsoft Edge**
- **Mozilla Firefox** (modalità temporanea / developer)

---

## Repository structure

```
extension/
├── src/                 # Codice sorgente dell’estensione
├── public/              # Asset statici
├── manifest.*           # Manifest browser-specific
├── package.json
├── vite.config.ts
└── dist/                # Output build (generato)
    ├── chrome/
    ├── edge/
    └── firefox/
```

---

## Build dell’estensione

### Prerequisiti
- Node.js >= 18
- npm

### Installazione dipendenze

```bash
npm install
```

### Build

```bash
npm run build
```

Al termine del build, la cartella `dist/` conterrà le versioni specifiche per browser:

```
dist/
├── chrome/
├── edge/
└── firefox/
```

---

## Installazione sui browser

### Google Chrome

1. Apri Chrome
2. Vai su:
   ```
   chrome://extensions/
   ```
3. Abilita **Developer mode**
4. Clicca **Load unpacked**
5. Seleziona la cartella:
   ```
   dist/chrome
   ```

---

### Microsoft Edge

1. Apri Edge
2. Vai su:
   ```
   edge://extensions/
   ```
3. Abilita **Developer mode**
4. Clicca **Load unpacked**
5. Seleziona la cartella:
   ```
   dist/edge
   ```

---

### Mozilla Firefox

Firefox richiede alcune modifiche aggiuntive.

#### Modifica `manifest.json`

Percorso:
```
dist/firefox/manifest.json
```

Sostituisci interamente il contenuto con:

```json
{
  "manifest_version": 2,
  "name": "OntoWebPT",
  "version": "1.0.0",
  "description": "Estensione OntoWebPT",
  "author": "Francesco Scognamiglio, Felice Micillo",

  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },

  "browser_action": {
    "default_popup": "action/default_popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png"
    },
    "default_title": "OntoWebPT"
  },

  "background": {
    "scripts": ["background/service_worker.js"],
    "persistent": true
  },

  "web_accessible_resources": ["content_script/*", "content_script/*/*", "content_script/*/*/*"],

  "permissions": [
    "activeTab",
    "cookies",
    "notifications",
    "storage",
    "unlimitedStorage",
    "tabs",
    "webRequest",
    "webRequestBlocking",
    "scripting",
    "<all_urls>",
    "*://*/*"
  ],

  "browser_specific_settings": {
    "gecko": {
      "id": "ontowebpt@example.com",
      "strict_min_version": "91.0"
    }
  }
}
```

#### Modifica `background/service_worker.js`

Percorso:
```
dist/firefox/background/service_worker.js
```

Sostituisci:

```js
["responseHeaders", "extraHeaders"];
```

con:

```js
["responseHeaders"];
```

#### Caricamento temporaneo

1. Apri Firefox
2. Vai su:
   ```
   about:debugging#/runtime/this-firefox
   ```
3. Clicca **Load Temporary Add-on**
4. Seleziona:
   ```
   dist/firefox/manifest.json
   ```

L’estensione resterà attiva fino alla chiusura del browser.

---

## Integrazione con il backend

L’estensione comunica con l’Engine OntoWeb-PT tramite:
- API REST
- WebSocket

È necessario che il backend sia attivo:

```bash
cd engine
docker compose up -d
```

Endpoint di default:
- API: `http://localhost`
- WebSocket logs: `http://localhost:8081/logs`

---

## Funzionalità principali

- **Interceptor**
  - cattura richieste e risposte HTTP
  - invio asincrono al backend

- **Techstack**
  - rilevamento tecnologie web
  - correlazione semantica

- **Analyzer**
  - scansione statica
  - produzione di findings

- **Tool status**
  - stato backend
  - feedback live via WebSocket

---
