# Extension Installation
---

Questa sezione descrive come **buildare e installare l’estensione OntoWebPT** sui principali browser supportati.  
La guida è pensata per l’uso in **modalità developer**, coerentemente con l’attuale distribuzione del progetto.

> **Nota di struttura**  
> Questa guida è inclusa nella sezione **Deployment** perché l’estensione rappresenta il punto di ingresso principale lato client e va installata **dopo** l’avvio dell’Engine/Tool.

---

## Project preparation and build

Posizionarsi nella **cartella principale del progetto dell’estensione** e installare le dipendenze.
### Install npm packages

`npm install`

### Run the build

`npm run build`

Al termine della build, le versioni browser-specifiche dell’estensione saranno disponibili nella cartella `dist`:

```
dist/  
 ├── edge/  
 ├── chrome/  
 └── firefox/
```

---

## Installation on Microsoft Edge

1. Aprire **Microsoft Edge**.
2. Navigare a:
    `edge://extensions/`
3. Abilitare **Developer mode** (in basso a sinistra).
4. Cliccare su **“Load unpacked”**.
5. Selezionare la cartella:
    `dist/edge`
6. Confermare.

L’estensione è ora installata in Edge in modalità developer.

---
## Installation on Google Chrome

1. Aprire **Google Chrome**.
2. Navigare a:
    `chrome://extensions/`
3. Abilitare **Developer mode** (in alto a destra).
4. Cliccare su **“Load unpacked”**.
5. Selezionare la cartella:
    `dist/chrome`
6. Confermare.

L’estensione è ora installata in Chrome in modalità developer.

---

## Installation on Mozilla Firefox

Per **Mozilla Firefox** sono necessarie alcune modifiche manuali prima di caricare l’estensione come add-on temporaneo.

---

### Edit `manifest.json`

Navigare nella cartella:
`dist/firefox`

Aprire il file `manifest.json` e **sostituire completamente il contenuto** con il seguente:

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

  "web_accessible_resources": [
    "content_script/*",
    "content_script/*/*",
    "content_script/*/*/*"
  ],

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

---

### Edit `background/service_worker.js`

Navigare nella cartella:
`dist/firefox/background`

Aprire il file:
`service_worker.js`

Cercare la stringa:
```js
["responseHeaders", "extraHeaders"];
```

e sostituirla con:
```js
["responseHeaders"];
```

Salvare il file.

---

### Load the extension temporarily

1. Aprire **Mozilla Firefox**.
2. Navigare a:
    `about:debugging#/runtime/this-firefox`
3. Cliccare su **“Load Temporary Add-on…”**.
4. Selezionare il file:
    `dist/firefox/manifest.json`
5. Confermare.

L’estensione viene caricata come **temporary add-on** e rimane attiva:
- fino alla chiusura del browser;
- oppure fino alla rimozione manuale da `about:debugging`.

---

## Summary

- Eseguire `npm install` e `npm run build` per generare i pacchetti browser-specifici.
- Installare l’estensione in **Edge** e **Chrome** caricando le cartelle `dist/edge` e `dist/chrome`.
- Per **Firefox**, modificare `manifest.json` e `service_worker.js`, quindi caricare l’estensione come add-on temporaneo.
- L’estensione comunica con l’Engine OntoWebPT già avviato via Docker e rappresenta il principale punto di interazione per:
    - Techstack analysis
    - Analyzer scan
    - HTTP interception

---