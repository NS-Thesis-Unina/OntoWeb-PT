# Job Types
---

Questo file descrive i **tipi di job** gestiti dal sistema Worker e come sono organizzati nelle diverse code BullMQ. L’obiettivo è chiarire **quali job esistono**, **che input ricevono**, **cosa producono** e **quali effetti persistenti** hanno (es. scritture su GraphDB).

> Nota: qui descriviamo i job effettivamente implementati nel codice mostrato (`worker.js` + `queue.js`). Le funzioni interne di costruzione SPARQL/normalizzazione o i dettagli ontologici dei triple store sono documentati altrove.

---

## 1) Mappa “Queue → Job Types”

Il sistema usa 4 code principali, ciascuna con uno o più `job.name`:

| Queue (BullMQ) | Nome default           | Job types (`job.name`)         | Scopo                                      |
| -------------- | ---------------------- | ------------------------------ | ------------------------------------------ |
| HTTP Requests  | `http-requests-writes` | `http-ingest`, `http-resolver` | ingest richieste HTTP + analisi e findings |
| SPARQL Writes  | `sparql-writes`        | `sparql-update`                | esecuzione asincrona UPDATE su GraphDB     |
| Techstack      | `techstack-analyze`    | `techstack-analyze`            | analisi techstack → findings               |
| Analyzer       | `analyzer-writes`      | `sast-analyze`                 | analisi statica HTML/JS → findings         |

---

## 2) HTTP Requests jobs

### 2.1 `http-ingest`

**Queue:** `http-requests-writes`  
**Scopo:** persistere richieste HTTP (batch o singole) in GraphDB.

**Input (job.data)**

```js
{   
	"payload": "..." 
}
```

- `payload`: struttura “grezza” inviata dall’API (può essere singola request o array/batch).

**Elaborazione**

1. valida presenza `payload`
2. normalizza il payload in una lista di richieste HTTP (forma canonica interna)
3. genera uno SPARQL UPDATE unico:
    - se lista = 1 → insert singolo
    - se lista > 1 → insert batch
4. esegue `runUpdate(update)` su GraphDB

**Output (return del processor)**

```js
{   
	"status": 204,   
	"count": 42,   
	"payload": "..." 
}
```

**Effetto persistente**

- scrive nel grafo delle HTTP requests (lato GraphDB), creando le entità necessarie per request/uri/headers/response ecc. (a seconda del mapping).

---

### 2.2 `http-resolver`

**Queue:** `http-requests-writes`  
**Scopo:** analizzare un insieme di richieste HTTP e generare **findings** (e statistiche aggregate).

**Input (job.data)**

```js
{   
	"list": [ { "...": "..." } ] 
}
```

- `list`: array di HTTP request già normalizzate (o comunque coerenti col formato atteso dal resolver).

**Elaborazione**
1. valida `list` come array
2. esegue l’analisi:
    - produce findings (es. security headers mancanti, cookie flags, pattern rischiosi, ecc.)
    - produce statistiche aggregate (`stats`)
3. se ci sono findings:
    - forza `source` a `http` se assente
    - costruisce uno SPARQL UPDATE di inserimento findings
    - esegue `runUpdate()` su GraphDB
4. in caso di fallimento dell’insert findings:
    - logga warning ma **non necessariamente fallisce il job** (comportamento “best effort” sull’inserimento dei findings)

**Output**

```js
{   
	"result": {     
		"totalFindings": 10,     
		"stats": { "...": "..." },     
		"findings": [ { "...": "..." } ]   
	},   
	"insertStatus": 204 
}
```

**Effetto persistente**
- scrittura nel grafo findings (GraphDB), con tracciabilità della sorgente (`source=http`).

---

## 3) SPARQL Writes jobs

### 3.1 `sparql-update`

**Queue:** `sparql-writes`  
**Scopo:** eseguire in background una SPARQL UPDATE generica (tipicamente proveniente dall’endpoint API `/sparql/update`).

**Input**

```js
{   
	"sparqlUpdate": "INSERT DATA { ... }" 
}
```

**Elaborazione**
1. valida presenza `sparqlUpdate`
2. esegue `runUpdate(sparqlUpdate)` su GraphDB

**Output**

```js
{ "status": 204 }
```

**Effetto persistente**
- dipende dal contenuto della UPDATE (può scrivere qualsiasi cosa sul repository GraphDB).
- il vantaggio è disaccoppiare le scritture dall’API process e sfruttare retry/backoff di BullMQ.

---

## 4) Techstack jobs

### 4.1 `techstack-analyze`

**Queue:** `techstack-analyze`  
**Scopo:** trasformare un payload techstack (tecnologie, WAF, secure headers, cookies) in findings strutturati e persistenti.

**Input**

```js
{   
	"technologies": [ { "name": "React", "version": "18" } ],   
	"waf": [ { "name": "Cloudflare", "version": "..." } ],   
	"secureHeaders": [ { "header": "content-security-policy", "urls": ["..."] } ],
	"cookies": [ { "name": "sid", "secure": true, "httpOnly": true } ],
	"mainDomain": "example.com" 
}
```

**Elaborazione**
1. valida che `technologies` esista e sia array
2. invoca `resolveTechstack(...)`
3. se il resolver produce findings:
    - imposta `source=techstack` se mancante
    - insert findings su GraphDB tramite SPARQL UPDATE
4. se l’insert fallisce:
    - warning log, ma gestione “tollerante” analoga agli altri resolver

**Output**

```js
{   
	"result": {     
		"findings": [ { "...": "..." } ],     
		"technologies": [ ... ],     
		"waf": [ ... ],     
		"secureHeaders": [ ... ],     
		"cookies": [ ... ]   
	},
	"insertStatus": 204 
}
```

**Effetto persistente**
- scrive findings nel grafo findings, riconducibili a `source=techstack`.

---

## 5) Analyzer jobs

### 5.1 `sast-analyze`

**Queue:** `analyzer-writes`  
**Scopo:** eseguire analisi statica “SAST-like” su HTML/JS e strutture DOM estratte, producendo findings.

**Input**

```js
{   
	"url": "https://example.com",   
	"html": "<html>...</html>",   
	"scripts": [ "...", "..." ],   
	"forms": [ { "...": "..." } ],   
	"iframes": [ { "...": "..." } ],   
	"includeSnippets": false 
}
```

**Elaborazione**
1. invoca `resolveAnalyzer(...)`
2. se il risultato è `ok` e ci sono findings:
    - imposta `source=analyzer` se mancante
    - insert findings su GraphDB (SPARQL UPDATE)
3. in caso di errore su insert:
    - warning log (tolleranza come sopra)

**Output**

```js
{   
	"result": {     
		"ok": true,     
		"totalFindings": 5,     
		"stats": { "...": "..." },     
		"findings": [ { "...": "..." } ]   
	},   
	"insertStatus": 204 
}
```

**Effetto persistente**
- scrittura findings nel grafo findings, `source=analyzer`.

---

## 6) Convenzioni trasversali

### 6.1 `source` per tracciabilità

Per i job che generano findings (`http-resolver`, `techstack-analyze`, `sast-analyze`), prima dell’inserimento viene garantito un campo `source` coerente:
- `http`
- `techstack`
- `analyzer`

Questo permette alla dashboard e alle query di distinguere l’origine dei findings.

### 6.2 Idempotenza e retry

I job sono configurati con `attempts` e `backoff`. In pratica:
- problemi temporanei (Redis / GraphDB) vengono assorbiti dai retry
- se invece il payload è invalido (missing field), il job fallisce rapidamente con errore deterministico

---

## 7) Riepilogo

I job implementati coprono quattro aree:
1. **Ingestion HTTP** (persistenza richieste)
2. **Resolver/Analisi HTTP** (findings + stats)
3. **SPARQL UPDATE generico** (write decoupling)
4. **Techstack analysis** (findings)
5. **Analyzer SAST-like** (findings)

La separazione in code e `job.name` consente politiche diverse di retry/retention e concorrenza, mantenendo l’API Server snello e reattivo.

---