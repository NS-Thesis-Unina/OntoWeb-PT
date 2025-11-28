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

const { queueTechstack } = require('../../../src/queue');
const techstackRouter = require('../../../src/routes/techstack');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/techstack', techstackRouter);
  app.use(celebrateErrors());
  return app;
}

describe('GET /techstack/results/:jobId (integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 200 with job status when job exists', async () => {
    const fakeJob = {
      id: 'job-1',
      getState: jest.fn().mockResolvedValue('completed'),
      returnvalue: { ok: true },
      timestamp: 111,
      finishedOn: 222,
    };

    queueTechstack.getJob.mockResolvedValue(fakeJob);

    const app = createApp();
    const res = await request(app).get('/techstack/results/job-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      jobId: 'job-1',
      state: 'completed',
      result: { ok: true },
      createdAt: 111,
      finishedAt: 222,
    });

    expect(queueTechstack.getJob).toHaveBeenCalledWith('job-1');
    expect(fakeJob.getState).toHaveBeenCalled();
  });

  test('returns 404 when job does not exist', async () => {
    queueTechstack.getJob.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app).get('/techstack/results/missing');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'Job not found',
      jobId: 'missing',
    });
  });

  test('returns 500 when queue.getJob throws', async () => {
    queueTechstack.getJob.mockRejectedValue(new Error('Redis down'));

    const app = createApp();
    const res = await request(app).get('/techstack/results/job-err');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'Failed to retrieve results',
      detail: 'Redis down',
    });
  });
});
