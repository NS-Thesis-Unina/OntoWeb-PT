const express = require('express');
const request = require('supertest');
const { errors: celebrateErrors } = require('celebrate');

jest.mock('../../../src/queue', () => ({
  queueHttpRequests: {
    add: jest.fn(),
    getJob: jest.fn(),
  },
}));

jest.mock('../../../src/utils/graphdb/client', () => ({
  runSelect: jest.fn(),
  runUpdate: jest.fn(),
}));

const { runSelect } = require('../../../src/utils/graphdb/client');
const httpRouter = require('../../../src/routes/httpRequests');

/**
 * Helper app Express, router httpRequests mounted.
 */
function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/http-requests', httpRouter);
  app.use(celebrateErrors());
  return app;
}

/**
 * Helper for SPARQL JSON cell.
 * @param {string|number} value
 */
function lit(value) {
  return { type: 'literal', value: String(value) };
}

describe('GET /http-requests/finding/list (integration)', () => {
  beforeEach(() => {
    runSelect.mockReset();
  });

  test('returns items and pagination metadata when GraphDB returns rows', async () => {
    runSelect.mockResolvedValueOnce({
      head: { vars: ['id', 'total'] },
      results: {
        bindings: [
          { id: lit('urn:finding:1'), total: lit('2') },
          { id: lit('urn:finding:2'), total: lit('2') },
        ],
      },
    });

    const app = createApp();

    const res = await request(app)
      .get('/http-requests/finding/list')
      .query({ limit: 1, offset: 0 });

    expect(runSelect).toHaveBeenCalledTimes(1);
    const sparql = runSelect.mock.calls[0][0];
    expect(typeof sparql).toBe('string');
    expect(sparql).toContain('LIMIT 1');
    expect(sparql).toContain('OFFSET 0');

    expect(res.status).toBe(200);

    expect(res.body.items).toEqual(['urn:finding:1', 'urn:finding:2']);

    expect(res.body.page).toEqual({
      limit: 1,
      offset: 0,
      total: 2,
      hasNext: true,
      hasPrev: false,
      nextOffset: 1,
      prevOffset: null,
    });
  });

  test('returns empty items array when page has no ids but still exposes total', async () => {
    runSelect.mockResolvedValueOnce({
      head: { vars: ['total'] },
      results: {
        bindings: [
          {
            total: lit('5'),
          },
        ],
      },
    });

    const app = createApp();

    const res = await request(app)
      .get('/http-requests/finding/list')
      .query({ limit: 10, offset: 20 });

    expect(runSelect).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);

    expect(res.body.items).toEqual([]);

    expect(res.body.page).toEqual({
      limit: 10,
      offset: 20,
      total: 5,
      hasNext: false,
      hasPrev: true,
      nextOffset: null,
      prevOffset: 10,
    });
  });

  test('returns 502 when GraphDB runSelect throws', async () => {
    runSelect.mockRejectedValueOnce(new Error('GraphDB down'));

    const app = createApp();

    const res = await request(app)
      .get('/http-requests/finding/list')
      .query({ limit: 5, offset: 0 });

    expect(runSelect).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({
      error: 'GraphDB query failed',
    });
    expect(typeof res.body.detail).toBe('string');
  });

  test('returns 400 when query params fail Joi validation (negative limit/offset)', async () => {
    const app = createApp();

    const res = await request(app)
      .get('/http-requests/finding/list')
      .query({ limit: -1, offset: -5 });

    expect(runSelect).not.toHaveBeenCalled();
    expect(res.status).toBe(400);
  });
});
