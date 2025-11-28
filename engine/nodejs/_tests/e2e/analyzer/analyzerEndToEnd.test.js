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

jest.mock('../../../src/queue', () => {
  const { resolveAnalyzer } = require('../../../src/utils/resolvers/analyzer/resolveAnalyzer');

  /** @type {Map<string, any>} */
  const jobs = new Map();
  let mockJobSeq = 1;

  return {
    queueAnalyzer: {
      add: async (name, data) => {
        if (name !== 'sast-analyze') {
          throw new Error(`Unexpected job name: ${name}`);
        }

        const id = `job-${mockJobSeq++}`;
        const now = Date.now();

        const analysisResult = await resolveAnalyzer({
          url: data.url,
          html: data.html,
          scripts: data.scripts,
          forms: data.forms,
          iframes: data.iframes,
          includeSnippets: data.includeSnippets ?? false,
        });

        jobs.set(id, {
          id,
          state: 'completed',
          timestamp: now,
          finishedOn: now,
          returnvalue: {
            result: analysisResult,
            insertStatus: null,
          },
        });

        return { id };
      },

      getJob: async (id) => {
        const job = jobs.get(id);
        if (!job) return null;

        return {
          id: job.id,
          timestamp: job.timestamp,
          finishedOn: job.finishedOn,
          returnvalue: job.returnvalue,
          getState: async () => job.state,
        };
      },
    },
  };
});

jest.mock('../../../src/utils/graphdb/client', () => ({
  runSelect: jest.fn(),
  runUpdate: jest.fn(),
}));

const analyzerRouter = require('../../../src/routes/analyzer');

describe('Analyzer end-to-end (API + resolver)', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/analyzer', analyzerRouter);
    app.use(errors());
  });

  test('full flow: POST /analyzer/analyze then GET /analyzer/results/:jobId', async () => {
    const payload = {
      url: 'https://example.test/',
      html: `
        <html>
          <body>
            <form method="get" action="/search">
              <input name="q" />
            </form>
            <script>
              eval("alert(location.href)");
            </script>
          </body>
        </html>
      `,
      scripts: [
        {
          code: 'eval("alert(location.href)")',
        },
      ],
      forms: [
        {
          action: '/search',
          method: 'GET',
          inputs: [{ name: 'q', tag: 'input', type: 'text' }],
        },
      ],
      iframes: [],
      includeSnippets: true,
    };

    const postRes = await request(app)
      .post('/analyzer/analyze')
      .send(payload)
      .expect(202);

    expect(postRes.body.accepted).toBe(true);
    expect(typeof postRes.body.jobId).toBe('string');
    const jobId = postRes.body.jobId;

    const getRes = await request(app)
      .get(`/analyzer/results/${jobId}`)
      .expect(200);

    expect(getRes.body.jobId).toBe(jobId);
    expect(getRes.body.state).toBe('completed');
    expect(getRes.body.createdAt).toBeDefined();
    expect(getRes.body.finishedAt).toBeDefined();

    const payloadResult = getRes.body.result;
    expect(payloadResult).toBeDefined();
    expect(payloadResult.result.ok).toBe(true);
    expect(typeof payloadResult.result.totalFindings).toBe('number');
    expect(Array.isArray(payloadResult.result.findings)).toBe(true);
    expect(payloadResult.insertStatus).toBeNull();

    const severities = payloadResult.result.findings.map((f) => f.severity);
    expect(severities.some((s) => s === 'high' || s === 'medium')).toBe(true);
  });

  test('returns 404 for unknown jobId in end-to-end flow', async () => {
    const res = await request(app)
      .get('/analyzer/results/non-existent-job')
      .expect(404);

    expect(res.body).toEqual({
      error: 'Job not found',
      jobId: 'non-existent-job',
    });
  });
});
