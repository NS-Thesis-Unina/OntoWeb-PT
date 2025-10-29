/**

@typedef {{ type: string, value: string, 'xml:lang'?: string, datatype?: string }} SparqlBindingCell
*/

/**

@typedef {{ vars: string[] }} SparqlHead
*/

/**

@typedef {Object} SparqlSelectResult

@property {SparqlHead} head

@property {{ bindings: Record<string, SparqlBindingCell>[] }} results
*/

/** @typedef {{ boolean: boolean }} SparqlAskResult /
/* @typedef {SparqlSelectResult | SparqlAskResult} SparqlJsonResult */

module.exports = {};