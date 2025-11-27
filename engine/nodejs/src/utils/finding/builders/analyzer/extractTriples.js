// @ts-check

const { EX } = require('../../../constants');
const { escapeStringLiteral } = require('../../../strings/escape');
const { iriHtmlTag, iriHtmlField } = require('../../../iri/html');

/**
 * @typedef {import('../../../_types/finding/builders/analyzer/types').AnalyzerFinding} AnalyzerFinding
 */

/**
 * Add Analyzer (SAST / HTML) specific triples for a finding.
 *
 * @param {string[]} triples
 * @param {string} findingIri
 * @param {AnalyzerFinding|any} f
 */
function addAnalyzerTriples(triples, findingIri, f) {
  // Type as AnalyzerScan
  triples.push(`${findingIri} a <${EX}AnalyzerScan> .`);

  const ctx = f?.contextVector || {};

  // === AnalyzerScan data properties defined in the ontology ===

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

  // Script / iframe src or page URL
  const contextSrc = ctx.src || f.pageUrl;
  if (contextSrc) {
    triples.push(
      `${findingIri} <${EX}contextSrc> "${escapeStringLiteral(
        String(contextSrc)
      )}" .`
    );
  }

  // Form-specific
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

  // --- Snippets: all attached to AnalyzerScan via codeSnippet ---
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

  // === HTML modeling: Tag / Field ===

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

    // Stable key for this Tag (page + context type + index + tag name)
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

    // Link AnalyzerScan → HTML node
    triples.push(`${findingIri} <${EX}relatedToHTML> ${tagIri} .`);

    // --- Attributes → Field (only structure, no extra data properties) ---
    const attrsRaw =
      ref.attributes ||
      ref.attrs ||
      ref.properties ||
      ref.fields ||
      null;

    if (Array.isArray(attrsRaw)) {
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

    // Optional outer HTML → sourceLocation (domain Scan ∪ HTML)
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

module.exports = { addAnalyzerTriples };
