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

describe('POST /techstack/analyze (integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('enqueues techstack-analyze job and returns 202 with counts', async () => {
    queueTechstack.add.mockResolvedValue({ id: 'job-tech-1' });

    const app = createApp();

    const body = {
      technologies: [
        { name: 'nginx', version: '1.22.0' },
        { name: 'node', version: '18' },
      ],
      waf: [{ name: 'mod_security', version: '3' }],
      secureHeaders: [
        {
          header: 'Strict-Transport-Security',
          description: 'HSTS header',
          urls: ['https://example.com'],
        },
      ],
      cookies: [
        {
          name: 'sessionid',
          domain: 'example.com',
          secure: true,
          httpOnly: true,
          sameSite: 'Lax',
          expirationDate: null,
        },
      ],
      mainDomain: 'example.com',
    };

    const res = await request(app).post('/techstack/analyze').send(body);

    expect(res.status).toBe(202);
    expect(res.body).toEqual({
      accepted: true,
      jobId: 'job-tech-1',
      technologies: 2,
      waf: 1,
      secureHeaders: 1,
      cookies: 1,
    });

    expect(queueTechstack.add).toHaveBeenCalledTimes(1);
    expect(queueTechstack.add).toHaveBeenCalledWith(
      'techstack-analyze',
      expect.objectContaining({
        technologies: expect.any(Array),
        waf: expect.any(Array),
        secureHeaders: expect.any(Array),
        cookies: expect.any(Array),
        mainDomain: 'example.com',
      })
    );
  });

  test('returns 400 and does not enqueue when payload is invalid', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/techstack/analyze')
      .send({ waf: [] });

    expect(res.status).toBe(400);
    expect(queueTechstack.add).not.toHaveBeenCalled();
  });

  test('returns 500 and error payload when queue add throws', async () => {
    queueTechstack.add.mockRejectedValue(new Error('Redis down'));

    const app = createApp();

    const body = {
      technologies: [{ name: 'nginx', version: '1.22.0' }],
      waf: [],
      secureHeaders: [],
      cookies: [],
      mainDomain: null,
    };

    const res = await request(app).post('/techstack/analyze').send(body);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'Enqueue failed',
      detail: 'Redis down',
    });
  });
});
