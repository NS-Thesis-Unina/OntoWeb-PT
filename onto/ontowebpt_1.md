# ontowebpt_1.rdf

L’ontologia **OntoWebPT** (versione `1.0.1`) è progettata per rappresentare:

- il dominio **HTTP** (richieste, risposte, URI, header, metodi, status code…),
- una tassonomia di **vulnerabilità**,
- i **risultati (findings)** prodotti da tre motori di analisi (“resolver”):
    - analisi del tech stack,
    - analisi statica HTML/JavaScript,
    - analisi del traffico HTTP.

L’ontologia mantiene intatto il modello HTTP di base e aggiunge, “sopra”, un livello semantico per descrivere in modo strutturato le vulnerabilità rilevate.

---

## 1\. Struttura generale e namespace

- **Namespace base**: `http://localhost/onto/ontowebpt#`
- **Versione**: `http://localhost/onto/ontowebpt/1.0.1`
- L’ontologia è espressa in OWL (OWL 2 DL) in sintassi RDF/XML.

La modellazione è organizzata in tre blocchi principali:

1.  **Dominio HTTP**  
    Classi e proprietà per richieste, risposte, header, URI, connessioni, cookie, metodi, codici di stato.
2.  **Dominio sicurezza / vulnerabilità**  
    Tassonomia astratta di vulnerabilità (XSS, SQLi, ecc.) e vulnerabilità concrete identificate da CVE.
3.  **Resolver e Findings**  
    Modello dei motori di analisi (resolver) e dei findings da essi generati, collegati al mondo HTTP e ai tipi di vulnerabilità.

---

## 2\. Modello HTTP

### 2.1 Classe radice HTTP

- `HTTP`  
    Classe di alto livello per tutte le entità legate al protocollo HTTP.  
    Vi appartengono, direttamente o indirettamente, messaggi, header, URI, status code, cookie, ecc.

### 2.2 Messaggi HTTP

- `Message` **⊑ HTTP**  
    Rappresenta un generico **messaggio HTTP**.  
    È la super-classe di:
    - `Request` **⊑ Message**
        - Descrive una **richiesta HTTP**.
        - È disgiunta da `Response`.
        - È tipicamente associata a:
            - un metodo (`mthd` → `Methods`),
            - un URI (`uriRequest` → `URI`),
            - una risposta (`resp` → `Response`),
            - header di richiesta (`reqHeader` → `RequestHeader`),
            - header di payload (`payHeader`),
            - header di rappresentazione (`repHeader`).
    - `Response` **⊑ Message**
        - Descrive una **risposta HTTP**.
        - È associata a:
            - uno status code (`sc` → `StatusCodes`),
            - header di risposta (`resHeader` → `ResponseHeader`),
            - header di payload (`payHeader`),
            - header di rappresentazione (`repHeader`).

### 2.3 Header HTTP

- `MessageHeader` **⊑ HTTP**  
    Super-classe per tutti gli header HTTP.

Sottoclassi (tutte dichiarate **mutuamente disgiunte**):

- \*\*`RequestHeader` ⊑ MessageHeader`** Header specifici della richiesta (es.` Host`,` User-Agent`,` Cookie\`).
- \*\*`ResponseHeader` ⊑ MessageHeader`** Header specifici della risposta (es.` Set-Cookie`,` Server\`).
- \*\*`PayloadHeaders` ⊑ MessageHeader`** Header relativi al payload e al trasferimento (es.` Content-Length`,` Transfer-Encoding\`).
- \*\*`RepresentationHeaders` ⊑ MessageHeader`** Header che descrivono la rappresentazione (es.` Content-Type`,` Content-Language\`).

Ogni header è descritto da:

- `fieldName` (xsd:string) — nome dell’header (es. `"Content-Type"`),
- `fieldValue` (rdfs:Literal) — valore dell’header.

### 2.4 URI e parametri

- `URI` **⊑ HTTP\`**  
    Modella un URI utilizzato nelle richieste HTTP.Proprietà dati associate:
    
    - `uri` (xsd:string): rappresentazione completa dell’URI.
    - `scheme` (xsd:string): schema (`"http"`, `"https"`).
    - `authority` (rdfs:Literal): autorità (es. `"example.com:443"`).
    - `path` (xsd:string): path (`"/login"`).
    - `query` (rdf:XMLLiteral): componente query.
    - `fragment` (xsd:string): frammento (`"#section"`).
    
    Proprietà oggetto:
    - `param` (URI → Parameter): associa un URI a uno dei suoi parametri.
- `Parameter` **⊑ HTTP\`**  
    Rappresenta un singolo parametro (query o simile).
    - `nameParameter` (xsd:string) — nome (es. `"user"`),
    - `valueParameter` (rdfs:Literal) — valore (es. `"alice"`).

### 2.5 Metodi HTTP

- `Methods` **⊑ HTTP\`**  
    Rappresenta i metodi HTTP come entità.Proprietà:
    
    - `methodName` (xsd:string) — nome letterale del metodo, es. `"GET"`.
    
    Individui predefiniti:
    
    - `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`, `HEAD`, `TRACE`, `CONNECT`.
    
    Ogni `Request` è collegata a un metodo tramite:
    - `mthd` (Request → Methods).

### 2.6 Codici di stato

- `StatusCodes` **⊑ HTTP\`**  
    Rappresenta gli status code HTTP.Proprietà dati:
    - `statusCodeNumber` (xsd:int) — ad es. `200`, `404`, `500`.
    - `reasonPhrase` (xsd:string) — es. `"OK"`, `"Not Found"`.

Una `Response` è collegata al proprio status tramite:

- `sc` (Response → StatusCodes).

### 2.7 Connessione e HTML

- `Connection` **⊑ HTTP\`**  
    Modella la connessione sottostante (host/porta di trasporto).
    - `connectionAuthority` (rdfs:Literal) — rappresentazione dell’endpoint di connessione.
- `HTML`  
    Rappresenta contenuto HTML associabile a messaggi o findings, ad esempio come risorsa separata quando si vuole tenere traccia dell’HTML analizzato.

### 2.8 Cookie

- \*\*`Cookie` ⊑ HTTP`** Modella un cookie osservato (da header` Set-Cookie\` o API del browser).Proprietà dati:
    - `cookieName` (xsd:string) — nome del cookie.
    - `cookieDomain` (xsd:string) — dominio del cookie.

Questa classe è usata soprattutto in combinazione con i findings tecnici sullo stack (si veda `CookieFinding`).

### 2.9 Altre classi generiche

- `HeaderType` **⊑ HTTP\`**  
    Classe astratta per eventuali classificazioni di header (non usata direttamente nei collegamenti core).
- `Goals`  
    Classe generica di placeholder per obiettivi o concetti astratti non specificamente modellati; non è collegata direttamente al resto del modello.

---

## 3\. Tassonomia delle vulnerabilità

Per modellare i tipi di vulnerabilità, l’ontologia introduce una gerarchia dedicata.

- `Vulnerabilities`  
    Radice astratta di tutti i tipi di vulnerabilità.

Sottoclassi principali:

- `XSS` **⊑ Vulnerabilities\`**  
    Rappresenta vulnerabilità di Cross-Site Scripting.Sottoclassi:
    - `DOM-based_XSS` — XSS lato client, derivata da manipolazione del DOM.
    - `Reflected_XSS` — XSS riflesso.
    - `Stored_XSS` — XSS memorizzato.
- `SQLi` **⊑ Vulnerabilities\`**  
    Vulnerabilità di SQL Injection.
- `OpenRedirect` **⊑ Vulnerabilities\`**  
    Vulnerabilità di open redirect.
- \*\*`PathTraversal` ⊑ Vulnerabilities`** Vulnerabilità di path traversal (pattern` ../\` e simili).
- `CVEVulnerability` **⊑ Vulnerabilities\`**  
    Rappresenta una vulnerabilità concreta identificata da un **CVE**, tipicamente recuperata da database esterni (es. NVD).Proprietà dati:
    - `cveId` (xsd:string) — identificatore CVE (es. `"CVE-2023-12345"`).
    - `cvssScore` (xsd:float) — punteggio CVSS di base.
    - `cvssSeverity` (xsd:string) — severità testuale CVSS (es. `"HIGH"`, `"CRITICAL"`).

---

## 4\. Resolver: modellazione dei motori di analisi

Per rappresentare i motori che producono findings, l’ontologia introduce il concetto di _resolver_.

- `Resolver`  
    Classe astratta per motori che analizzano dati HTTP correlati e producono `Finding`.

Sottoclassi specializzate:

- `AnalyzerResolver` **⊑ Resolver\`**
    - Modella il motore di analisi statica su HTML/JavaScript (analisi di script, form, iframe, eventi inline, taint analysis, ecc.).
- `TechstackResolver` **⊑ Resolver\`**
    - Modella il motore che analizza lo stack tecnologico (tecnologie, WAF, secure headers, cookies) e associa CVE, livelli di rischio e remediation.
- `HttpResolver` **⊑ Resolver\`**
    - Modella il motore che analizza le richieste/risposte HTTP per rilevare pattern sospetti: HTTP non sicuro, CORS permissivo, leakage di stack trace, parametri di redirect, pattern tipici di SQLi/XSS, ecc.

Individui di comodo:

- `AnalyzerResolverInstance` a `AnalyzerResolver`
- `TechstackResolverInstance` a `TechstackResolver`
- `HttpResolverInstance` a `HttpResolver`

Questi individui rappresentano i motori “reali” in esecuzione e sono referenziati dai findings tramite la proprietà `detectedByResolver`.

---

## 5\. Findings: rappresentazione dei risultati di analisi

Il concetto di _Finding_ è il cuore della parte di sicurezza: ogni finding rappresenta **una singola evidenza** di potenziale vulnerabilità o misconfigurazione.

### 5.1 Classe base `Finding`

- `Finding`  
    Classe generica per findings prodotti da qualsiasi resolver.

Proprietà dati comuni:

- `severity` (xsd:string) — livello di gravità, es. `"high"`, `"medium"`, `"low"`, `"info"`.
- `findingRuleId` (xsd:string) — identificatore della regola che ha generato il finding (es. `"no-eval"`, `"sql-injection-pattern"`).
- `findingCategory` (xsd:string) — categoria logica del finding (es. `"DOM XSS"`, `"Injection"`, `"Transport Security"`).
- `findingDescription` (xsd:string) — descrizione testuale del finding.
- `remediation` (xsd:string) — suggerimento di mitigazione.
- `owaspCategory` (xsd:string) — riferimento alla categoria OWASP Top 10 (es. `"A03:2021 – Injection"`).
- `sourceFile` (xsd:string) — file/script/documento in cui è stato rilevato il problema (es. `"inline-script[#0]"`, `"HTML Document"`).
- `sourceLocation` (xsd:string) — informazione di posizione (linea/colonne, intervallo) nel sorgente.
- `sourceName` (xsd:string) — espressione sorgente o variabile di input (nei casi di taint analysis).
- `sinkName` (xsd:string) — sink raggiunto dal dato contaminato (innerHTML, eval, location, ecc.).

Proprietà oggetto:

- `detectedByResolver` (Finding → Resolver)  
    Collega ogni finding al resolver che lo ha prodotto.
- `aboutVulnerabilityType` (Finding → Vulnerabilities)  
    Collega il finding a una **categoria di vulnerabilità** (es. `SQLi`, `XSS`, `CVEVulnerability`).
- `relatedToHTTP` (Finding → HTTP)  
    Collega il finding a un’entità HTTP generica (Request, Response, Header, URI, Cookie, ecc.), se si desidera un legame più specifico oltre alle proprietà dedicate.

### 5.2 Specializzazioni di Finding

#### 5.2.1 `HttpFinding`

- `HttpFinding` **⊑ Finding\`**  
    Findings derivati dall’analisi del traffico HTTP (richieste/risposte).

Proprietà dati specifiche:

- `requestUrl` (xsd:string) — URL completo della richiesta associata al finding.
- `httpMethod` (xsd:string) — metodo HTTP ("GET", "POST", ...).
- `responseStatus` (xsd:int) — status code della risposta.

Collegamento con la richiesta:

- `hasHttpFinding` (Request → HttpFinding)  
    — relaziona una richiesta a uno o più findings HTTP.
- `httpFindingOfRequest` (HttpFinding → Request)  
    — inversa di `hasHttpFinding`.

Questo permette query del tipo “tutte le richieste con SQLi rilevata” o “tutti i findings associati a questa specifica request”.

#### 5.2.2 `AnalyzerFinding`

- `AnalyzerFinding` **⊑ Finding\`**  
    Findings derivati dall’analisi statica di HTML/JS.

Proprietà dati aggiuntive:

- `contextType` (xsd:string)  
    — contesto in cui è stato rilevato il problema: `"script"`, `"form"`, `"iframe"`, `"html"`, `"html-inline-handler"`, `"unknown"`, ecc.
- `contextIndex` (xsd:int)  
    — indice dell’elemento (es. posizione in `scripts[]`, `forms[]`, `iframes[]`).
- `contextOrigin` (xsd:string)  
    — origine del codice: `"inline"`, `"external"`, `"markup"`…
- `contextSrc` (xsd:string)  
    — sorgente associata (es. `src` dello script o dell’iframe).
- `formAction` (xsd:string)  
    — URL di action del form associato.
- `formMethod` (xsd:string)  
    — metodo HTTP del form (`"GET"`, `"POST"`).
- `codeSnippet` (xsd:string)  
    — spezzone di codice relativo alla location del finding.

Queste proprietà consentono di ricostruire con precisione dove e in che contesto è stato rilevato il problema (es: eval dentro uno script inline, form con action esterna, iframe con srcdoc pericoloso, ecc.).

#### 5.2.3 `TechstackFinding`

- `TechstackFinding` **⊑ Finding\`**  
    Findings derivati dall’analisi dello stack tecnologico: tecnologie, WAF, secure headers, cookie, CVE.

Sottoclassi:

- \*\*`CookieFinding` ⊑ TechstackFinding`** Findings specifici sui cookie (mancanza di` Secure`/`HttpOnly\`, SameSite, durata eccessiva, cookie di terza parte, ecc.).Collegamento:
    - `refersToCookie` (CookieFinding → Cookie)  
        — indica il cookie a cui il finding si riferisce.
- `HeaderFinding` **⊑ TechstackFinding\`**  
    Findings relativi agli HTTP security header (STS, CSP, X-Frame-Options, X-Content-Type-Options, ecc.).Collegamento:
    - `refersToHeader` (HeaderFinding → MessageHeader)  
        — indica l’header specifico coinvolto.
- \*\*`SoftwareFinding` ⊑ TechstackFinding`** Findings relativi a componenti software/WAF per i quali esistono CVE noti. Tipicamente collegati a` CVEVulnerability`tramite`aboutVulnerabilityType\`.

---

## 6\. Proprietà oggetto principali (riassunto)

- `mthd` (Request → Methods)  
    Metodo HTTP della richiesta.
- `uriRequest` (Request → URI)  
    URI a cui la richiesta è indirizzata.
- `resp` (Request → Response)  
    Risposta associata alla richiesta.
- `sc` (Response → StatusCodes)  
    Status code della risposta.
- `reqHeader` (Request → RequestHeader)
- `resHeader` (Response → ResponseHeader)
- `payHeader` (Message → PayloadHeaders)
- `repHeader` (Message → RepresentationHeaders)
- `param` (URI → Parameter)
- `detectedByResolver` (Finding → Resolver)
- `aboutVulnerabilityType` (Finding → Vulnerabilities)
- `relatedToHTTP` (Finding → HTTP)
- `refersToCookie` (CookieFinding → Cookie)
- `refersToHeader` (HeaderFinding → MessageHeader)
- `hasHttpFinding` (Request → HttpFinding)  
    con inversa `httpFindingOfRequest` (HttpFinding → Request).

---

## 7\. Esempi di utilizzo

Gli esempi seguenti sono in sintassi Turtle per leggibilità.

### 7.1 Modellazione di una richiesta HTTP con risposta

```
@prefix : <http://localhost/onto/ontowebpt#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

:Request_req123 a :Request ;
  :id "req-123" ;
  :httpVersion "HTTP/1.1" ;
  :mthd :GET ;
  :uriRequest :URI_req123 ;
  :reqHeader :H_Host_req123, :H_UA_req123 ;
  :resp :Response_res123 .

:URI_req123 a :URI ;
  :uri "https://example.com/search?q=test" ;
  :scheme "https" ;
  :authority "example.com" ;
  :path "/search" .

:H_Host_req123 a :RequestHeader ;
  :fieldName "Host" ;
  :fieldValue "example.com" .

:H_UA_req123 a :RequestHeader ;
  :fieldName "User-Agent" ;
  :fieldValue "Mozilla/5.0 ..." .

:Response_res123 a :Response ;
  :httpVersion "HTTP/1.1" ;
  :sc :Status_200 ;
  :resHeader :H_Server_res123 .

:Status_200 a :StatusCodes ;
  :statusCodeNumber 200 ;
  :reasonPhrase "OK" .

:H_Server_res123 a :ResponseHeader ;
  :fieldName "Server" ;
  :fieldValue "nginx/1.20.0" .
```

---

### 7.2 Finding HTTP: pattern di SQL Injection

Un finding generato dall’analisi del traffico HTTP su una query sospetta.

```
:HttpFinding_req123_sql1 a :HttpFinding ;
  :findingRuleId "sql-injection-pattern" ;
  :severity "high" ;
  :findingCategory "Injection" ;
  :findingDescription "Suspicious SQL keywords found in query parameters." ;
  :owaspCategory "A03:2021 – Injection" ;
  :requestUrl "https://example.com/search?q=test+UNION+SELECT+1" ;
  :httpMethod "GET" ;
  :responseStatus 200 ;
  :detectedByResolver :HttpResolverInstance ;
  :aboutVulnerabilityType :SQLi ;
  :httpFindingOfRequest :Request_req123 .
```

In questo scenario:

- `Request_req123` è la richiesta HTTP,
- `HttpFinding_req123_sql1` è il finding generato dal resolver HTTP,
- il finding è legato alla vulnerabilità `SQLi` e al resolver `HttpResolverInstance`.

---

### 7.3 Finding Analyzer: uso di `eval` in uno script inline

```
:AnalyzerFinding_eval_1 a :AnalyzerFinding ;
  :findingRuleId "no-eval" ;
  :severity "high" ;
  :findingCategory "Code Injection" ;
  :findingDescription "Disallow use of eval() to prevent remote code execution." ;
  :owaspCategory "A03:2021 – Injection" ;
  :sourceFile "inline-script[#0]" ;
  :sourceLocation "lines 12-16" ;
  :sourceName "userInput" ;
  :sinkName "eval(…)" ;
  :codeSnippet "eval(userInput);" ;
  :contextType "script" ;
  :contextIndex 0 ;
  :contextOrigin "inline" ;
  :contextSrc "" ;
  :detectedByResolver :AnalyzerResolverInstance ;
  :aboutVulnerabilityType :XSS ;
  :relatedToHTTP :Request_req123 .
```

Qui il finding:

- è in un contesto `script` inline (`contextType`, `contextOrigin`),
- riguarda un potenziale XSS/Code Injection,
- è collegato sia al resolver di analisi (`AnalyzerResolverInstance`) sia alla richiesta HTTP da cui proviene l’HTML (`relatedToHTTP`).

---

### 7.4 Finding Techstack: cookie di sessione non sicuro

```
:Cookie_sessionid a :Cookie ;
  :cookieName "sessionid" ;
  :cookieDomain ".example.com" .

:CookieFinding_session_httponly a :CookieFinding ;
  :findingRuleId "missing_httponly" ;
  :severity "high" ;
  :findingCategory "XSSDataTheft" ;
  :findingDescription "Cookie accessible from JavaScript." ;
  :remediation "Set HttpOnly flag." ;
  :owaspCategory "A07:2021 – Identification and Authentication Failures" ;
  :detectedByResolver :TechstackResolverInstance ;
  :refersToCookie :Cookie_sessionid ;
  :aboutVulnerabilityType :Vulnerabilities .
```

Questo permette di interrogare:

- tutti i cookie con problemi di configurazione,
- tutti i findings prodotti dal resolver Techstack,
- tutti i findings relativi a `A07:2021`.

---

### 7.5 CVE associata a una tecnologia

```
:CVE_2019_0211 a :CVEVulnerability ;
  :cveId "CVE-2019-0211" ;
  :cvssScore 9.8 ;
  :cvssSeverity "CRITICAL" .

:SoftwareFinding_apache a :SoftwareFinding ;
  :findingRuleId "nvd-cve-match" ;
  :severity "high" ;
  :findingCategory "KnownVulnerability" ;
  :findingDescription "Apache HTTP Server has known critical CVEs in this version." ;
  :owaspCategory "A05:2021 – Security Misconfiguration" ;
  :detectedByResolver :TechstackResolverInstance ;
  :aboutVulnerabilityType :CVE_2019_0211 .
```

---

## 8\. Esempi di query SPARQL

### 8.1 Tutte le richieste con SQLi rilevata

```
PREFIX : <http://localhost/onto/ontowebpt#>

SELECT ?req ?url ?status
WHERE {
  ?req a :Request ;
       :hasHttpFinding ?f .

  ?f  a :HttpFinding ;
      :aboutVulnerabilityType :SQLi ;
      :requestUrl ?url ;
      :responseStatus ?status .
}
```

### 8.2 Tutti i cookie insicuri (severity HIGH o MEDIUM)

```
PREFIX : <http://localhost/onto/ontowebpt#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?cookieName ?domain ?severity
WHERE {
  ?f a :CookieFinding ;
     :severity ?severity ;
     :refersToCookie ?c .

  FILTER (?severity = "high" || ?severity = "medium")

  ?c :cookieName ?cookieName ;
     :cookieDomain ?domain .
}
```

### 8.3 Tutti i findings prodotti dal resolver Analyzer

```
PREFIX : <http://localhost/onto/ontowebpt#>

SELECT ?finding ?rule ?sev ?file ?loc
WHERE {
  ?finding a :AnalyzerFinding ;
           :detectedByResolver :AnalyzerResolverInstance ;
           :findingRuleId ?rule ;
           :severity ?sev ;
           :sourceFile ?file ;
           :sourceLocation ?loc .
}
ORDER BY ?sev
```

# Esempi di output dei resolver in JSON

Questi output saranno poi elaborati e inseriti nell’ontologia in base alla struttura spiegata sopra.

## 1\. Esempio output Techstack resolver (`resolveTechstack`)

```
{
  "analyzedAt": "2025-11-18T16:30:12.345Z",
  "technologies": [
    {
      "name": "WordPress",
      "version": "6.5.5",
      "cve": [
        {
          "id": "CVE-2023-12345",
          "severity": "HIGH",
          "score": 8.8
        },
        {
          "id": "CVE-2022-98765",
          "severity": "MEDIUM",
          "score": 5.4
        }
      ],
      "cpe": [
        "cpe:2.3:a:wordpress:wordpress:6.5.5:*:*:*:*:*:*:*"
      ],
      "hasKnownCVE": true
    },
    {
      "name": "nginx",
      "version": "1.20.0",
      "cve": [],
      "cpe": [],
      "hasKnownCVE": false
    }
  ],
  "waf": [
    {
      "name": "Cloudflare",
      "hasKnownCVE": true,
      "cve": [
        {
          "id": "CVE-2021-11111",
          "severity": "HIGH",
          "score": 7.5
        }
      ],
      "cpe": [
        "cpe:2.3:a:cloudflare:cloudflare:*:*:*:*:*:*:*:*"
      ]
    }
  ],
  "secureHeaders": [
    {
      "header": "Strict-Transport-Security",
      "description": "HSTS header present but misconfigured",
      "urls": [
        "https://example.com/"
      ],
      "risk": "HIGH",
      "remediation": "Add header: Strict-Transport-Security: max-age=31536000; includeSubDomains"
    },
    {
      "header": "X-Frame-Options",
      "description": "",
      "urls": [],
      "risk": "MEDIUM",
      "remediation": "Replace with Content-Security-Policy: frame-ancestors 'none' (X-Frame-Options is deprecated)"
    },
    {
      "header": "X-Content-Type-Options",
      "description": "",
      "urls": [],
      "risk": "MEDIUM",
      "remediation": "Add header: X-Content-Type-Options: nosniff to prevent MIME-type sniffing"
    },
    {
      "header": "X-XSS-Protection",
      "description": "",
      "urls": [],
      "risk": "LOW",
      "remediation": "Header obsolete: remove or replace with proper CSP configuration"
    }
  ],
  "cookies": [
    {
      "name": "sessionid",
      "domain": ".example.com",
      "issues": [
        {
          "rule": "missing_secure",
          "risk": "HIGH",
          "category": "SessionHijacking",
          "description": "Cookie not marked as Secure — can be sent over HTTP.",
          "remediation": "Set Secure flag."
        },
        {
          "rule": "missing_httponly",
          "risk": "HIGH",
          "category": "XSSDataTheft",
          "description": "Cookie accessible from JavaScript.",
          "remediation": "Set HttpOnly flag."
        },
        {
          "rule": "missing_samesite",
          "risk": "MEDIUM",
          "category": "CSRF",
          "description": "Cookie lacks SameSite protection.",
          "remediation": "Set SameSite=Lax or Strict."
        },
        {
          "rule": "unprotected_session_cookie",
          "risk": "HIGH",
          "category": "SessionExposure",
          "description": "Sensitive cookie (sessionid) lacks proper flags.",
          "remediation": "Ensure both Secure and HttpOnly are set."
        }
      ]
    },
    {
      "name": "tracking",
      "domain": "ads.thirdparty.com",
      "issues": [
        {
          "rule": "third_party_cookie",
          "risk": "LOW",
          "category": "ThirdPartyTracking",
          "description": "Cookie from third-party domain ads.thirdparty.com.",
          "remediation": "Check necessity and GDPR compliance."
        },
        {
          "rule": "long_expiry",
          "risk": "LOW",
          "category": "PrivacyPersistence",
          "description": "Cookie persists for over 1 year.",
          "remediation": "Shorten cookie lifetime."
        }
      ]
    }
  ]
}
```

---

## 2\. Esempio output Analyzer resolver (`resolveAnalyzer`)

```
{
  "ok": true,
  "totalFindings": 3,
  "stats": {
    "high": 1,
    "medium": 2,
    "low": 0
  },
  "summary": {
    "scripts": 2,
    "forms": 1,
    "iframes": 0,
    "html": 0
  },
  "findings": [
    {
      "ruleId": "no-eval",
      "description": "Disallow use of eval() to prevent remote code execution.",
      "severity": "high",
      "category": "Code Injection",
      "owasp": "A03:2021 – Injection",
      "file": "inline-script[#0]",
      "type": "CallExpression",
      "location": {
        "start": { "line": 12, "column": 8 },
        "end": { "line": 12, "column": 25 }
      },
      "snippet": "const data = eval(userInput);",
      "contextVector": {
        "type": "script",
        "index": 0,
        "origin": "inline",
        "src": null
      }
    },
    {
      "ruleId": "html-inline-event",
      "description": "Inline event handler detected.",
      "severity": "medium",
      "category": "Inline Script Injection",
      "owasp": "A03:2021 – Injection",
      "file": "HTML Document",
      "location": {
        "start": { "line": 20, "column": 5 },
        "end": { "line": 20, "column": 16 }
      },
      "contextVector": {
        "type": "html-inline-handler",
        "index": 0,
        "origin": "markup"
      }
    },
    {
      "ruleId": "taint-flow",
      "description": "Detect flow of untrusted input into dangerous sinks without sanitization.",
      "severity": "high",
      "type": "AssignmentExpression",
      "sourceName": "location.search",
      "sinkName": "innerHTML",
      "location": {
        "start": { "line": 33, "column": 4 },
        "end": { "line": 33, "column": 42 }
      },
      "file": "inline-script[#1]",
      "snippet": "element.innerHTML = location.search;",
      "contextVector": {
        "type": "script",
        "index": 1,
        "origin": "inline",
        "src": null
      }
    }
  ]
}
```

---

## 3\. Esempio output HTTP resolver (`analyzeHttpRequests`)

```
{
  "ok": true,
  "totalFindings": 2,
  "stats": {
    "high": 1,
    "medium": 1,
    "low": 0
  },
  "findings": [
    {
      "ruleId": "insecure-http",
      "severity": "high",
      "description": "Request sent over HTTP instead of HTTPS.",
      "category": "Transport Security",
      "owasp": "A05:2021 – Security Misconfiguration",
      "url": "http://example.com/login?user=alice",
      "method": "POST",
      "responseStatus": 301
    },
    {
      "ruleId": "sql-injection-pattern",
      "severity": "high",
      "description": "Suspicious SQL keywords found in query parameters.",
      "category": "Injection",
      "owasp": "A03:2021 – Injection",
      "url": "https://example.com/search?q=test+UNION+SELECT+1",
      "method": "GET",
      "responseStatus": 200
    }
  ]
}
```