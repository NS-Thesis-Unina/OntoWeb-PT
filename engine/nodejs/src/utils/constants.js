// @ts-check

// Centralized constants (ontology bases, default graphs).
const EX = (process.env.ONT_EX || 'http://www.semanticweb.org/nda/ontologies/2025/8/untitled-ontology-18') + '#';
const CONTENT = (process.env.ONT_CONTENT ? process.env.ONT_CONTENT : 'http://www.w3.org/2008/content') + '#';
const G_HTTP = process.env.HTTP_REQUESTS_NAME_GRAPH || 'http://example.com/graphs/http-requests';

module.exports = { EX, CONTENT, G_HTTP };
