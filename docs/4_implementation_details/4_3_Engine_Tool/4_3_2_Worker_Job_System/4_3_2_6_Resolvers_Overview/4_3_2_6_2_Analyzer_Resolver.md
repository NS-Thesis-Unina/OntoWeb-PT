# Analyzer Resolver
---

Questo documento descrive l’**Analyzer Resolver** (`resolveAnalyzer`) e il **motore SAST** sottostante (`sastEngine`). Il suo scopo è eseguire un’analisi **white-box client-side** (HTML/JS) su una singola pagina web e produrre **findings normalizzati** pronti per la persistenza in ontologia.

L’Analyzer è pensato per individuare:
- vulnerabilità **DOM-based XSS**,
- **code injection** e **open redirect**,
- flussi di **taint** (source → sink senza sanitizzazione),
- configurazioni HTML rischiose (inline handler, iframe, form).

---

## 1) Entrypoint e contratto

### Funzione principale

```js
resolveAnalyzer({   url,   scripts,   html,   mainDomain,   forms,   iframes,   includeSnippets })
```

### Input (alto livello)

- `url`: URL completo della pagina analizzata
- `scripts`: array di `{ code?, src? }` (inline o esterni)
- `html`: documento HTML completo
- `forms`: struttura delle form rilevate
- `iframes`: struttura degli iframe rilevati
- `includeSnippets`: abilita l’inclusione di snippet JS/HTML nei findings
- `mainDomain`: fallback per il linking ontologico se `url` è assente

### Output

```js
{   
	"ok": true,   
	"pageUrl": "...",   
	"totalFindings": number,   
	"stats": { "high": number, "medium": number, "low": number },   
	"summary": { 
		"scripts": number, 
		"forms": number, 
		"iframes": number, 
		"html": number 
	},   
	"findings": AnalyzerFinding[] 
}
```

In caso di errore:

```js
{ "ok": false, "error": "..." }
```

---

## 2) Architettura generale

Il resolver è un **wrapper orchestratore** attorno al motore `sastEngine`:
1. istanzia il motore con le opzioni richieste,
2. avvia la scansione su HTML, script, form e iframe,
3. normalizza e arricchisce i findings,
4. calcola statistiche e summary,
5. ritorna un payload coerente e persistibile.

Il vero lavoro analitico è svolto da `sastEngine`.

---

## 3) SAST Engine: visione d’insieme

### Classe principale

```js
class sastEngine {   
	constructor(options)   
	scanCode(scripts, html, pageUrl, forms, iframes) 
}
```

### Componenti chiave

- **Parser JS**: `acorn`
- **AST traversal**: `acorn-walk`
- **Rule sets**:
    - `staticRules` (pattern JS pericolosi)
    - `formRules` (HTML/form)
    - `taintRules` (data-flow analysis)
    - `htmlRules` (inline handler, iframe, style)
- **Fetcher JS esterni**: `axios` (best-effort)

---

## 4) Pipeline di analisi (`scanCode`)

### 4.1 HTML-level rules (prima fase)

Per ogni regola con `checkHtml(html)`:
- analizza direttamente il markup,
- produce finding con:
    - `file: "HTML Document"`
    - `location: { start, end }` (offset HTML)

Esempi:
- form con `method="get"`
- action esterne
- inline event handler
- iframe `srcdoc` o `data:text/html`

---

### 4.2 Inline JS handlers

- Estrae codice da attributi HTML:
    - `onclick`, `onload`, `onerror`, `onsubmit`, …
- Ogni snippet:
    - viene parsato come JS,
    - marcato come `inline-handler[#i]`,
    - aggiunto al set di AST da analizzare.

---

### 4.3 Script esterni e inline

Per ogni `<script>`:
- se `src`:
    - tenta fetch HTTP (timeout 5s),
- se inline:
    - usa direttamente `code`,
- parse JS con `acorn`,
- assegna `sourceFile` coerente (`src` o `inline-script[#i]`).

---

### 4.4 AST template unificato

- Tutti i `body` degli AST vengono fusi in un **AST template** unico.
- Consente regole **cross-file** (taint propagation).

---

### 4.5 Static rules e taint rules

Per ogni regola con `check(ast)`:
- percorre l’AST,
- individua pattern pericolosi o flussi source → sink,
- genera findings grezzi (`rawFindings`).

Limite di sicurezza:
- interrompe se >300 findings (anti-DoS).

---

## 5) Regole di analisi

### 5.1 Static JS rules (estratto)

- `no-eval`
- `no-innerhtml`
- `no-document-write`
- `no-function-constructor`
- `no-open-redirect`
- `no-localstorage-sensitive`
- `no-insecure-http`
- `no-document-cookie-write`
- `no-inline-script-creation`

Tutte producono findings con:
- `ruleId`
- `severity`
- `category`
- `owasp`
- `location` (line/column)

---

### 5.2 HTML & Form rules

- `form-method-get`
- `form-external-action`
- `form-open-redirect`
- `html-inline-event`
- `html-inline-style-expression`
- `html-iframe-srcdoc`

Operano direttamente su markup HTML.

---

### 5.3 Taint analysis

Regola:
- `taint-flow`

**Source principali**:
- `document.cookie`
- `location.*`
- `window.name`
- input form
- parametri URL

**Sink principali**:
- `innerHTML`, `outerHTML`
- `eval`, `Function`
- `document.write`
- `location.assign`
- `window.open`
- `document.cookie`

**Sanitizer supportato**:
- `sanitize(...)`

Se flusso non sanificato → finding `HIGH`.

---

## 6) Normalizzazione e arricchimento findings

Dopo la fase “grezza”, ogni finding viene arricchito:

### 6.1 Snippet (opzionali)

Se `includeSnippets=true`:
- snippet JS (line/column),
- snippet HTML (offset),
- source/sink snippet per taint.

---

### 6.2 Context vector

Ogni finding ha un `contextVector`:
- `type`: `script | iframe | form | html | html-inline-handler`
- `index`: indice nell’array originale
- `origin`: `inline | external | markup`
- `src`, `action`, `method`, `inputs` (se applicabili)

Serve a:
- spiegare **dove** è stata trovata la vulnerabilità,
- costruire relazioni ontologiche.

---

### 6.3 HTML reference (`htmlRef`)

Struttura normalizzata per ontologia:
- `type`: `form | iframe | script | html`
- `tag`
- `attributes`
- `fields` (input form)

Esempio:
```js
{   
	"type": "form",   
	"tag": "form",   
	"attributes": [{ "name": "action", "value": "..." }],   
	"fields": [{ "tag": "input", "name": "email" }] 
}
```

---

### 6.4 Finding ID stabile

Ogni finding riceve un `findingId` deterministico:

`{ruleId}:{fileId}:{location}@{pageUrl}`

Serve per:

- IRIs stabili in ontologia,
- deduplicazione,
- correlazione nel tempo.

---

## 7) Resolver: aggregazione finale

`resolveAnalyzer`:
- mappa `rawFindings → AnalyzerFinding`,
- calcola:
    - `stats` per severità,
    - `summary` per contesto (script/form/iframe/html),
- logga un riassunto compatto,
- ritorna payload finale.

---

## 8) Logging e robustezza

Namespace logger:
- `resolver:analyzer`

Comportamento:
- errori di parsing o fetch **non bloccano** l’analisi,
- errori globali → `{ ok:false }`,
- log finale con:
    - numero findings,
    - breakdown per severità,
    - contesto,
    - snippet on/off.

---

## 9) Ruolo architetturale

L’Analyzer Resolver:
- è **CPU-intensive** → eseguito solo via Worker,
- fornisce analisi **white-box client-side**,
- complementa:
    - HTTP Resolver (runtime/black-box),
    - Techstack Resolver (configurazione/vulnerabilità note).

Insieme, i tre resolver coprono **superficie statica, dinamica e configurazionale** del target.

---