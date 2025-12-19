# Techstack Resolver
---

Questo documento descrive il **Techstack Resolver** (`resolveTechstack`) usato dal Worker. Il suo scopo è trasformare segnali “di contesto” (tecnologie rilevate, WAF, security headers, cookie) in una lista di **findings normalizzati**, pronti per essere persistiti e mappati nell’ontologia.

---

## 1) Entrypoint e contratto

**Funzione principale**
- `resolveTechstack({ technologies, waf, secureHeaders, cookies, mainDomain })`

**Input (alto livello)**
- `technologies`: lista `{ name, version? }`
- `waf`: lista `{ name? }`
- `secureHeaders`: lista `{ header, description?, urls? }`
- `cookies`: lista `{ name, domain?, path?, secure?, httpOnly?, sameSite?, expirationDate? }`
- `mainDomain`: stringa usata per arricchire i findings e per l’analisi “third-party”

**Output**

- `{ ok: true, resolver: {...}, analyzedAt, summary, stats, findings, technologies, waf, secureHeaders, cookies }`

Note:
- `findings` è l’output “canonico” (quello da salvare come Finding).
- `technologies / waf / secureHeaders / cookies` sono mantenuti anche come aggregati di evidenze/compatibilità.

---

## 2) Struttura del resolver e pipeline di analisi

Il resolver segue una pipeline deterministica:

1. **Bootstrap**
    - `analyzedAt = new Date().toISOString()`
    - inizializza `findings[]`, `stats` e contatore `totalFindings`
    - definisce `pushFinding(f)` che:
        - aggiunge `mainDomain` nel finding,
        - normalizza e conta le metriche (`bySeverity`, `byCategory`, `byKind`)
2. **Technologies → NVD lookup → Findings**
    - per ogni tecnologia con `name` e `version` (se `version` manca, non fa lookup)
    - chiama `lookupNvd(name, version)`
    - per ogni CVE trovato emette un finding:
        - `kind: "TechnologyCVE"`
        - `category: "TechnologyVulnerability"`
        - `rule: "nvd_cve_match"`
        - `evidence: { type:"Technology", name, version, cpe:[...] }`
3. **WAF → NVD lookup → Findings**
    - tramite `analyzeWaf(waf, pushFinding)`
    - per ogni CVE trovato emette un finding:
        - `kind: "WafCVE"`
        - `category: "WafVulnerability"`
        - `rule: "nvd_cve_match"`
        - `evidence: { type:"WAF", name, cpe:[...] }`
4. **Security headers → classificazione → Findings**
    - `classifyHeaders(secureHeaders)`
    - per ogni header classificato emette un finding:
        - `kind: "HeaderIssue"`
        - `category` dipendente dall’header (es. `TransportSecurity`, `ContentSecurityPolicy`, …)
        - `rule` specifica (es. `missing_hsts`, `missing_csp`, …)
        - `remediation` con suggerimento operativo
        - `evidence: { type:"Header", header, urls:[...] }`
5. **Cookies → analisi flags/dominio/scadenza → Findings**
    - `analyzeCookies(cookies, mainDomain)`
    - per ogni cookie “problematico” genera N issue; **ogni issue diventa un finding**:
        - `kind: "CookieIssue"`
        - `category` dipendente dall’issue (es. `CSRF`, `SessionExposure`, …)
        - `rule` dipendente dall’issue (es. `missing_secure`, `missing_httponly`, …)
        - `evidence: { type:"Cookie", name, domain, path, flags:{...}, expirationDate }`
        - `remediation` per issue

---

## 3) NVD lookup e rate limiting

Il resolver usa l’endpoint NVD:
- `NVD_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0"`
- query: `?keywordSearch=${encodeURIComponent(product + " " + version)}`

### 3.1 Rate limiting client-side

Per evitare 429 e rispettare le limitazioni:
- finestra: `NVD_WINDOW_MS = 30_000`
- limite senza API key: `NVD_LIMIT_NO_KEY = 5`
- limite con API key: `NVD_LIMIT_WITH_KEY = 50`
- API key opzionale: `process.env.NVD_API_KEY`

Implementazione:
- mantiene `nvdCallTimestamps[]` in-memory
- prima di chiamare NVD:
    - elimina i timestamp fuori finestra
    - se supera limite: `sleep(waitMs)` (calcolato con margine +100ms)
- invoca `axios.get` con:
    - `timeout: 15000`
    - header `apiKey` se presente `NVD_API_KEY`

### 3.2 Retry su HTTP 429

`lookupNvd()` implementa:
- `maxRetries = 2`
- backoff: `2000ms * (attempt+1)` (2s, poi 4s)
- se fallisce o non recupera: ritorna `{ cve: [], cpe: [] }` (resolver “best effort”, non blocca il job)

### 3.3 Normalizzazione CVSS / severità

Per ogni vulnerabilità:
- prova a leggere CVSS v3.1, v3.0 o v2 (prima disponibile)
- estrae:
    - `id` (CVE)
    - `score` (`baseScore`)
    - `severity` (`baseSeverity`) normalizzata tramite `normalizeSeverity()`

Output di `lookupNvd()` viene troncato:
- max 10 CVE
- max 10 CPE

---

## 4) Severity: normalizzazione e ordinamento “worst”

Il resolver introduce:
- `normalizeSeverity(severity)` → `CRITICAL|HIGH|MEDIUM|LOW|INFO|UNKNOWN`
- `SEVERITY_ORDER` per confronti (CRITICAL > HIGH > …)

Usi principali:
- classificazione headers (`risk` → `severity`)
- cookie analysis: calcolo `worstSeverity` aggregando issue multiple per lo stesso cookie

---

## 5) Classificazione security headers

`classifyHeaders(headers)` prende in input una lista di `{ header, description?, urls? }`  
e restituisce oggetti con:
- `risk` e `severity`
- `category`
- `rule`
- `remediation`
- più i campi informativi `header`, `description`, `urls`

Mapping implementato nel codice (principali):

- **HSTS**
    - header: `hsts` / `strict-transport-security`
    - `risk: HIGH`, `rule: missing_hsts`
    - remediation: aggiungere `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- **CSP**
    - header: `content-security-policy` / `csp`
    - `risk: HIGH`, `rule: missing_csp`
    - remediation: policy CSP restrittiva (esempio `default-src 'self'`)
- **X-Frame-Options**
    - `risk: MEDIUM`, `rule: deprecated_x_frame_options`
    - remediation: preferire `Content-Security-Policy: frame-ancestors ...`
- **X-Content-Type-Options**
    - `risk: MEDIUM`, `rule: missing_x_content_type_options`
    - remediation: `X-Content-Type-Options: nosniff`
- **X-XSS-Protection**
    - `risk: LOW`, `rule: deprecated_x_xss_protection`
    - remediation: rimuovere / sostituire con CSP

Gli header non riconosciuti restano con:
- `risk: INFO`
- `rule: generic_header_observation`
- remediation generica (“Review header policy manually”)

---

## 6) Analisi WAF

`analyzeWaf(wafList, collectFinding?)`:
- per ogni `{ name }`:
    - fa `lookupNvd(name)`
    - produce un summary:
        - `{ name, hasKnownCVE, cve:[...], cpe:[...] }`

Se è fornito un `collectFinding` (nel resolver è `pushFinding`) e sono presenti CVE:
- genera un finding per ogni CVE:
    - `id: "waf:${name}:${cve.id}"`
    - `kind: "WafCVE"`
    - `category: "WafVulnerability"`
    - `severity` e `score` dal CVSS
    - `evidence: { type:"WAF", name, cpe:[...] }`

---

## 7) Analisi cookie

`analyzeCookies(cookies, mainDomain)`:
- tratta assenze di flag (`secure/httpOnly/sameSite`) come “non presenti” (impostazione conservativa)
- per ogni cookie calcola una lista `issues[]`
- se `issues.length > 0` ritorna un elemento `TechstackCookieFinding` con:
    - `worstSeverity`
    - `issues[]` (ognuna con `rule, risk, severity, category, description, remediation`)

### 7.1 Issue implementate (regole)

- `missing_secure` (HIGH) → `SessionHijacking`
- `missing_httponly` (HIGH) → `XSSDataTheft`
- `missing_samesite` (MEDIUM) → `CSRF`
- `invalid_samesite_none` (HIGH) se `SameSite=None` senza `Secure` → `CSRFSessionLeak`
- `long_expiry` (LOW) se scadenza > 1 anno → `PrivacyPersistence`
- `third_party_cookie` (LOW) se `domain` non include `mainDomain` → `ThirdPartyTracking`
- `unprotected_session_cookie` (HIGH) se nome contiene `session|token|id` e manca `Secure` o `HttpOnly` → `SessionExposure`

### 7.2 Da cookieFinding a Finding (uno-a-molti)

Nel resolver:
- per ogni cookieFinding,
- per ogni issue,
- crea un finding con:
    - `id: "cookie:${domain || 'unknown'}:${name}:${issue.rule}"`
    - `kind: "CookieIssue"`
    - `category` dall’issue
    - `evidence` con flags e scadenza
    - `remediation` dall’issue

---

## 8) Identificatori e forma dei findings

Il resolver costruisce ID “stabili” e leggibili:
- Technology:
    - `tech:${name}:${version}:${cveId}`
- WAF:
    - `waf:${name}:${cveId}`
- Header:
    - `header:${headerLower}:${rule}`
- Cookie:
    - `cookie:${domainOrUnknown}:${cookieName}:${issueRule}`

Campi tipici nei findings:
- `id`
- `source: "techstack"`
- `kind`
- `rule`
- `severity` (normalizzata)
- `category`
- `message`
- `evidence: {...}`
- `remediation?`
- `score?` (per CVE)
- `mainDomain` (aggiunto dal resolver in `pushFinding`)

---

## 9) Summary e stats

### 9.1 `summary`

Calcola:
- `totalTechnologies`
- `technologiesWithKnownCVE`
- `totalWaf`
- `wafWithKnownCVE`
- `totalHeaderFindings` (conteggio header classificati)
- `totalCookieFindings` (somma issue su tutti i cookie)
- `totalFindings` (somma totale findings emessi)

### 9.2 `stats`

- `bySeverity` (conteggio per CRITICAL/HIGH/MEDIUM/LOW/INFO/UNKNOWN)
- `byCategory` (conteggio per categoria logica)
- `byKind` (conteggio per kind)

---

## 10) Logging e comportamento operativo

Namespace logger:
- `resolver:techstack`

Log principali:
- start: conteggio input (technologies/waf/headers/cookies)
- rate limit: log “sleeping …ms”
- retry 429: log warn con attempt/backoff
- end: log con `totalFindings` e `stats`

**Comportamento chiave**:
- il resolver è **robusto**: NVD down/429 non fa fallire l’intero job (ritorna lookup vuoti e prosegue).
- l’output è **uniforme**: findings + summary/stats, facile da persistere e osservare.

---