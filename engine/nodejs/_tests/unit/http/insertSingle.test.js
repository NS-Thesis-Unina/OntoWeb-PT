jest.mock('../../../src/utils/http/builders/extractTriples', () => jest.fn());

const extractTriplesForSingleRequest = require('../../../src/utils/http/builders/extractTriples');
const buildInsertFromHttpRequest = require('../../../src/utils/http/builders/insertSingle');
const { EX, CONTENT, G_HTTP } = require('../../../src/utils/constants');

describe('buildInsertFromHttpRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('builds an INSERT DATA using default G_HTTP graph when p.graph is not provided', () => {
    extractTriplesForSingleRequest.mockReturnValue([
      '# triple-1',
      '# triple-2',
    ]);

    const input = {
      id: 'req-1',
      method: 'GET',
      uri: { full: 'https://example.com' },
    };

    const sparql = buildInsertFromHttpRequest(input);

    expect(extractTriplesForSingleRequest).toHaveBeenCalledTimes(1);
    expect(extractTriplesForSingleRequest).toHaveBeenCalledWith(input);

    expect(sparql).toContain(`PREFIX ex: <${EX}>`);
    expect(sparql).toContain(`PREFIX content: <${CONTENT}>`);
    expect(sparql).toContain('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>');
    expect(sparql).toContain('PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>');

    expect(sparql).toContain(`GRAPH <${G_HTTP}> {`);

    expect(sparql).toContain('# triple-1');
    expect(sparql).toContain('# triple-2');

    expect(sparql.trim().startsWith('PREFIX ex')).toBe(true);
    expect(sparql).toContain('INSERT DATA {');
  });

  test('uses p.graph when provided instead of G_HTTP', () => {
    extractTriplesForSingleRequest.mockReturnValue(['# only-triple']);

    const customGraph = 'http://example.com/graphs/custom-http';
    const input = {
      id: 'req-2',
      method: 'POST',
      uri: { full: 'https://api.example.com/items' },
      graph: customGraph,
    };

    const sparql = buildInsertFromHttpRequest(input);

    expect(sparql).toContain(`GRAPH <${customGraph}> {`);
    expect(sparql).not.toContain(`GRAPH <${G_HTTP}> {`);

    expect(sparql).toContain('# only-triple');
  });

  test('propagates errors thrown by extractTriplesForSingleRequest (e.g. missing fields)', () => {
    extractTriplesForSingleRequest.mockImplementation(() => {
      throw new Error('Missing id/method/uri.full');
    });

    const badInput = {
      method: 'GET',
      uri: { full: 'https://example.com' },
    };

    expect(() => buildInsertFromHttpRequest(badInput)).toThrow(
      'Missing id/method/uri.full'
    );
  });
});
