// @ts-check

const { EX } = require('../../../constants');
const { escapeStringLiteral } = require('../../../strings/escape');

/**
 * @typedef {import('../../../_types/finding/builders/http/types').HttpResolverFinding} HttpResolverFinding
 */

/**
 * Add HTTP-specific triples for an HTTP resolver finding.
 *
 * @param {string[]} triples
 * @param {string} findingIri
 * @param {HttpResolverFinding|any} f
 */
function addHttpTriples(triples, findingIri, f) {
  const ctx = f?.httpContext || {};
  const ev = f?.evidence || {};

  // Type as HttpScan (subclass of Scan)
  triples.push(`${findingIri} a <${EX}HttpScan> .`);

  // === Structural links to HTTP concepts ===

  // HttpScan → Request
  if (ctx.requestIri) {
    triples.push(
      `${findingIri} <${EX}httpFindingOfRequest> <${ctx.requestIri}> .`,
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

  // Headers (RequestHeader / ResponseHeader ⊑ MessageHeader ⊑ HTTP)
  if (Array.isArray(ctx.headers)) {
    ctx.headers.forEach((h) => {
      if (h.iri) {
        triples.push(
          `${findingIri} <${EX}relatedToHTTP> <${h.iri}> .`
        );
      }
    });
  }

  // Params (Parameter ⊑ HTTP)
  if (Array.isArray(ctx.params)) {
    ctx.params.forEach((p) => {
      if (p.iri) {
        triples.push(
          `${findingIri} <${EX}relatedToHTTP> <${p.iri}> .`
        );

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

  // Cookies: descriptive info + link to related header (Set-Cookie / Cookie)
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

  // === HTTP metadata on the finding (data properties) ===

  if (f.url) {
    triples.push(
      `${findingIri} <${EX}requestUrl> "${escapeStringLiteral(
        String(f.url)
      )}" .`
    );
  }

  if (f.method) {
    const m = String(f.method).toUpperCase();
    triples.push(
      `${findingIri} <${EX}httpMethod> "${escapeStringLiteral(m)}" .`
    );
  }

  if (typeof f.responseStatus === 'number') {
    triples.push(
      `${findingIri} <${EX}responseStatus> "${f.responseStatus}"^^<http://www.w3.org/2001/XMLSchema#int> .`
    );
  }

  // If the resolver provides a logical path and we have the URI IRI,
  // map it on ex:path (domain URI).
  if (ev.path && ctx.uriIri) {
    triples.push(
      `<${ctx.uriIri}> <${EX}path> "${escapeStringLiteral(
        String(ev.path)
      )}" .`
    );
  }

  // === Extra evidence fields (not explicitly modeled in ontology) ===

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

module.exports = { addHttpTriples };
