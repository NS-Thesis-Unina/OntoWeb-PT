// @ts-check

const { EX } = require('../../../constants');
const { escapeStringLiteral } = require('../../../strings/escape');
const { iriHtmlTag, iriHtmlField } = require('../../../iri/html');

/**
 * Analyzer finding as produced by resolveAnalyzer.
 * Re-exported here for convenience in finding builders.
 * @typedef {import('../../../_types/finding/builders/analyzer/types').AnalyzerFinding} AnalyzerFinding
 */

/**
 * Build a simple HTML attribute snippet in the form: name="value".
 *
 * If only the name or the value is present, it returns the available part.
 * If both are missing, it returns an empty string.
 *
 * @param {string | null | undefined} name Attribute name.
 * @param {string | null | undefined} value Attribute value.
 * @returns {string} Snippet representing the attribute.
 */
function buildAttributeSnippet(name, value) {
  const n = name != null ? String(name) : '';
  const v = value != null ? String(value) : '';

  if (n && v) return `${n}="${v}"`;
  if (n) return n;
  if (v) return v;
  return '';
}

/**
 * Build a synthetic outer HTML snippet from a tag name and its attributes.
 *
 * Example:
 *   tagName = "form",
 *   attributes = [{ name: "action", value: "/x" }, { name: "method", value: "GET" }]
 *   => "<form action=\"/x\" method=\"GET\">"
 *
 * @param {string} tagName HTML tag name (e.g. "form", "input").
 * @param {Array<{ name?: string, value?: string }>} [attributes] List of attributes for the tag.
 * @returns {string} Synthetic outer HTML snippet for the tag.
 */
function buildTagOuterHtml(tagName, attributes) {
  const safeTag = tagName || 'tag';
  const parts = [];

  if (Array.isArray(attributes)) {
    for (const attr of attributes) {
      if (!attr || typeof attr !== 'object') continue;
      const snippet = buildAttributeSnippet(
        /** @type {any} */ (attr.name),
        /** @type {any} */ (attr.value)
      );
      if (snippet) parts.push(snippet);
    }
  }

  const attrsString = parts.length > 0 ? ' ' + parts.join(' ') : '';
  return `<${safeTag}${attrsString}>`;
}

/**
 * Emit Field individuals for a given Tag, based on an attributes array.
 *
 * For each attribute this function:
 * - creates a resource typed as ex:Field and ex:HTML
 * - links the Tag to the Field via ex:tagHasProperties
 * - adds ex:sourceLocation with a snippet like name="value"
 *
 * @param {string[]} triples Mutable accumulator of N-Triples statements.
 * @param {string} tagIri IRI of the Tag individual.
 * @param {string} tagKey Stable key used to derive the Field IRI.
 * @param {Array<{ name?: string, value?: string }>} [attributes] Attributes of the Tag.
 * @param {string} [keySuffix="attr"] Extra segment to distinguish groups (e.g. "attr", "child-attr").
 */
function emitAttributeFields(triples, tagIri, tagKey, attributes, keySuffix = 'attr') {
  if (!Array.isArray(attributes) || attributes.length === 0) return;

  attributes.forEach((attr, idx) => {
    if (!attr || typeof attr !== 'object') return;

    const name = attr.name != null ? String(attr.name) : null;
    const value = attr.value != null ? String(attr.value) : null;

    const fieldKey = `${tagKey}:${keySuffix}:${idx}`;
    const fieldIri = `<${iriHtmlField(fieldKey)}>`; // -> urn:html:field:...

    // Types
    triples.push(`${fieldIri} a <${EX}Field> .`, `${fieldIri} a <${EX}HTML> .`);

    // Link Tag → Field
    triples.push(`${tagIri} <${EX}tagHasProperties> ${fieldIri} .`);

    // Attribute snippet
    const snippet = buildAttributeSnippet(name, value);
    if (snippet) {
      triples.push(`${fieldIri} <${EX}sourceLocation> "${escapeStringLiteral(snippet)}" .`);
    }
  });
}

/**
 * Add Analyzer (SAST / HTML) specific triples for a finding.
 *
 * This function:
 * - types the finding as ex:AnalyzerFinding
 * - materializes contextVector data (type, origin, index, src, formAction, formMethod, ...)
 * - attaches code snippets via ex:codeSnippet
 * - creates HTML Tag / Field individuals and their relationships, including nested tags
 *
 * @param {string[]} triples Mutable accumulator of N-Triples statements.
 * @param {string} findingIri IRI of the Finding individual.
 * @param {AnalyzerFinding|any} f Analyzer finding payload coming from resolveAnalyzer.
 */
function addAnalyzerTriples(triples, findingIri, f) {
  // Type as AnalyzerFinding
  triples.push(`${findingIri} a <${EX}AnalyzerFinding> .`);

  let mainDomainValue = null;

  if (f.mainDomain) {
    mainDomainValue = String(f.mainDomain);
  } else if (f.pageUrl) {
    mainDomainValue = String(f.pageUrl);
  } else {
    mainDomainValue = '';
  }

  if (mainDomainValue) {
    triples.push(`${findingIri} <${EX}mainDomain> "${escapeStringLiteral(mainDomainValue)}" .`);
  }

  const ctx = f?.contextVector || {};

  // === AnalyzerFinding data properties defined in the ontology ===

  if (ctx.type) {
    triples.push(`${findingIri} <${EX}contextType> "${escapeStringLiteral(String(ctx.type))}" .`);
  }

  if (typeof ctx.index === 'number') {
    triples.push(
      `${findingIri} <${EX}contextIndex> "${ctx.index}"^^<http://www.w3.org/2001/XMLSchema#int> .`
    );
  }

  if (ctx.origin) {
    triples.push(
      `${findingIri} <${EX}contextOrigin> "${escapeStringLiteral(String(ctx.origin))}" .`
    );
  }

  // Script / iframe src or page URL
  const contextSrc = ctx.src || f.pageUrl;
  if (contextSrc) {
    triples.push(`${findingIri} <${EX}contextSrc> "${escapeStringLiteral(String(contextSrc))}" .`);
  }

  // Form-specific properties
  if (ctx.formAction) {
    triples.push(
      `${findingIri} <${EX}formAction> "${escapeStringLiteral(String(ctx.formAction))}" .`
    );
  }
  if (ctx.formMethod) {
    triples.push(
      `${findingIri} <${EX}formMethod> "${escapeStringLiteral(String(ctx.formMethod))}" .`
    );
  }

  // --- Snippets: all attached to AnalyzerFinding via ex:codeSnippet ---
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
    triples.push(`${findingIri} <${EX}codeSnippet> "${escapeStringLiteral(combined)}" .`);
  }

  // === HTML modeling: Tag / Field / nested Tag ===

  /** @type {any[]} */
  const htmlRefs = [];
  if (Array.isArray(f?.htmlRef)) {
    htmlRefs.push(...f.htmlRef);
  } else if (f?.htmlRef && typeof f.htmlRef === 'object') {
    htmlRefs.push(f.htmlRef);
  }

  htmlRefs.forEach((ref, refIdx) => {
    if (!ref || typeof ref !== 'object') return;

    const tagName = ref.tagName || ref.tag || ref.nodeName || ctx.tagName || 'unknown';

    // Stable key for this Tag (page + context type + index + tag name)
    const baseKeyParts = [
      contextSrc || '',
      ctx.type || '',
      String(ctx.index ?? refIdx),
      String(tagName),
    ];
    const tagKey = baseKeyParts.join('#');

    const tagIri = `<${iriHtmlTag(tagKey)}>`; // e.g. urn:html:tag:<encoded key>

    // Types for the parent Tag
    triples.push(`${tagIri} a <${EX}Tag> .`, `${tagIri} a <${EX}HTML> .`);

    // Link AnalyzerFinding → HTML node (parent Tag)
    triples.push(`${findingIri} <${EX}relatedToHTML> ${tagIri} .`);

    // --- Parent Tag attributes → Field ---
    const attributes = ref.attributes || ref.attrs || ref.properties || null;

    emitAttributeFields(triples, tagIri, tagKey, attributes, 'attr');

    // --- Parent Tag HTML snippet ---
    const outer = ref.outerHTML || ref.outerHtml || ref.html || null;

    const tagSource =
      outer || buildTagOuterHtml(tagName, Array.isArray(attributes) ? attributes : []);

    if (tagSource) {
      triples.push(`${tagIri} <${EX}sourceLocation> "${escapeStringLiteral(String(tagSource))}" .`);
    }

    // --- Nested Tag/Field (ref.fields) ---
    // For forms:
    //  - ref.tag === "form"
    //  - ref.attributes ⇒ [action=..., method=...]
    //  - ref.fields ⇒ array of elements (input, select, ...) with their own attributes
    const nestedFields = Array.isArray(ref.fields) ? ref.fields : [];

    nestedFields.forEach((fieldRef, fieldIdx) => {
      if (!fieldRef || typeof fieldRef !== 'object') return;

      const childTagName = fieldRef.tagName || fieldRef.tag || fieldRef.nodeName || 'unknown';

      // Stable key for the child Tag
      const childKey = `${tagKey}:child:${fieldIdx}`;
      const childTagIri = `<${iriHtmlTag(childKey)}>`; // Child Tag

      // Types for the child Tag
      triples.push(`${childTagIri} a <${EX}Tag> .`, `${childTagIri} a <${EX}HTML> .`);

      // Nesting relation: parent Tag → child Tag
      // (uses the ex:tagHasChildTag property defined in the ontology)
      triples.push(`${tagIri} <${EX}tagHasChildTag> ${childTagIri} .`);

      // Child Tag attributes → Field
      const childAttributes = Array.isArray(fieldRef.attributes) ? fieldRef.attributes : [];

      emitAttributeFields(triples, childTagIri, childKey, childAttributes, 'attr');

      // Child Tag HTML snippet
      const childOuter =
        fieldRef.outerHTML ||
        fieldRef.outerHtml ||
        fieldRef.html ||
        buildTagOuterHtml(childTagName, childAttributes);

      if (childOuter) {
        triples.push(
          `${childTagIri} <${EX}sourceLocation> "${escapeStringLiteral(String(childOuter))}" .`
        );
      }
    });
  });
}

module.exports = { addAnalyzerTriples };
