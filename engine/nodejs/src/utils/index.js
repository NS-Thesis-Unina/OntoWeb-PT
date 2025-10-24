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

  // Monitors
  monitors: {
    startRedisMonitor: require('./monitors/redisMonitor'),
    startGraphDBHealthProbe: require('./monitors/graphdbMonitor'),
  },

  // GraphDB (Select/Update)
  graphdb: require('./graphdb/client'),
};
