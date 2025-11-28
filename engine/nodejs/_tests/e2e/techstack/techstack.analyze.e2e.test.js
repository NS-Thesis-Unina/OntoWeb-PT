const express = require('express');
const request = require('supertest');
const { errors: celebrateErrors } = require('celebrate');

jest.mock('../../../src/utils/graphdb/client', () => ({
  runSelect: jest.fn(),
  runUpdate: jest.fn().mockResolvedValue(204),
}));

jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
  },
}));

jest.mock('../../../src/queue', () => {
  const utils = require('../../../src/utils');
  const {
    findingBuilders: { buildInsertFromFindingsArray },
    resolvers: {
      techstack: { resolveTechstack },
    },
  } = utils;

  const { runUpdate } = require('../../../src/utils/graphdb/client');

  const state = {
    jobs: [],
    findingsInsertSparql: [],
  };

  const queueTechstack = {
    add: jest.fn().mockImplementation(async (name, data) => {
      if (name !== 'techstack-analyze') {
        throw new Error(`Unknown job: ${name}`);
      }

      const result = await resolveTechstack(data);

      let insertStatus = null;
      if (result && Array.isArray(result.findings) && result.findings.length > 0) {
        const findingsForInsert = result.findings.map((f) => ({
          ...f,
          source: f.source || 'techstack',
        }));
        const sparql = buildInsertFromFindingsArray(findingsForInsert);
        state.findingsInsertSparql.push(sparql);
        insertStatus = await runUpdate(sparql);
      }

      state.jobs.push({ name, data, result, insertStatus });
      return { id: 'job-techstack-1' };
    }),
    getJob: jest.fn(),
  };

  return { queueTechstack, __state: state };
});

const axios = require('axios').default;
const { runUpdate } = require('../../../src/utils/graphdb/client');
const { queueTechstack, __state } = require('../../../src/queue');
const techstackRouter = require('../../../src/routes/techstack');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/techstack', techstackRouter);
  app.use(celebrateErrors());
  return app;
}

describe('E2E Techstack - POST /techstack/analyze', () => {
  const sampleNvdResponse = {
    vulnerabilities: [
      {
        cve: {
          id: 'CVE-2024-0001',
          metrics: {
            cvssMetricV31: [
              {
                cvssData: {
                  baseScore: 9.8,
                  baseSeverity: 'CRITICAL',
                },
              },
            ],
          },
          configurations: [
            {
              nodes: [
                {
                  cpeMatch: [
                    { criteria: 'cpe:/a:nginx:nginx:1.22.0' },
                  ],
                },
              ],
            },
          ],
        },
      },
    ],
  };

  beforeEach(() => {
    queueTechstack.add.mockClear();
    runUpdate.mockClear();
    axios.get.mockReset();

    __state.jobs.length = 0;
    __state.findingsInsertSparql.length = 0;

    axios.get.mockResolvedValue({ data: sampleNvdResponse });
  });

  test('analyzes techstack payload end-to-end (resolver + SPARQL builders)', async () => {
    const app = createApp();

    const payload = {
      technologies: [{ name: 'nginx', version: '1.22.0' }],
      waf: [{ name: 'mod_security' }],
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
          secure: false,
          httpOnly: false,
          sameSite: null,
          expirationDate: null,
        },
      ],
      mainDomain: 'example.com',
    };

    const res = await request(app).post('/techstack/analyze').send(payload);

    expect(res.status).toBe(202);
    expect(res.body).toEqual({
      accepted: true,
      jobId: 'job-techstack-1',
      technologies: 1,
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

    expect(__state.jobs).toHaveLength(1);
    const jobState = __state.jobs[0];

    expect(jobState.result.ok).toBe(true);
    expect(jobState.result.summary.totalFindings).toBeGreaterThan(0);

    expect(runUpdate).toHaveBeenCalled();
    const sparqlCalls = runUpdate.mock.calls.map(([query]) => query);

    expect(sparqlCalls.some((q) => q.includes('INSERT DATA'))).toBe(true);
    expect(sparqlCalls.some((q) => q.includes('TechstackScan'))).toBe(true);

    expect(__state.findingsInsertSparql.length).toBeGreaterThanOrEqual(1);
  });
});
