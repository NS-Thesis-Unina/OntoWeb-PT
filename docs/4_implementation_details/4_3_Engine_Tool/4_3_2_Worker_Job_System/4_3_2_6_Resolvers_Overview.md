# Resolvers Overview
---

- [Techstack Resolver](./4_3_2_6_Resolvers_Overview/4_3_2_6_1_Techstack_Resolver.md)
- [Analyzer Resolver](./4_3_2_6_Resolvers_Overview/4_3_2_6_2_Analyzer_Resolver.md)
- [Http Resolver](./4_3_2_6_Resolvers_Overview/4_3_2_6_3_Http_Resolver.md)

---

Questo documento introduce i **tre resolver** usati dal Worker Job System. I resolver sono moduli di analisi “puri” (o quasi) che prendono in input artefatti già raccolti (HTTP capture, HTML, script, metadati) e producono un output normalizzato, in particolare una lista di **findings**.

Nel sistema complessivo, i resolver hanno lo scopo di:
- **Derivare conoscenza** dai dati grezzi (es. richieste HTTP, pagina HTML, script JS).
- **Uniformare i risultati** in un formato comune (Finding/Evidence) compatibile con il mapping RDF/ontologia.
- **Separare responsabilità**: il worker orchestration (job, retry, persistenza, eventi) resta distinto dalla logica di detection (resolver + regole).

---

## Come vengono usati dal Worker

A livello di job, il worker:
1. riceve un payload (per esempio una lista di richieste HTTP o gli artefatti di una pagina),
2. invoca il resolver appropriato,
3. prende `result.findings`,
4. persiste i findings in GraphDB tramite i builder (es. `buildInsertFromFindingsArray`) e `runUpdate`,
5. emette eventi di progresso/completamento su WebSocket (monitorabilità end-to-end).

Questa separazione rende possibile:
- testare i resolver in isolamento (input → output),
- aggiornare le regole di detection senza toccare la pipeline di job,
- riusare gli stessi findings sia per storage/ontologia sia per UI e reporting.

---

## I tre resolver disponibili

### 1) Techstack Resolver (`resolveTechstack`)

Resolver orientato a **tecnologie e posture di sicurezza “di contesto”**:
- correla tecnologie/WAF con vulnerabilità note (lookup su **NVD**, con rate limiting e retry su 429),
- classifica **security headers** (HSTS, CSP, X-Frame-Options, ecc.) producendo raccomandazioni e remediation,
- analizza **cookie** (Secure/HttpOnly/SameSite, scadenze, terze parti) e produce finding per issue.

Output: findings di tipo techstack (es. `TechnologyCVE`, `WafCVE`, `HeaderIssue`, `CookieIssue`) con severity normalizzata e remediation quando disponibile.

---

### 2) Analyzer Resolver (`resolveAnalyzer`)

Resolver di tipo **SAST leggero** applicato agli artefatti della pagina:
- esegue regole statiche e HTML-level (inline handlers, iframe srcdoc/base64, form rischiosi, ecc.),
- analizza JavaScript con parsing AST (acorn) e regole statiche + regole di **taint-flow** (sorgenti → sink),
- arricchisce i findings con un **contextVector** (script/form/iframe/html) e, opzionalmente, snippet (se `includeSnippets=true`),
- produce identificatori stabili (`findingId`) utili per IRIs e deduplicazione.

Output: findings “analyzer” (SAST) con statistiche per severità e per contesto.

---

### 3) HTTP Resolver (`analyzeHttpRequests`)

Resolver orientato alle **richieste/risposte HTTP** già ingestite:
- applica un set di regole “ontology-aware” basate su OWASP Top 10 (token in URL, stacktrace leak, CORS permissivo, mixed content, cookie insicuri, pattern di injection, open redirect, ecc.),
- per ogni match produce **evidence strutturata** (header/param/cookie/body/transport) con indici,
- costruisce un **httpContext** arricchito con IRIs (Request/URI/Response/Header/Param) così da collegare il finding alle risorse RDF già presenti in GraphDB.

Output: findings “http-resolver” che mantengono sia la parte diagnostica (evidence grezza) sia i collegamenti semantici (IRIs pronti per RDF).

---