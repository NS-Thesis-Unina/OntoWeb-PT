// @ts-check

/** @typedef {import('../../_types/http/bindings/types').HttpRequest} HttpRequest */

const { EX } = require('../../constants');
const { escapeStringLiteral } = require('../../strings/escape');
const { iriFinding } = require('../../iri/finding');
const { iriHtmlTag, iriHtmlField } = require('../../iri/html');

function makeLocalName(raw) {
  return (
    String(raw || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'unknown'
  );
}

function iriCve(id) {
  return `${EX}CVE_${makeLocalName(id)}`;
}

function iriCpe(cpe) {
  return `${EX}CPE_${makeLocalName(cpe)}`;
}

function iriHeader(name) {
  return `${EX}Header_${makeLocalName(name)}`;
}

function iriCookie(domain, path, name) {
  const raw = [domain || '', path || '', name || ''].join('|');
  return `${EX}Cookie_${makeLocalName(raw)}`;
}

/**
 * Prova a estrarre un CVE id dal finding.
 * - prima guarda f.cveId
 * - poi prova a fare regex su f.id / f.message
 */
function extractCveIdFromFinding(f) {
  if (!f) return null;
  if (typeof f.cveId === 'string') return f.cveId;

  const candidates = [];
  if (typeof f.id === 'string') candidates.push(f.id);
  if (typeof f.message === 'string') candidates.push(f.message);

  for (const s of candidates) {
    const m = s.match(/CVE-\d{4}-\d+/i);
    if (m) return m[0].toUpperCase();
  }
  return null;
}

/**
 * Normalizza la severità in una stringa standardizzata (CRITICAL/HIGH/MEDIUM/LOW/INFO/UNKNOWN).
 *
 * @param {string} [severity]
 * @returns {string | null}
 */
function normalizeSeverity(severity) {
  if (!severity) return null;
  const up = String(severity).toUpperCase();
  const known = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', 'UNKNOWN'];
  return known.includes(up) ? up : 'UNKNOWN';
}

/**
 * Restituisce l'IRI dell'istanza di Resolver a partire dal "source" del finding.
 *
 * Usa gli individui definiti nell'ontologia:
 *  - ex:TechstackResolverInstance
 *  - ex:HttpResolverInstance
 *  - ex:AnalyzerResolverInstance
 *
 * @param {string} [source]
 * @returns {string | null} IRI tra < >
 */
function mapResolverInstanceIri(source) {
  if (!source) return null;
  const s = String(source).toLowerCase();
  if (s === 'techstack') return `<${EX}TechstackResolverInstance>`;
  if (s === 'http' || s === 'http-resolver') return `<${EX}HttpResolverInstance>`;
  if (s === 'analyzer' || s === 'sast') return `<${EX}AnalyzerResolverInstance>`;
  return null;
}

/**
 * Costruisce un id stabile per il finding se manca `findingId` / `id`.
 *
 * @param {any} f
 * @param {number} idx
 * @returns {string}
 */
function computeFindingKey(f, idx) {
  if (f && typeof f.findingId === 'string') return f.findingId;
  if (f && typeof f.id === 'string') return f.id;

  const source = f?.source || 'unknown';
  const rule = f?.ruleId || f?.rule || 'rule';
  const anchor = f?.requestId || f?.pageUrl || f?.url || `idx-${idx}`;

  return `${source}:${rule}:${anchor}`;
}

/**
 * Mappa un finding su una classe di Vulnerabilities (se deducibile).
 *
 * Usa stringhe come category / ruleId / message per capire se è XSS, SQLi, ecc.
 *
 * @param {any} f
 * @returns {string | null} IRI tra < > di una classe sotto ex:Vulnerabilities
 */
function mapVulnerabilityTypeIri(f) {
  const parts = [];

  if (f?.vulnType) parts.push(String(f.vulnType));
  if (f?.vulnerability) parts.push(String(f.vulnerability));
  if (f?.category) parts.push(String(f.category));
  if (f?.ruleId) parts.push(String(f.ruleId));
  if (f?.rule) parts.push(String(f.rule));
  if (f?.kind) parts.push(String(f.kind));
  if (f?.message) parts.push(String(f.message));
  if (f?.description) parts.push(String(f.description));

  const haystack = parts.join(' ').toLowerCase();
  if (!haystack) return null;

  // XSS varianti
  if (haystack.includes('dom') && haystack.includes('xss')) {
    return `<${EX}DOM-based_XSS>`;
  }
  if (haystack.includes('stored') && haystack.includes('xss')) {
    return `<${EX}Stored_XSS>`;
  }
  if (haystack.includes('reflected') && haystack.includes('xss')) {
    return `<${EX}Reflected_XSS>`;
  }
  if (haystack.includes('xss')) {
    return `<${EX}XSS>`;
  }

  // SQL Injection
  if (
    haystack.includes('sqli') ||
    haystack.includes('sql injection') ||
    haystack.includes('sql-injection')
  ) {
    return `<${EX}SQLi>`;
  }

  // Open Redirect
  if (haystack.includes('open redirect')) {
    return `<${EX}OpenRedirect>`;
  }

  // Path Traversal
  if (haystack.includes('path traversal') || haystack.includes('../')) {
    return `<${EX}PathTraversal>`;
  }

  return null;
}

/**
 * Aggiunge triple generiche (metadata comuni) per il finding, mappate
 * sulle proprietà già presenti nell'ontologia (Scan.*).
 *
 * @param {string[]} triples
 * @param {string} findingIri
 * @param {any} f
 */
function addGenericFindingTriples(triples, findingIri, f) {
  // Tipo generico: ogni finding è almeno uno Scan.
  triples.push(`${findingIri} a <${EX}Scan> .`);

  const message = f?.message || f?.description;
  if (message) {
    const msg = escapeStringLiteral(String(message));
    triples.push(
      `${findingIri} <http://www.w3.org/2000/01/rdf-schema#label> "${msg}" .`,
      // Mapping sull'ontologia: findingDescription
      `${findingIri} <${EX}findingDescription> "${msg}" .`
    );
  }

  if (f?.category) {
    triples.push(
      `${findingIri} <${EX}findingCategory> "${escapeStringLiteral(
        String(f.category)
      )}" .`
    );
  }

  if (f?.owasp) {
    triples.push(
      `${findingIri} <${EX}owaspCategory> "${escapeStringLiteral(
        String(f.owasp)
      )}" .`
    );
  }

  if (f?.ruleId || f?.rule) {
    triples.push(
      `${findingIri} <${EX}findingRuleId> "${escapeStringLiteral(
        String(f.ruleId || f.rule)
      )}" .`
    );
  }

  const sevNorm = normalizeSeverity(f?.severity);
  if (sevNorm) {
    triples.push(
      `${findingIri} <${EX}severity> "${escapeStringLiteral(sevNorm)}" .`
    );
  }

  if (f?.remediation) {
    triples.push(
      `${findingIri} <${EX}remediation> "${escapeStringLiteral(
        String(f.remediation)
      )}" .`
    );
  }

  const resolverIri = mapResolverInstanceIri(f?.source || f?.resolver);
  if (resolverIri) {
    triples.push(`${findingIri} <${EX}detectedByResolver> ${resolverIri} .`);
  }

  // Se riusciamo a riconoscere il tipo di Vulnerabilities, lo colleghiamo
  const vulnTypeIri = mapVulnerabilityTypeIri(f);
  if (vulnTypeIri) {
    triples.push(
      `${findingIri} <${EX}aboutVulnerabilityType> ${vulnTypeIri} .`
    );
  }
}

/**
 * Triples specifiche per Techstack (Technology/WAF/Header/Cookie).
 *
 * Wiring completo su ontowebpt 1.0.1:
 *  - finding a TechstackScan (sempre) + SoftwareFinding/HeaderFinding/CookieFinding (se applicabile)
 *  - CookieFinding → refersToCookie → Cookie
 *  - HeaderFinding → refersToHeader → MessageHeader
 *  - Technology/WAF CVE:
 *      * individui CPE / CVE
 *      * platformHasVulnerability (CPE → CVE)
 *      * aboutVulnerabilityType (Finding → CVE) [CVE ⊑ Vulnerabilities]
 *
 * @param {string[]} triples
 * @param {string} findingIri
 * @param {any} f
 */
function addTechstackTriples(triples, findingIri, f) {
  const ev = f?.evidence || {};
  const kind = f?.kind || null;

  // Tipizza come TechstackScan (sottoclasse di Scan)
  triples.push(`${findingIri} a <${EX}TechstackScan> .`);

  // Tipizzazioni più specifiche (tutte classi esistenti nell'ontologia)
  if (kind === 'TechnologyCVE' || kind === 'WafCVE') {
    triples.push(`${findingIri} a <${EX}SoftwareFinding> .`);
  } else if (kind === 'HeaderIssue') {
    triples.push(`${findingIri} a <${EX}HeaderFinding> .`);
  } else if (kind === 'CookieIssue') {
    triples.push(`${findingIri} a <${EX}CookieFinding> .`);
  }

  // ===========================================================================
  // Technology / WAF → CPE / CVE wiring
  // ===========================================================================

  if (ev.type === 'Technology' || ev.type === 'WAF') {
    if (ev.name) {
      triples.push(
        `${findingIri} <${EX}technologyName> "${escapeStringLiteral(
          String(ev.name)
        )}" .`
      );
    }
    if (ev.version) {
      triples.push(
        `${findingIri} <${EX}technologyVersion> "${escapeStringLiteral(
          String(ev.version)
        )}" .`
      );
    }

    // CPE come literal sul finding (backward compat)
    if (Array.isArray(ev.cpe)) {
      ev.cpe.forEach((cpe) => {
        triples.push(
          `${findingIri} <${EX}cpe> "${escapeStringLiteral(String(cpe))}" .`
        );
      });
    }

    // Se riusciamo a ricavare un CVE id, costruiamo individui CPE/CVE
    const cveId = extractCveIdFromFinding(f);
    if (cveId) {
      const cveIri = `<${iriCve(cveId)}>`;
      const sevNorm = normalizeSeverity(f.severity);

      // Individuo CVE (CVE ⊑ Vulnerabilities)
      triples.push(
        `${cveIri} a <${EX}CVE> .`,
        `${cveIri} <${EX}cveId> "${escapeStringLiteral(cveId)}" .`
      );

      if (typeof f.score === 'number') {
        triples.push(
          `${cveIri} <${EX}cvssScore> "${f.score}"^^<http://www.w3.org/2001/XMLSchema#float> .`
        );
      }

      if (sevNorm && sevNorm !== 'UNKNOWN') {
        triples.push(
          `${cveIri} <${EX}cvssSeverity> "${escapeStringLiteral(
            sevNorm
          )}" .`
        );
      }

      // Finding → CVE come tipo di vulnerabilità (aboutVulnerabilityType)
      triples.push(
        `${findingIri} <${EX}aboutVulnerabilityType> ${cveIri} .`
      );

      // CPE individuali + platformHasVulnerability (CPE → CVE)
      if (Array.isArray(ev.cpe)) {
        ev.cpe.forEach((cpe) => {
          const cpeIri = `<${iriCpe(cpe)}>`;
          triples.push(
            `${cpeIri} a <${EX}CPE> .`,
            `${cpeIri} <http://www.w3.org/2000/01/rdf-schema#label> "${escapeStringLiteral(
              String(cpe)
            )}" .`,
            `${cpeIri} <${EX}platformHasVulnerability> ${cveIri} .`
          );
        });
      }
    }
  }

  // ===========================================================================
  // Header findings → HeaderFinding + refersToHeader
  // ===========================================================================

  if (ev.type === 'Header') {
    if (ev.header) {
      // Info diretta sul finding (compatibilità verso il passato)
      triples.push(
        `${findingIri} <${EX}headerName> "${escapeStringLiteral(
          String(ev.header)
        )}" .`
      );

      // Individuo MessageHeader + link refersToHeader
      const headerIri = `<${iriHeader(ev.header)}>`;
      triples.push(
        `${headerIri} a <${EX}MessageHeader> .`,
        `${headerIri} <${EX}fieldName> "${escapeStringLiteral(
          String(ev.header)
        )}" .`,
        `${findingIri} <${EX}refersToHeader> ${headerIri} .`
      );
    }

    if (Array.isArray(ev.urls)) {
      ev.urls.forEach((u) => {
        // rimane attaccato al finding come prima
        triples.push(
          `${findingIri} <${EX}headerUrl> "${escapeStringLiteral(
            String(u)
          )}" .`
        );
      });
    }
  }

  // ===========================================================================
  // Cookie findings → CookieFinding + refersToCookie
  // ===========================================================================

  if (ev.type === 'Cookie') {
    // Info diretta sul finding (backward compat)
    if (ev.name) {
      triples.push(
        `${findingIri} <${EX}cookieName> "${escapeStringLiteral(
          String(ev.name)
        )}" .`
      );
    }
    if (ev.domain) {
      triples.push(
        `${findingIri} <${EX}cookieDomain> "${escapeStringLiteral(
          String(ev.domain)
        )}" .`
      );
    }
    if (ev.path) {
      triples.push(
        `${findingIri} <${EX}cookiePath> "${escapeStringLiteral(
          String(ev.path)
        )}" .`
      );
    }
    if (ev.flags) {
      if (typeof ev.flags.secure === 'boolean') {
        triples.push(
          `${findingIri} <${EX}cookieSecure> "${ev.flags.secure}"^^<http://www.w3.org/2001/XMLSchema#boolean> .`
        );
      }
      if (typeof ev.flags.httpOnly === 'boolean') {
        triples.push(
          `${findingIri} <${EX}cookieHttpOnly> "${ev.flags.httpOnly}"^^<http://www.w3.org/2001/XMLSchema#boolean> .`
        );
      }
      if (ev.flags.sameSite) {
        triples.push(
          `${findingIri} <${EX}cookieSameSite> "${escapeStringLiteral(
            String(ev.flags.sameSite)
          )}" .`
        );
      }
    }
    if (ev.expirationDate) {
      triples.push(
        `${findingIri} <${EX}cookieExpiration> "${ev.expirationDate}"^^<http://www.w3.org/2001/XMLSchema#double> .`
      );
    }

    // Individuo Cookie + refersToCookie
    const cookieIri = `<${iriCookie(ev.domain, ev.path, ev.name)}>`;
    triples.push(`${cookieIri} a <${EX}Cookie> .`);

    if (ev.name) {
      triples.push(
        `${cookieIri} <${EX}cookieName> "${escapeStringLiteral(
          String(ev.name)
        )}" .`
      );
    }
    if (ev.domain) {
      triples.push(
        `${cookieIri} <${EX}cookieDomain> "${escapeStringLiteral(
          String(ev.domain)
        )}" .`
      );
    }
    if (ev.path) {
      triples.push(
        `${cookieIri} <${EX}cookiePath> "${escapeStringLiteral(
          String(ev.path)
        )}" .`
      );
    }
    if (ev.flags) {
      if (typeof ev.flags.secure === 'boolean') {
        triples.push(
          `${cookieIri} <${EX}cookieSecure> "${ev.flags.secure}"^^<http://www.w3.org/2001/XMLSchema#boolean> .`
        );
      }
      if (typeof ev.flags.httpOnly === 'boolean') {
        triples.push(
          `${cookieIri} <${EX}cookieHttpOnly> "${ev.flags.httpOnly}"^^<http://www.w3.org/2001/XMLSchema#boolean> .`
        );
      }
      if (ev.flags.sameSite) {
        triples.push(
          `${cookieIri} <${EX}cookieSameSite> "${escapeStringLiteral(
            String(ev.flags.sameSite)
          )}" .`
        );
      }
    }
    if (ev.expirationDate) {
      triples.push(
        `${cookieIri} <${EX}cookieExpiration> "${ev.expirationDate}"^^<http://www.w3.org/2001/XMLSchema#double> .`
      );
    }

    triples.push(
      `${findingIri} <${EX}refersToCookie> ${cookieIri} .`
    );
  }

  // ===========================================================================
  // Evidence type generico (rimane sul finding)
  // ===========================================================================

  if (ev.type) {
    triples.push(
      `${findingIri} <${EX}evidenceType> "${escapeStringLiteral(
        String(ev.type)
      )}" .`
    );
  }
}

/**
 * Triples specifiche per HTTP resolver (request/param/header/cookie).
 *
 * Allineato a ontowebpt 1.0.1:
 *  - il finding è un HttpScan (sottoclasse di Scan)
 *  - httpMethod / requestUrl / responseStatus sono DatatypeProperty su HttpScan
 *  - il finding è collegato alla Request via httpFindingOfRequest
 *  - tutti i riferimenti a Request/Response/URI/Header/Param passano da relatedToHTTP
 *  - path e nameParameter sono applicati rispettivamente a URI e Parameter
 *
 * @param {string[]} triples
 * @param {string} findingIri
 * @param {any} f
 */
function addHttpTriples(triples, findingIri, f) {
  const ctx = f?.httpContext || {};
  const ev = f?.evidence || {};

  // Tipizza come HttpScan (sottoclasse di Scan)
  triples.push(`${findingIri} a <${EX}HttpScan> .`);

  // === Link strutturali ai concetti HTTP ===

  // HttpScan → Request
  if (ctx.requestIri) {
    // httpFindingOfRequest: dominio HttpScan, range Request
    triples.push(
      `${findingIri} <${EX}httpFindingOfRequest> <${ctx.requestIri}> .`,
      // relatedToHTTP: dominio Scan, range HTTP (Request ⊑ HTTP)
      `${findingIri} <${EX}relatedToHTTP> <${ctx.requestIri}> .`
    );
  }

  // HttpScan → Response
  if (ctx.responseIri) {
    triples.push(
      `${findingIri} <${EX}relatedToHTTP> <${ctx.responseIri}> .`
    );
  }

  // HttpScan → URI
  if (ctx.uriIri) {
    triples.push(
      `${findingIri} <${EX}relatedToHTTP> <${ctx.uriIri}> .`
    );
  }

  // Headers collegati (RequestHeader / ResponseHeader ⊑ MessageHeader ⊑ HTTP)
  if (Array.isArray(ctx.headers)) {
    ctx.headers.forEach((h) => {
      if (h.iri) {
        triples.push(
          `${findingIri} <${EX}relatedToHTTP> <${h.iri}> .`
        );
      }
    });
  }

  // Params collegati (Parameter ⊑ HTTP)
  if (Array.isArray(ctx.params)) {
    ctx.params.forEach((p) => {
      if (p.iri) {
        // Link al parametro come concetto HTTP
        triples.push(
          `${findingIri} <${EX}relatedToHTTP> <${p.iri}> .`
        );

        // Se abbiamo il nome del parametro, lo mappiamo sulla data property canonica:
        //  - nameParameter: dominio Parameter
        if (p.name) {
          triples.push(
            `<${p.iri}> <${EX}nameParameter> "${escapeStringLiteral(
              String(p.name)
            )}" .`
          );
        }
      }
    });
  }

  // Cookies: per ora solo info "descrittiva" attaccata al finding,
  // più il collegamento al relativo header (Set-Cookie / Cookie) come HTTP.
  if (Array.isArray(ctx.cookies)) {
    ctx.cookies.forEach((c) => {
      if (c.headerIri) {
        triples.push(
          `${findingIri} <${EX}relatedToHTTP> <${c.headerIri}> .`
        );
      }
      if (c.name) {
        triples.push(
          `${findingIri} <${EX}cookieName> "${escapeStringLiteral(
            String(c.name)
          )}" .`
        );
      }
      if (c.domain) {
        triples.push(
          `${findingIri} <${EX}cookieDomain> "${escapeStringLiteral(
            String(c.domain)
          )}" .`
        );
      }
    });
  }

  // === Metadati HTTP sul finding (usando le data property dell'ontologia) ===

  if (f.url) {
    // requestUrl: dominio HttpScan, string
    triples.push(
      `${findingIri} <${EX}requestUrl> "${escapeStringLiteral(
        String(f.url)
      )}" .`
    );
  }

  if (f.method) {
    // httpMethod: dominio HttpScan, string (non individual GET/POST ecc.)
    const m = String(f.method).toUpperCase();
    triples.push(
      `${findingIri} <${EX}httpMethod> "${escapeStringLiteral(m)}" .`
    );
  }

  if (typeof f.responseStatus === 'number') {
    // responseStatus: dominio HttpScan, xsd:int
    triples.push(
      `${findingIri} <${EX}responseStatus> "${f.responseStatus}"^^<http://www.w3.org/2001/XMLSchema#int> .`
    );
  }

  // Se il resolver fornisce un path "logico" e abbiamo l'IRI della URI,
  // lo mappiamo su ex:path (dominio URI).
  if (ev.path && ctx.uriIri) {
    triples.push(
      `<${ctx.uriIri}> <${EX}path> "${escapeStringLiteral(
        String(ev.path)
      )}" .`
    );
  }

  // === Evidenze extra (non modellate esplicitamente in ontologia, ma innocue) ===

  if (ev.kind) {
    triples.push(
      `${findingIri} <${EX}evidenceKind> "${escapeStringLiteral(
        String(ev.kind)
      )}" .`
    );
  }

  if (ev.pattern) {
    triples.push(
      `${findingIri} <${EX}pattern> "${escapeStringLiteral(
        String(ev.pattern)
      )}" .`
    );
  }

  if (ev.rawQuery) {
    triples.push(
      `${findingIri} <${EX}rawQuery> "${escapeStringLiteral(
        String(ev.rawQuery)
      )}" .`
    );
  }

  if (Array.isArray(ev.insecureResources)) {
    ev.insecureResources.forEach((r) => {
      triples.push(
        `${findingIri} <${EX}insecureResource> "${escapeStringLiteral(
          String(r)
        )}" .`
      );
    });
  }

  if (ev.snippet) {
    triples.push(
      `${findingIri} <${EX}snippet> "${escapeStringLiteral(
        String(ev.snippet)
      )}" .`
    );
  }
}

/**
 * Triples specifiche per Analyzer (SAST / HTML).
 *
 * - finding a ex:AnalyzerScan
 * - ex:contextType / contextIndex / contextOrigin / contextSrc / codeSnippet
 * - individui ex:Tag + ex:Field (sottoclassi di HTML)
 * - ex:tagHasProperties : Tag → Field
 * - ex:relatedToHTML    : AnalyzerScan → HTML
 *
 * Gli snippet (main/source/sink) sono attaccati direttamente a AnalyzerScan
 * tramite una singola data property ex:codeSnippet (stringa aggregata).
 *
 * @param {string[]} triples
 * @param {string} findingIri
 * @param {any} f
 */
function addAnalyzerTriples(triples, findingIri, f) {
  // Tipo e sorgente del finding
  triples.push(`${findingIri} a <${EX}AnalyzerScan> .`);

  const ctx = f?.contextVector || {};

  // === Data properties di AnalyzerScan definiti in ontologia ===

  if (ctx.type) {
    triples.push(
      `${findingIri} <${EX}contextType> "${escapeStringLiteral(
        String(ctx.type)
      )}" .`
    );
  }

  if (typeof ctx.index === 'number') {
    triples.push(
      `${findingIri} <${EX}contextIndex> "${ctx.index}"^^<http://www.w3.org/2001/XMLSchema#int> .`
    );
  }

  if (ctx.origin) {
    triples.push(
      `${findingIri} <${EX}contextOrigin> "${escapeStringLiteral(
        String(ctx.origin)
      )}" .`
    );
  }

  // Script / iframe src o pagina di riferimento
  const contextSrc = ctx.src || f.pageUrl;
  if (contextSrc) {
    triples.push(
      `${findingIri} <${EX}contextSrc> "${escapeStringLiteral(
        String(contextSrc)
      )}" .`
    );
  }

  // Form-specific (se l'analyzer li fornisce)
  if (ctx.formAction) {
    triples.push(
      `${findingIri} <${EX}formAction> "${escapeStringLiteral(
        String(ctx.formAction)
      )}" .`
    );
  }
  if (ctx.formMethod) {
    triples.push(
      `${findingIri} <${EX}formMethod> "${escapeStringLiteral(
        String(ctx.formMethod)
      )}" .`
    );
  }

  // --- Snippet: tutti su AnalyzerScan via codeSnippet ---
  const snippetParts = [];
  if (f.snippet) {
    snippetParts.push(`main:\n${String(f.snippet)}`);
  }
  if (f.sourceSnippet) {
    snippetParts.push(`source:\n${String(f.sourceSnippet)}`);
  }
  if (f.sinkSnippet) {
    snippetParts.push(`sink:\n${String(f.sinkSnippet)}`);
  }

  if (snippetParts.length > 0) {
    const combined = snippetParts.join('\n\n');
    triples.push(
      `${findingIri} <${EX}codeSnippet> "${escapeStringLiteral(
        combined
      )}" .`
    );
  }

  // === Modellazione dell'HTML: Tag / Field ===

  const htmlRefs = [];
  if (Array.isArray(f.htmlRef)) {
    htmlRefs.push(...f.htmlRef);
  } else if (f.htmlRef && typeof f.htmlRef === 'object') {
    htmlRefs.push(f.htmlRef);
  }

  htmlRefs.forEach((ref, refIdx) => {
    if (!ref || typeof ref !== 'object') return;

    const tagName =
      ref.tagName || ref.tag || ref.nodeName || ctx.tagName || 'unknown';

    // Chiave stabile per questo Tag (pagina + tipo contesto + indice + nome tag)
    const baseKeyParts = [
      contextSrc || '',
      ctx.type || '',
      String(ctx.index ?? refIdx),
      String(tagName),
    ];
    const tagKey = baseKeyParts.join('#');

    const tagIri = `<${iriHtmlTag(tagKey)}>`;
    triples.push(
      `${tagIri} a <${EX}Tag> .`,
      `${tagIri} a <${EX}HTML> .`
    );

    // Collegamento tra finding (AnalyzerScan) e nodo HTML
    triples.push(`${findingIri} <${EX}relatedToHTML> ${tagIri} .`);

    // --- Attributi → Field (solo struttura, senza data properties extra) ---
    const attrsRaw =
      ref.attributes ||
      ref.attrs ||
      ref.properties ||
      ref.fields ||
      null;

    if (Array.isArray(attrsRaw)) {
      // Caso tipico: array di { name, value }
      attrsRaw.forEach((attr, idxAttr) => {
        const fieldKey = `${tagKey}:${idxAttr}`;
        const fieldIri = `<${iriHtmlField(fieldKey)}>`;
        triples.push(
          `${fieldIri} a <${EX}Field> .`,
          `${fieldIri} a <${EX}HTML> .`,
          `${tagIri} <${EX}tagHasProperties> ${fieldIri} .`
        );
      });
    } else if (attrsRaw && typeof attrsRaw === 'object') {
      // Caso: dizionario { attrName: value }
      Object.keys(attrsRaw).forEach((name) => {
        const fieldKey = `${tagKey}:${name}`;
        const fieldIri = `<${iriHtmlField(fieldKey)}>`;
        triples.push(
          `${fieldIri} a <${EX}Field> .`,
          `${fieldIri} a <${EX}HTML> .`,
          `${tagIri} <${EX}tagHasProperties> ${fieldIri} .`
        );
      });
    }

    // Outer HTML (opzionale) → usiamo sourceLocation (dominio Scan ∪ HTML)
    const outer = ref.outerHTML || ref.outerHtml || ref.html || null;
    if (outer) {
      triples.push(
        `${tagIri} <${EX}sourceLocation> "${escapeStringLiteral(
          String(outer)
        )}" .`
      );
    }
  });
}

/**
 * Extract RDF triple fragments for a single Finding.
 *
 * @param {any} [f={}] Finding JSON (techstack / http / analyzer).
 * @param {number} [index=0] index nel batch (per fallback id).
 * @returns {string[]} triple RDF (senza GRAPH / INSERT).
 */
function extractTriplesForSingleFinding(f = {}, index = 0) {
  const findingKey = computeFindingKey(f, index);
  const findingIri = `<${iriFinding(findingKey)}>`;
  /** @type {string[]} */
  const triples = [];

  // Metadati generici (Scan + proprietà comuni)
  addGenericFindingTriples(triples, findingIri, f);

  const source = (f?.source || '').toLowerCase();
  if (source === 'techstack') {
    addTechstackTriples(triples, findingIri, f);
  } else if (source === 'http' || source === 'http-resolver') {
    addHttpTriples(triples, findingIri, f);
  } else if (source === 'analyzer' || source === 'sast') {
    addAnalyzerTriples(triples, findingIri, f);
  }

  return triples;
}

module.exports = extractTriplesForSingleFinding;
