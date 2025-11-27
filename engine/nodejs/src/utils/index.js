// @ts-check

module.exports = {
  ...require('./constants'),

  // strings
  ...require('./strings/escape'),

  // SPARQL
  ...require('./sparql/queryType'),
  ...require('./sparql/format'),
  ...require('./sparql/pagination'),

  // IRI helpers
  ...require('./iri/http'),
  ...require('./iri/finding'),

  // HTTP ontology helpers
  ...require('./http/headers'),

  // Logger
  ...require('./logs/logger'),

  // Builders
  httpBuilders: {
    normalizeHttpRequestsPayload: require('./http/builders/normalizePayload'),
    buildInsertFromHttpRequest: require('./http/builders/insertSingle'),
    buildInsertFromHttpRequestsArray: require('./http/builders/insertBatch'),
    buildSelectRequests: require('./http/builders/selectRequests'),
    buildSelectRequestsPaged: require('./http/builders/selectPaged'),
    bindingsToRequestsJson: require('./http/bindings/toJson'),
  },

  // Finding / vulnerability builders
  findingBuilders: {
    buildInsertFromFindingsArray: require('./finding/builders/insertBatch'),

    // HTTP findings
    buildSelectHttpFindingsPaged: require('./finding/builders/http/selectHttpFindingsPaged'),
    bindingsToHttpFindingsList: require('./finding/bindings/http/httpFindingsList'),
    buildSelectHttpFindingById: require('./finding/builders/http/selectHttpFindingById'),
    bindingsToHttpFindingDetail: require('./finding/bindings/http/httpFindingDetail'),

    // Analyzer findings
    buildSelectAnalyzerFindingsPaged: require('./finding/builders/analyzer/selectAnalyzerFindingsPaged'),
    bindingsToAnalyzerFindingsList: require('./finding/bindings/analyzer/analyzerFindingsList'),
    buildSelectAnalyzerFindingById: require('./finding/builders/analyzer/selectAnalyzerFindingById'),
    bindingsToAnalyzerFindingDetail: require('./finding/bindings/analyzer/analyzerFindingDetail'),

    // Techstack findings
    buildSelectTechstackFindingsPaged: require('./finding/builders/techstack/selectTechstackFindingsPaged'),
    bindingsToTechstackFindingsList: require('./finding/bindings/techstack/techstackFindingsList'),
    buildSelectTechstackFindingById: require('./finding/builders/techstack/selectTechstackFindingById'),
    bindingsToTechstackFindingDetail: require('./finding/bindings/techstack/techstackFindingDetail'),
  },

  // Monitors
  monitors: {
    startRedisMonitor: require('./monitors/redisMonitor'),
    startGraphDBHealthProbe: require('./monitors/graphdbMonitor'),
    setState: require('./monitors/health').setState,
    getHealth: require('./monitors/health').getHealth,
  },

  // Validators (split per API)
  validators: {
    httpRequests: require('./validators/httpRequests'),
    sparql: require('./validators/sparql'),
    techstack: require('./validators/techstack'),
    analyzer: require('./validators/analyzer'),
    ...require('./validators/options'),
  },

  // GraphDB (Select/Update)
  graphdb: require('./graphdb/client'),

  // Resolvers (new namespace)
  resolvers: {
    techstack: require('./resolvers/techstack/resolveTechstack'),
    analyzer: require('./resolvers/analyzer/resolveAnalyzer'),
    http: require('./resolvers/http/httpAnalyzer'),
  },
};
