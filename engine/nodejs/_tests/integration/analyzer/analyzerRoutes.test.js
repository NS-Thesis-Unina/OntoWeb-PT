const express = require('express');
const request = require('supertest');
const { errors } = require('celebrate');

jest.mock('../../../src/utils/logs/logger', () => ({
  makeLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

const mockAdd = jest.fn();
const mockGetJob = jest.fn();

jest.mock('../../../src/queue', () => ({
  queueAnalyzer: {
    add: (...args) => mockAdd(...args),
    getJob: (...args) => mockGetJob(...args),
  },
}));

const mockRunSelect = jest.fn();

jest.mock('../../../src/utils/graphdb/client', () => ({
  runSelect: (...args) => mockRunSelect(...args),
  runUpdate: jest.fn(),
}));

const analyzerRouter = require('../../../src/routes/analyzer');

describe('Analyzer routes (integration)', () => {
  let app;

  beforeEach(() => {
    mockAdd.mockReset();
    mockGetJob.mockReset();
    mockRunSelect.mockReset();

    app = express();
    app.use(express.json());
    app.use('/analyzer', analyzerRouter);
    app.use(errors());
  });

  test('POST /analyzer/analyze enqueues a job and returns 202', async () => {
    mockAdd.mockResolvedValue({ id: 'job-123' });

    const payload = {
      url: 'https://example.test/',
      html: '<html><body></body></html>',
      scripts: [{ code: 'console.log(1)' }],
      forms: [],
      iframes: [],
      includeSnippets: true,
    };

    const res = await request(app)
      .post('/analyzer/analyze')
      .send(payload)
      .expect(202);

    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledWith('sast-analyze', {
      url: payload.url,
      html: payload.html,
      scripts: payload.scripts,
      forms: payload.forms,
      iframes: payload.iframes,
      includeSnippets: payload.includeSnippets,
    });

    expect(res.body).toEqual({
      accepted: true,
      jobId: 'job-123',
      url: payload.url,
      scripts: 1,
      forms: 0,
      iframes: 0,
      includeSnippets: true,
    });
  });

  test('POST /analyzer/analyze returns 500 when enqueue fails', async () => {
    mockAdd.mockRejectedValue(new Error('queue down'));

    const payload = {
      url: 'https://example.test/',
      html: '',
      scripts: [],
      forms: [],
      iframes: [],
      includeSnippets: false,
    };

    const res = await request(app)
      .post('/analyzer/analyze')
      .send(payload)
      .expect(500);

    expect(res.body.error).toBe('Enqueue failed');
    expect(res.body.detail).toContain('queue down');
  });

  test('GET /analyzer/results/:jobId returns job status and result', async () => {
    const job = {
      id: 'job-1',
      timestamp: 1234,
      finishedOn: 5678,
      returnvalue: { result: { ok: true }, insertStatus: 204 },
      getState: jest.fn().mockResolvedValue('completed'),
    };

    mockGetJob.mockResolvedValue(job);

    const res = await request(app).get('/analyzer/results/job-1').expect(200);

    expect(mockGetJob).toHaveBeenCalledWith('job-1');
    expect(res.body).toEqual({
      jobId: 'job-1',
      state: 'completed',
      result: job.returnvalue,
      createdAt: job.timestamp,
      finishedAt: job.finishedOn,
    });
  });

  test('GET /analyzer/results/:jobId returns 404 when job is not found', async () => {
    mockGetJob.mockResolvedValue(null);

    const res = await request(app).get('/analyzer/results/unknown').expect(404);

    expect(res.body).toEqual({
      error: 'Job not found',
      jobId: 'unknown',
    });
  });

  test('GET /analyzer/results/:jobId returns 500 on queue error', async () => {
    mockGetJob.mockRejectedValue(new Error('redis error'));

    const res = await request(app).get('/analyzer/results/job-1').expect(500);

    expect(res.body.error).toBe('Failed to retrieve results');
    expect(res.body.detail).toContain('redis error');
  });

  test('GET /analyzer/finding/list returns paginated list of IDs', async () => {
    mockRunSelect.mockResolvedValue({
      head: { vars: ['id', 'total'] },
      results: {
        bindings: [
          {
            id: { type: 'uri', value: 'urn:finding:1' },
            total: { type: 'literal', value: '3' },
          },
          {
            id: { type: 'uri', value: 'urn:finding:2' },
            total: { type: 'literal', value: '3' },
          },
        ],
      },
    });

    const res = await request(app)
      .get('/analyzer/finding/list?limit=2&offset=0')
      .expect(200);

    expect(mockRunSelect).toHaveBeenCalledTimes(1);
    expect(res.body.items).toEqual(['urn:finding:1', 'urn:finding:2']);
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

  test('GET /analyzer/finding/list returns 502 on GraphDB error', async () => {
    mockRunSelect.mockRejectedValue(new Error('GraphDB down'));

    const res = await request(app)
      .get('/analyzer/finding/list?limit=10&offset=0')
      .expect(502);

    expect(res.body.error).toBe('GraphDB query failed');
    expect(res.body.detail).toContain('GraphDB down');
  });

  test('GET /analyzer/finding/:id returns a detailed finding', async () => {
    mockRunSelect.mockResolvedValue({
      head: { vars: ['id', 'severity'] },
      results: {
        bindings: [
          {
            id: { type: 'uri', value: 'urn:finding:1' },
            severity: { type: 'literal', value: 'HIGH' },
          },
        ],
      },
    });

    const res = await request(app)
      .get('/analyzer/finding/urn:finding:1')
      .expect(200);

    expect(mockRunSelect).toHaveBeenCalledTimes(1);
    expect(res.body.id).toBe('urn:finding:1');
    expect(res.body.severity).toBe('HIGH');
  });

  test('GET /analyzer/finding/:id returns 404 when not found', async () => {
    mockRunSelect.mockResolvedValue({
      head: { vars: ['id', 'severity'] },
      results: { bindings: [] },
    });

    const res = await request(app)
      .get('/analyzer/finding/urn:finding:missing')
      .expect(404);

    expect(res.body).toEqual({
      error: 'Not found',
      id: 'urn:finding:missing',
    });
  });

  test('GET /analyzer/finding/:id returns 502 on GraphDB error', async () => {
    mockRunSelect.mockRejectedValue(new Error('GraphDB error'));

    const res = await request(app)
      .get('/analyzer/finding/urn:finding:1')
      .expect(502);

    expect(res.body.error).toBe('GraphDB query failed');
    expect(res.body.detail).toContain('GraphDB error');
  });
});
