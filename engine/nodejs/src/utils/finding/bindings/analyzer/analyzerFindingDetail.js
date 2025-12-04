// @ts-check

/** @typedef {import('../../../_types/graphdb/types').SparqlBindingCell} SparqlBindingCell */
/** @typedef {import('../../../_types/finding/bindings/types').SparqlBindingRow} SparqlBindingRow */
/** @typedef {import('../../../_types/finding/bindings/analyzer/types').AnalyzerHtmlField} AnalyzerHtmlField */
/** @typedef {import('../../../_types/finding/bindings/analyzer/types').AnalyzerHtmlTagNode} AnalyzerHtmlTagNode */
/** @typedef {import('../../../_types/finding/bindings/analyzer/types').AnalyzerContext} AnalyzerContext */
/** @typedef {import('../../../_types/finding/bindings/analyzer/types').AnalyzerFindingDetail} AnalyzerFindingDetail */

/**
 * Extract raw value from a SPARQL binding cell.
 *
 * @param {SparqlBindingCell | undefined} cell
 * @returns {string | undefined}
 */
function valueOf(cell) {
  if (!cell) return undefined;
  if (Object.prototype.hasOwnProperty.call(cell, 'value')) return String(cell.value);
  return undefined;
}

/**
 * Transform SPARQL JSON bindings into a single detailed AnalyzerScan finding object.
 *
 * The query is expected to return multiple rows for the same finding (due to
 * HTML tags, fields and nested tags), so this function aggregates them:
 *
 *  - Scalar fields (severity, description, etc.) are taken from the first
 *    row where they appear.
 *  - HTML structure is normalized into a tree of:
 *      html[] = [ { iri, source, fields[], children[] }, ... ]
 *
 * @param {SparqlBindingRow[]} bindings - SPARQL JSON `results.bindings` array.
 * @returns {AnalyzerFindingDetail | null} The normalized finding object, or null if not found.
 */
function bindingsToAnalyzerFindingDetail(bindings) {
  if (!bindings || bindings.length === 0) return null;

  /** @type {AnalyzerFindingDetail} */
  const result = {
    id: '',
  };

  /** @type {Map<string, AnalyzerHtmlTagNode>} */
  const rootTags = new Map();
  /** @type {Map<string, AnalyzerHtmlTagNode>} */
  const childTags = new Map();
  /** @type {Map<string, string>} */
  const childParent = new Map();

  for (const row of bindings) {
    const id = valueOf(row.id);
    if (!id) continue;

    if (!result.id) {
      result.id = id;
    }

    // === Scalar fields ===
    const resolver = valueOf(row.resolver);
    const vulnType = valueOf(row.vulnType);
    const severity = valueOf(row.severity);
    const category = valueOf(row.findingCategory);
    const owasp = valueOf(row.owaspCategory);
    const ruleId = valueOf(row.ruleId);
    const description = valueOf(row.description);
    const remediation = valueOf(row.remediation);
    const contextType = valueOf(row.contextType);
    const contextIndex = valueOf(row.contextIndex);
    const contextOrigin = valueOf(row.contextOrigin);
    const contextSrc = valueOf(row.contextSrc);
    const formAction = valueOf(row.formAction);
    const formMethod = valueOf(row.formMethod);
    const codeSnippet = valueOf(row.codeSnippet);

    if (resolver && !result.resolver) result.resolver = resolver;
    if (vulnType && !result.vulnerabilityType) result.vulnerabilityType = vulnType;
    if (severity && !result.severity) result.severity = severity;
    if (category && !result.findingCategory) result.findingCategory = category;
    if (owasp && !result.owaspCategory) result.owaspCategory = owasp;
    if (ruleId && !result.ruleId) result.ruleId = ruleId;
    if (description && !result.description) result.description = description;
    if (remediation && !result.remediation) result.remediation = remediation;
    if (codeSnippet && !result.codeSnippet) result.codeSnippet = codeSnippet;

    if (contextType || contextIndex || contextOrigin || contextSrc || formAction || formMethod) {
      result.context ||= {};
      if (contextType && !result.context.type) {
        result.context.type = contextType;
      }
      if (contextIndex && result.context.index === undefined) {
        const n = Number(contextIndex);
        if (!Number.isNaN(n)) {
          result.context.index = n;
        }
      }
      if (contextOrigin && !result.context.origin) {
        result.context.origin = contextOrigin;
      }
      if (contextSrc && !result.context.src) {
        result.context.src = contextSrc;
      }
      if (formAction && !result.context.formAction) {
        result.context.formAction = formAction;
      }
      if (formMethod && !result.context.formMethod) {
        result.context.formMethod = formMethod;
      }
    }

    // === HTML structure ===
    const htmlTagIri = valueOf(row.htmlTag);
    const htmlTagSource = valueOf(row.htmlTagSource);
    const htmlFieldIri = valueOf(row.htmlField);
    const htmlFieldSource = valueOf(row.htmlFieldSource);
    const childTagIri = valueOf(row.childTag);
    const childTagSource = valueOf(row.childTagSource);
    const childFieldIri = valueOf(row.childField);
    const childFieldSource = valueOf(row.childFieldSource);

    // Root tag
    if (htmlTagIri) {
      let tagNode = rootTags.get(htmlTagIri);
      if (!tagNode) {
        tagNode = { iri: htmlTagIri };
        rootTags.set(htmlTagIri, tagNode);
      }
      if (htmlTagSource && !tagNode.source) {
        tagNode.source = htmlTagSource;
      }

      // Root fields
      if (htmlFieldIri) {
        tagNode.fields ||= [];
        if (!tagNode.fields.some((f) => f.iri === htmlFieldIri)) {
          tagNode.fields.push({
            iri: htmlFieldIri,
            ...(htmlFieldSource ? { source: htmlFieldSource } : {}),
          });
        }
      }
    }

    // Child tag (nested inside root tag)
    if (childTagIri && htmlTagIri) {
      childParent.set(childTagIri, htmlTagIri);

      let childNode = childTags.get(childTagIri);
      if (!childNode) {
        childNode = { iri: childTagIri };
        childTags.set(childTagIri, childNode);
      }
      if (childTagSource && !childNode.source) {
        childNode.source = childTagSource;
      }

      // Child fields
      if (childFieldIri) {
        childNode.fields ||= [];
        if (!childNode.fields.some((f) => f.iri === childFieldIri)) {
          childNode.fields.push({
            iri: childFieldIri,
            ...(childFieldSource ? { source: childFieldSource } : {}),
          });
        }
      }
    }
  }

  // Link child tags under their respective root tags
  for (const [childIri, parentIri] of childParent.entries()) {
    const parentNode = rootTags.get(parentIri);
    const childNode = childTags.get(childIri);
    if (!parentNode || !childNode) continue;

    parentNode.children ||= [];
    if (!parentNode.children.some((c) => c.iri === childIri)) {
      parentNode.children.push(childNode);
    }
  }

  // Final HTML array, sorted for stability
  if (rootTags.size > 0) {
    const htmlNodes = Array.from(rootTags.values());
    htmlNodes.sort((a, b) => a.iri.localeCompare(b.iri));
    for (const node of htmlNodes) {
      if (node.fields) {
        node.fields.sort((a, b) => a.iri.localeCompare(b.iri));
      }
      if (node.children) {
        node.children.sort((a, b) => a.iri.localeCompare(b.iri));
      }
    }
    result.html = htmlNodes;
  }

  // Cleanup empty fields
  if (!result.resolver) delete result.resolver;
  if (!result.vulnerabilityType) delete result.vulnerabilityType;
  if (!result.severity) delete result.severity;
  if (!result.findingCategory) delete result.findingCategory;
  if (!result.owaspCategory) delete result.owaspCategory;
  if (!result.ruleId) delete result.ruleId;
  if (!result.description) delete result.description;
  if (!result.remediation) delete result.remediation;
  if (!result.codeSnippet) delete result.codeSnippet;

  if (result.context) {
    if (result.context.index === undefined) delete result.context.index;
    if (!result.context.type) delete result.context.type;
    if (!result.context.origin) delete result.context.origin;
    if (!result.context.src) delete result.context.src;
    if (!result.context.formAction) delete result.context.formAction;
    if (!result.context.formMethod) delete result.context.formMethod;
    if (Object.keys(result.context).length === 0) {
      delete result.context;
    }
  }

  if (!result.html || result.html.length === 0) {
    delete result.html;
  }

  if (!result.id) return null;
  return result;
}

module.exports = bindingsToAnalyzerFindingDetail;
