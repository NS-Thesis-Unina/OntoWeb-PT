# Http Resolver
---

Questo documento descrive l’**HTTP Resolver** (`analyzeHttpRequests`) e il relativo **set di regole HTTP ontology-aware**.  
Il suo scopo è analizzare richieste e risposte HTTP **runtime** (catturate dall’estensione o importate da PCAP) e produrre **findings semantici** direttamente collegabili agli individui dell’ontologia (Request, URI, Response, Header, Param, Cookie).

L’HTTP Resolver rappresenta il livello **black-box / protocol-level** dell’analisi.

---

## 1) Ruolo e obiettivo

L’HTTP Resolver:
- lavora su **traffico HTTP reale** (non codice sorgente),
- individua vulnerabilità e misconfigurazioni **a livello di protocollo**,
- genera findings **ontology-first**, già pronti per SPARQL INSERT,
- correla ogni finding a **Request / URI / Response** tramite IRIs stabili.

È complementare a:
- **Analyzer Resolver** → analisi statica HTML/JS,
- **Techstack Resolver** → configurazione e CVE note.

---

## 2) Entrypoint e contratto

### Funzione principale

```js
analyzeHttpRequests(requests, verbose?)
```

### Input

```js
HttpResolverRequest[]
```

Ogni richiesta contiene:
- `id`: identificativo univoco (usato per IRIs)
- `method`
- `uri`:
    - `full`
    - `scheme`
    - `authority`
    - `path`
    - `queryRaw`
    - `params[]`
- `headers[]`
- `response` (opzionale):
    - `status`
    - `headers[]`
    - `bodyBase64`
- `graph` (opzionale, default `G_HTTP`)

---

### Output

```js
{   "ok": true,   "totalFindings": number,   "stats": { "high": number, "medium": number, "low": number },   "findings": HttpResolverFinding[] }
```

---

## 3) Filosofia “ontology-aware”

A differenza di un classico scanner HTTP:
- il resolver **non lavora su stringhe anonime**,
- ogni elemento rilevante ha un **IRI deterministico**.

Esempi:
- `urn:req:{id}`
- `urn:req:{id}:hdr:{i}`
- `urn:req:{id}:param:{i}`
- `urn:req:{id}:resh:{i}`

Questo consente:
- correlazione cross-job,
- deduplicazione semantica,
- query SPARQL avanzate (per host, path, header, ecc.).

---

## 4) Costruzione del contesto HTTP

### 4.1 Base HTTP Context

Per ogni richiesta viene creato un `HttpContextBase`:

```js
{   requestId,   graph,   requestIri,   uriIri,   responseIri? }
```

Deriva direttamente dall’`id` della richiesta.

---

### 4.2 Arricchimento con evidence

Quando una regola matcha, restituisce un oggetto `evidence` che può contenere:
- `headers[]`
- `params[]`
- `cookies[]`

Il resolver arricchisce automaticamente l’evidence con IRIs:

```js
{   
	headers: [{ iri: iriHeader(...) }],   
	params:  [{ iri: iriParam(...) }],   
	cookies: [{ headerIri: iriHeader(...) }] 
}
```

Il risultato è un `HttpContext` completo, pronto per SPARQL.

---

## 5) Modello di regola HTTP

Ogni regola ha la forma:

```js
{   
	id,   
	description,   
	severity,   
	category,   
	owasp,   
	check(req): false | HttpEvidence 
}
```
- `false` → nessun match
- `HttpEvidence` → match con dettagli strutturati

Le regole **non generano direttamente findings**, ma solo evidence.

---

## 6) Tipi di Evidence

### 6.1 Header

```js
{   
	"kind": "header",   
	"headers": [{ 
		"where": "response", 
		"index": 0, 
		"name": "Server", 
		"value": "nginx/1.18" 
	}] 
}
```

### 6.2 Cookie

```js
{   
	"kind": "cookie",   
	"cookies": [{     
		"where": "response",     
		"headerIndex": 2,     
		"cookieIndex": 0,     
		"name": "SESSIONID",     
		"attributes": { "secure": false, "httpOnly": false }   
	}] 
}
```

### 6.3 Param

```js
{   
	"kind": "param",   
	"params": [{ "index": 1, "name": "token", "value": "abc" }] 
}
```

### 6.4 Body / Transport

```js
{   
	"kind": "body",   
	"pattern": "ReferenceError",   
	"snippet": "..." 
}
```

---

## 7) Set di regole implementate

### 7.1 Transport & Configuration (A05)

- `insecure-http`
- `cors-misconfig`
- `mixed-content`

---

### 7.2 Authentication & Session (A07)

- `insecure-cookie`
- `missing-samesite`
- `token-in-url`

---

### 7.3 Data Exposure (A02)

- `leak-stacktrace`
- `server-fingerprint`

---

### 7.4 Injection (A03)

- `sql-injection-pattern`
- `xss-payload-detected`
- `path-traversal`

---

### 7.5 Access Control (A01)

- `open-redirect`

---

## 8) Generazione del finding

Per ogni match:
1. viene costruito l’`HttpContext`,
2. viene creato un `HttpResolverFinding`:

```js
{   
	"ruleId": "...",   
	"severity": "high",   
	"description": "...",   
	"category": "...",   
	"owasp": "...",   
	"url": "...",   
	"method": "GET",   
	"responseStatus": 200,   
	"requestId": "...",   
	"graph": "...",   
	"resolver": "HttpResolverInstance",   
	"httpContext": { ... },   
	"evidence": { ... } 
}
```

---

## 9) Statistiche e logging

Al termine:
- calcolo automatico di `stats.high / medium / low`,
- log riassuntivo:
    `HTTP analysis completed — N findings (H:x, M:y, L:z)`

Logger namespace:
- `resolver:http`

---

## 10) Robustezza ed error handling

- una regola che lancia eccezioni **non interrompe** il resolver,
- errori sono loggati e la scansione prosegue,
- payload finale sempre coerente (`ok:true` se il ciclo termina).

---

## 11) Ruolo architetturale

L’HTTP Resolver:
- opera su **runtime traffic**,
- è il ponte tra **Interceptor → Ontologia**,
- fornisce evidenze direttamente interrogabili via SPARQL,
- abilita correlazioni con:    
    - Techstack (host, header),
    - Analyzer (pageUrl, script).

Insieme, i tre resolver costituiscono una **pipeline multilivello**:
- **HTTP** → protocollo e input,
- **Analyzer** → codice e markup,
- **Techstack** → configurazione e CVE.

---