const express = require('express');
const request = require('supertest');
const { errors: celebrateErrors } = require('celebrate');

jest.mock('../../../src/queue', () => ({
  queueHttpRequests: {
    add: jest.fn(),
    getJob: jest.fn(),
  },
}));

// Mock GraphDB client (runSelect).
jest.mock('../../../src/utils/graphdb/client', () => ({
  runSelect: jest.fn(),
  runUpdate: jest.fn(),
}));

const { runSelect } = require('../../../src/utils/graphdb/client');
const httpRouter = require('../../../src/routes/httpRequests');
const { G_HTTP } = require('../../../src/utils/constants');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/http-requests', httpRouter);
  app.use(celebrateErrors());
  return app;
}

/**
 * Helper for SPARQL binding cell.
 */
function lit(value) {
  return { type: 'literal', value: String(value) };
}

describe('GET /http-requests/:id (integration)', () => {
  beforeEach(() => {
    runSelect.mockReset();
  });

  test('returns 200 with HTTP request data when found', async () => {
    const id = 'req-42';

    runSelect.mockResolvedValueOnce({
      head: { vars: ['id', 'methodName', 'uriFull'] },
      results: {
        bindings: [
          {
            id: lit(id),
            methodName: lit('GET'),
            uriFull: lit('https://example.com/foo'),
          },
        ],
      },
    });

    const app = createApp();

    const res = await request(app).get(`/http-requests/${id}`);

    expect(runSelect).toHaveBeenCalledTimes(1);
    const sparql = runSelect.mock.calls[0][0];

    expect(typeof sparql).toBe('string');
    expect(sparql).toContain(id);

    expect(res.status).toBe(200);

    expect(res.body).toMatchObject({
      id,
      method: 'GET',
      uri: {
        full: 'https://example.com/foo',
      },
      graph: G_HTTP,
    });
  });

  test('returns 404 when no HTTP request is found for the given id', async () => {
    const id = 'req-missing';

    runSelect.mockResolvedValueOnce({
      head: { vars: ['id'] },
      results: { bindings: [] },
    });

    const app = createApp();

    const res = await request(app).get(`/http-requests/${id}`);

    expect(runSelect).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  test('returns 502 when GraphDB runSelect throws', async () => {
    const id = 'req-error';

    runSelect.mockRejectedValueOnce(new Error('GraphDB down'));

    const app = createApp();

    const res = await request(app).get(`/http-requests/${id}`);

    expect(runSelect).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({
      error: 'GraphDB query failed',
    });
    expect(typeof res.body.detail).toBe('string');
  });

  test('returns 400 when id param does not pass Joi validation', async () => {
    const longId = 'x'.repeat(300);

    const app = createApp();

    const res = await request(app).get(`/http-requests/${longId}`);

    expect(runSelect).not.toHaveBeenCalled();
    expect(res.status).toBe(400);
  });
});
