// @ts-check

/**
 * IRI helpers for HTML Tag / Field individuals.
 *
 *  - Tag:   urn:html:tag:{key}
 *  - Field: urn:html:field:{key}
 */

const { iriFragmentSafe } = require('./http');

/**
 * Build a URN for an HTML Tag individual.
 *
 * @param {string} key stable key (e.g. "https://site/page#script#0")
 * @returns {string} URN (without < >)
 */
function iriHtmlTag(key) {
  return `urn:html:tag:${iriFragmentSafe(key)}`;
}

/**
 * Build a URN for an HTML Field individual.
 *
 * @param {string} key stable key (e.g. "...#script#0:src")
 * @returns {string} URN (without < >)
 */
function iriHtmlField(key) {
  return `urn:html:field:${iriFragmentSafe(key)}`;
}

module.exports = {
  iriHtmlTag,
  iriHtmlField,
};
