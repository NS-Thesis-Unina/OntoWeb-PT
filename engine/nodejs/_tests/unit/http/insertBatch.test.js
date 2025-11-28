jest.mock('../../../src/utils/http/builders/extractTriples', () => jest.fn());

const extractTriplesForSingleRequest = require('../../../src/utils/http/builders/extractTriples');
const buildInsertFromHttpRequestsArray = require('../../../src/utils/http/builders/insertBatch');
const { EX, CONTENT, G_HTTP } = require('../../../src/utils/constants');

describe('buildInsertFromHttpRequestsArray', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('throws if list is not an array or is empty', () => {
    expect(() => buildInsertFromHttpRequestsArray()).toThrow(
      'Expected a non-empty array of requests'
    );
    expect(() => buildInsertFromHttpRequestsArray(null)).toThrow(
      'Expected a non-empty array of requests'
    );
    expect(() => buildInsertFromHttpRequestsArray([])).toThrow(
      'Expected a non-empty array of requests'
    );
  });

  test('uses default G_HTTP graph when items have no graph and defaultGraph arg is not provided', () => {
    const list = [
      { id: 'req-1', method: 'GET', uri: { full: 'https://a.com' } },
      { id: 'req-2', method: 'POST', uri: { full: 'https://b.com' } },
    ];

    extractTriplesForSingleRequest
      .mockReturnValueOnce(['# triples-1'])
      .mockReturnValueOnce(['# triples-2']);

    const sparql = buildInsertFromHttpRequestsArray(list);

    expect(extractTriplesForSingleRequest).toHaveBeenCalledTimes(2);
    expect(extractTriplesForSingleRequest).toHaveBeenNthCalledWith(1, list[0]);
    expect(extractTriplesForSingleRequest).toHaveBeenNthCalledWith(2, list[1]);

    expect(sparql).toContain(`PREFIX ex: <${EX}>`);
    expect(sparql).toContain(`PREFIX content: <${CONTENT}>`);
    expect(sparql).toContain('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>');
    expect(sparql).toContain('PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>');

    expect(sparql).toContain('INSERT DATA {');

    const occurrences = (sparql.match(new RegExp(`GRAPH <${G_HTTP}>`, 'g')) || []).length;
    expect(occurrences).toBe(1);

    expect(sparql).toContain('# triples-1');
    expect(sparql).toContain('# triples-2');
  });

  test('uses defaultGraph parameter when provided and item has no own graph', () => {
    const customDefaultGraph = 'http://example.com/graphs/custom';
    const list = [
      { id: 'req-1', method: 'GET', uri: { full: 'https://a.com' } },
    ];

    extractTriplesForSingleRequest.mockReturnValue(['# t-custom']);

    const sparql = buildInsertFromHttpRequestsArray(list, customDefaultGraph);

    expect(sparql).toContain(`GRAPH <${customDefaultGraph}> {`);
    expect(sparql).not.toContain(`GRAPH <${G_HTTP}> {`);
    expect(sparql).toContain('# t-custom');
  });

  test('groups triples by graph when items specify different graphs', () => {
    const g1 = 'http://example.com/graphs/g1';
    const g2 = 'http://example.com/graphs/g2';

    const list = [
      { id: 'req-1', method: 'GET', uri: { full: 'https://g1.com' }, graph: g1 },
      { id: 'req-2', method: 'POST', uri: { full: 'https://g2.com' }, graph: g2 },
    ];

    extractTriplesForSingleRequest
      .mockReturnValueOnce(['# triples-g1-a', '# triples-g1-b'])
      .mockReturnValueOnce(['# triples-g2-a']);

    const sparql = buildInsertFromHttpRequestsArray(list);

    expect(sparql).toContain(`GRAPH <${g1}> {`);
    expect(sparql).toContain(`GRAPH <${g2}> {`);

    expect(sparql).toContain('# triples-g1-a');
    expect(sparql).toContain('# triples-g1-b');
    expect(sparql).toContain('# triples-g2-a');
  });

  test('propagates errors raised by extractTriplesForSingleRequest', () => {
    const list = [
      { id: 'req-1', method: 'GET', uri: { full: 'https://a.com' } },
    ];

    extractTriplesForSingleRequest.mockImplementation(() => {
      throw new Error('Missing id/method/uri.full');
    });

    expect(() => buildInsertFromHttpRequestsArray(list)).toThrow(
      'Missing id/method/uri.full'
    );
  });
});
