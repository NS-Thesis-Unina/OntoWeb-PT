# OntoWebPT Extension Installation Guide

This document describes the steps required to install the OntoWebPT extension on **Microsoft Edge**, **Google Chrome**, and **Mozilla Firefox**.

---

## 1. Project preparation and build

Navigate to the main project folder ( this folder ) and run the following commands.

### 1.1 Install npm packages

```bash
npm install
```

### 1.2 Run the build

```bash
npm run build
```

When the build is complete, the browser-specific builds of the extension will be available in the `dist` folder:

- `dist/`
  - `dist/edge`
  - `dist/chrome`
  - `dist/firefox`

---

## 2. Installation on Microsoft Edge

1. Open **Microsoft Edge**.
2. Navigate to:
   ```text
   edge://extensions/
   ```
3. Enable **Developer mode** (bottom left), if it is not already enabled.
4. Click **“Load unpacked”**.
5. In the file selection dialog, select the folder:
   ```text
   dist/edge
   ```
6. Confirm the selection.

At this point, the extension is installed in Edge in developer mode.

---

## 3. Installation on Google Chrome

1. Open **Google Chrome**.
2. Navigate to:
   ```text
   chrome://extensions/
   ```
3. Enable **Developer mode** (top right), if it is not already enabled.
4. Click **“Load unpacked”**.
5. In the file selection dialog, select the folder:
   ```text
   dist/chrome
   ```
6. Confirm the selection.

At this point, the extension is installed in Chrome in developer mode.

---

## 4. Installation on Mozilla Firefox

For **Mozilla Firefox**, it is necessary to modify some files generated in the `dist/firefox` folder before loading the extension as a temporary add-on.

### 4.1 Edit the `manifest.json` file

Navigate to the folder:

```text
dist/firefox
```

Open the `manifest.json` file and replace its content entirely with the following:

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

### 4.2 Edit the `background/service_worker.js` file

Navigate to the folder:

```text
dist/firefox/background
```

Open the file:

```text
service_worker.js
```

Search for the following string:

```js
["responseHeaders", "extraHeaders"];
```

and replace it with:

```js
["responseHeaders"];
```

Save the file after the modification.

### 4.3 Load the extension temporarily in Firefox

1. Open **Mozilla Firefox**.
2. Navigate to:
   ```text
   about:debugging#/runtime/this-firefox
   ```
3. Click **“Load Temporary Add-on…”**.
4. In the file selection dialog, navigate to the folder:
   ```text
   dist/firefox
   ```
5. Select the file:
   ```text
   manifest.json
   ```
6. Confirm the selection.

The extension is now installed in Firefox as a **temporary add-on** (it remains active until the browser is closed or until it is removed from `about:debugging`).

---

## 5. Summary

- Run `npm install` and `npm run build` in the main project folder to generate the builds.
- Install the extension in developer mode on Edge and Chrome by loading the `dist/edge` and `dist/chrome` folders from each browser's extensions page.
- For Firefox, first modify `dist/firefox/manifest.json` and `dist/firefox/background/service_worker.js` as described, then load the extension temporarily from `about:debugging#/runtime/this-firefox` by selecting `dist/firefox/manifest.json`.
