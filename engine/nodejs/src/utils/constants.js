// @ts-check

// Centralized constants (ontology bases, default graphs).
const EX =
  (process.env.ONT_EX || 'http://localhost/onto/ontowebpt') + '#';
const CONTENT =
  (process.env.ONT_CONTENT
    ? process.env.ONT_CONTENT
    : 'http://www.w3.org/2008/content') + '#';

const G_HTTP =
  process.env.HTTP_REQUESTS_NAME_GRAPH ||
  'http://localhost/graphs/http-requests';

// Dedicated named graph for security findings (Techstack/HTTP/Analyzer).
const G_FINDINGS =
  process.env.FINDINGS_NAME_GRAPH ||
  'http://localhost/graphs/findings';

module.exports = { EX, CONTENT, G_HTTP, G_FINDINGS };
