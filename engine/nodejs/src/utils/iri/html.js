// @ts-check

/**
 * IRI helpers for HTML Tag / Field individuals.
 *
 *  - Tag:   urn:html:tag:{key}
 *  - Field: urn:html:field:{key}
 */

/** @typedef {import('../_types/iri/types').IriString} IriString */
/** @typedef {import('../_types/iri/types').HtmlKey} HtmlKey */

const { iriFragmentSafe } = require('./http');

/**
 * Build a URN for an HTML Tag individual.
 *
 * Shape:
 *   `urn:html:tag:{key}`
 *
 * @param {HtmlKey} key - Stable key (e.g. "https://site/page#script#0").
 * @returns {IriString} URN (without angle brackets).
 */
function iriHtmlTag(key) {
  return `urn:html:tag:${iriFragmentSafe(key)}`;
}

/**
 * Build a URN for an HTML Field individual.
 *
 * Shape:
 *   `urn:html:field:{key}`
 *
 * @param {HtmlKey} key - Stable key (e.g. "...#script#0:src").
 * @returns {IriString} URN (without angle brackets).
 */
function iriHtmlField(key) {
  return `urn:html:field:${iriFragmentSafe(key)}`;
}

module.exports = {
  iriHtmlTag,
  iriHtmlField,
};
