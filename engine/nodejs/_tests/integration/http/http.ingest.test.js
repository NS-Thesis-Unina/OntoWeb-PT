const express = require('express');
const request = require('supertest');
const { errors: celebrateErrors } = require('celebrate');

// Mock queue used by router.
jest.mock('../../../src/queue', () => ({
  queueHttpRequests: {
    add: jest.fn(),
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

describe('POST /http-requests/ingest-http (integration)', () => {
  beforeEach(() => {
    queueHttpRequests.add.mockReset();
  });

  test('enqueues http-ingest job and returns 202 with resRequest', async () => {
    queueHttpRequests.add.mockResolvedValueOnce({ id: 'job-123' });

    const app = createApp();

    const payload = {
      id: 'req-1',
      method: 'GET',
      uri: { full: 'https://example.com' },
    };

    const res = await request(app)
      .post('/http-requests/ingest-http')
      .send(payload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(202);

    expect(queueHttpRequests.add).toHaveBeenCalledTimes(1);
    expect(queueHttpRequests.add).toHaveBeenCalledWith('http-ingest', {
      payload: [payload],
    });

    expect(res.body).toEqual({
      resRequest: {
        accepted: true,
        jobId: 'job-123',
        count: 1,
      },
    });
  });

  test('enqueues both http-ingest and http-resolver when activateResolver is true', async () => {
    queueHttpRequests.add
      .mockResolvedValueOnce({ id: 'job-ingest-1' })
      .mockResolvedValueOnce({ id: 'job-resolver-1' });

    const app = createApp();

    const payload = {
      items: [
        { id: 'req-1', method: 'GET', uri: { full: 'https://example.com' } },
        { id: 'req-2', method: 'POST', uri: { full: 'https://example.com/items' } },
      ],
      activateResolver: true,
    };

    const res = await request(app)
      .post('/http-requests/ingest-http')
      .send(payload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(202);
    expect(queueHttpRequests.add).toHaveBeenCalledTimes(2);

    const [firstName, firstArgs] = queueHttpRequests.add.mock.calls[0];
    expect(firstName).toBe('http-ingest');
    expect(firstArgs).toEqual({ payload: payload.items });

    const [secondName, secondArgs] = queueHttpRequests.add.mock.calls[1];
    expect(secondName).toBe('http-resolver');
    expect(secondArgs).toEqual({ list: payload.items });

    expect(res.body).toEqual({
      resRequest: {
        accepted: true,
        jobId: 'job-ingest-1',
        count: 2,
      },
      resResolver: {
        accepted: true,
        jobId: 'job-resolver-1',
        count: 2,
      },
    });
  });

  test('returns 400 and does not enqueue when payload is invalid (Joi/celebrate)', async () => {
    const app = createApp();

    const invalidPayload = { foo: 'bar' };

    const res = await request(app)
      .post('/http-requests/ingest-http')
      .send(invalidPayload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(queueHttpRequests.add).not.toHaveBeenCalled();
  });

  test('returns 500 and error payload when queue add throws', async () => {
    queueHttpRequests.add.mockRejectedValueOnce(new Error('Redis down'));

    const app = createApp();

    const payload = {
      id: 'req-1',
      method: 'GET',
      uri: { full: 'https://example.com' },
    };

    const res = await request(app)
      .post('/http-requests/ingest-http')
      .send(payload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      error: 'Enqueue failed',
    });
    expect(typeof res.body.detail).toBe('string');
  });
});
