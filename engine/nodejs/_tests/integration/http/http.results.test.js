const express = require('express');
const request = require('supertest');
const { errors: celebrateErrors } = require('celebrate');

jest.mock('../../../src/queue', () => ({
  queueHttpRequests: {
    add: jest.fn(),
    getJob: jest.fn(),
  },
}));

const { queueHttpRequests } = require('../../../src/queue');
const httpRouter = require('../../../src/routes/httpRequests');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/http-requests', httpRouter);
  app.use(celebrateErrors());
  return app;
}

describe('GET /http-requests/results/:jobId (integration)', () => {
  beforeEach(() => {
    queueHttpRequests.getJob.mockReset();
  });

  test('returns 200 with job status when job exists', async () => {
    const jobId = 'job-123';

    const fakeJob = {
      id: jobId,
      getState: jest.fn().mockResolvedValue('completed'),
      returnvalue: { status: 204, count: 10 },
      timestamp: 1700000000000,
      finishedOn: 1700000001234,
    };

    queueHttpRequests.getJob.mockResolvedValueOnce(fakeJob);

    const app = createApp();

    const res = await request(app).get(`/http-requests/results/${jobId}`);

    expect(queueHttpRequests.getJob).toHaveBeenCalledTimes(1);
    expect(queueHttpRequests.getJob).toHaveBeenCalledWith(jobId);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      jobId,
      state: 'completed',
      result: { status: 204, count: 10 },
      createdAt: fakeJob.timestamp,
      finishedAt: fakeJob.finishedOn,
    });

    expect(fakeJob.getState).toHaveBeenCalledTimes(1);
  });

  test('returns 404 when job does not exist', async () => {
    const jobId = 'job-missing';

    queueHttpRequests.getJob.mockResolvedValueOnce(null);

    const app = createApp();

    const res = await request(app).get(`/http-requests/results/${jobId}`);

    expect(queueHttpRequests.getJob).toHaveBeenCalledTimes(1);
    expect(queueHttpRequests.getJob).toHaveBeenCalledWith(jobId);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'Job not found',
      jobId,
    });
  });

  test('returns 500 when queue.getJob or job.getState throws', async () => {
    const jobId = 'job-error';

    queueHttpRequests.getJob.mockRejectedValueOnce(new Error('Redis down'));

    const app = createApp();

    const res = await request(app).get(`/http-requests/results/${jobId}`);

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      error: 'Failed to retrieve results',
    });
    expect(typeof res.body.detail).toBe('string');
  });
});
