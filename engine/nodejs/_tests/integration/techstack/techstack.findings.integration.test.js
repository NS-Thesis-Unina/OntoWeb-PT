const express = require('express');
const request = require('supertest');
const { errors: celebrateErrors } = require('celebrate');

jest.mock('../../../src/queue', () => {
  const queueTechstack = {
    add: jest.fn(),
    getJob: jest.fn(),
  };
  return { queueTechstack };
});

jest.mock('../../../src/utils/graphdb/client', () => ({
  runSelect: jest.fn(),
  runUpdate: jest.fn(),
}));

const { runSelect } = require('../../../src/utils/graphdb/client');
const techstackRouter = require('../../../src/routes/techstack');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/techstack', techstackRouter);
  app.use(celebrateErrors());
  return app;
}

describe('GET /techstack/finding/list (integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns paginated list of findings with page metadata', async () => {
    runSelect.mockResolvedValue({
      head: { vars: ['id', 'total'] },
      results: {
        bindings: [
          {
            id: { type: 'uri', value: 'urn:finding:techstack:1' },
            total: { type: 'literal', value: '3' },
          },
          {
            id: { type: 'uri', value: 'urn:finding:techstack:2' },
            total: { type: 'literal', value: '3' },
          },
        ],
      },
    });

    const app = createApp();
    const res = await request(app).get('/techstack/finding/list?limit=2&offset=0');

    expect(res.status).toBe(200);

    expect(runSelect).toHaveBeenCalledTimes(1);
    const sparql = runSelect.mock.calls[0][0];
    expect(sparql).toMatch(/LIMIT\s+2\b/);
    expect(sparql).toMatch(/OFFSET\s+0\b/);

    expect(res.body.items).toEqual([
      'urn:finding:techstack:1',
      'urn:finding:techstack:2',
    ]);
    expect(res.body.page).toEqual({
      limit: 2,
      offset: 0,
      total: 3,
      hasNext: true,
      hasPrev: false,
      nextOffset: 2,
      prevOffset: null,
    });
  });

  test('returns 502 when GraphDB query fails on list', async () => {
    runSelect.mockRejectedValue(new Error('GraphDB down'));

    const app = createApp();
    const res = await request(app).get('/techstack/finding/list?limit=10&offset=0');

    expect(res.status).toBe(502);
    expect(res.body).toEqual({
      error: 'GraphDB query failed',
      detail: 'GraphDB down',
    });
  });
});

describe('GET /techstack/finding/:id (integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns finding detail when found', async () => {
    runSelect.mockResolvedValue({
      head: { vars: ['id', 'severity', 'evidenceType', 'technologyName'] },
      results: {
        bindings: [
          {
            id: { type: 'uri', value: 'urn:finding:techstack:detail-1' },
            severity: { type: 'literal', value: 'HIGH' },
            evidenceType: { type: 'literal', value: 'Technology' },
            technologyName: { type: 'literal', value: 'nginx' },
          },
        ],
      },
    });

    const app = createApp();
    const id = 'urn:finding:techstack:detail-1';

    const res = await request(app).get(
      `/techstack/finding/${encodeURIComponent(id)}`
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      severity: 'HIGH',
      software: {
        type: 'Technology',
        name: 'nginx',
      },
    });
  });

  test('returns 404 when finding not found', async () => {
    runSelect.mockResolvedValue({
      head: { vars: [] },
      results: { bindings: [] },
    });

    const app = createApp();
    const id = 'urn:finding:techstack:missing';

    const res = await request(app).get(
      `/techstack/finding/${encodeURIComponent(id)}`
    );

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'Not found',
      id,
    });
  });

  test('returns 502 when GraphDB query fails on detail', async () => {
    runSelect.mockRejectedValue(new Error('GraphDB error'));

    const app = createApp();
    const id = 'urn:finding:techstack:boom';

    const res = await request(app).get(
      `/techstack/finding/${encodeURIComponent(id)}`
    );

    expect(res.status).toBe(502);
    expect(res.body).toEqual({
      error: 'GraphDB query failed',
      detail: 'GraphDB error',
    });
  });
});
