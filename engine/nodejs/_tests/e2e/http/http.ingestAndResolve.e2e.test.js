const express = require('express');
const request = require('supertest');
const { errors: celebrateErrors } = require('celebrate');

/**
 * Mock GraphDB client.
 */
jest.mock('../../../src/utils/graphdb/client', () => ({
  runSelect: jest.fn(),
  runUpdate: jest.fn().mockResolvedValue(204),
}));

jest.mock('../../../src/queue', () => {
  const utils = require('../../../src/utils');
  const {
    httpBuilders: {
      normalizeHttpRequestsPayload,
      buildInsertFromHttpRequest,
      buildInsertFromHttpRequestsArray,
    },
    findingBuilders: { buildInsertFromFindingsArray },
    resolvers: {
      http: { analyzeHttpRequests },
    },
  } = utils;

  const { runUpdate } = require('../../../src/utils/graphdb/client');

  const state = {
    ingestJobs: [],
    resolverJobs: [],
    findingsInsertSparql: [],
  };

  const queueHttpRequests = {
    add: jest.fn().mockImplementation(async (name, data) => {
      if (name === 'http-ingest') {
        const list = normalizeHttpRequestsPayload(data.payload);

        const sparql =
          list.length === 1
            ? buildInsertFromHttpRequest(list[0])
            : buildInsertFromHttpRequestsArray(list);

        state.ingestJobs.push({ data, list, sparql });

        await runUpdate(sparql);

        return { id: 'job-ingest-1' };
      }

      if (name === 'http-resolver') {
        const list = data.list;
        const result = await analyzeHttpRequests(list);

        state.resolverJobs.push({ data, result });

        if (result && Array.isArray(result.findings) && result.findings.length > 0) {
          const findingsForInsert = result.findings.map((f) => ({
            ...f,
            source: f.source || 'http',
          }));

          const sparql = buildInsertFromFindingsArray(findingsForInsert);
          state.findingsInsertSparql.push(sparql);

          await runUpdate(sparql);
        }

        return { id: 'job-resolver-1' };
      }

      throw new Error(`Unknown job: ${name}`);
    }),
  };

  return {
    queueHttpRequests,
    __state: state,
  };
});

const { queueHttpRequests, __state } = require('../../../src/queue');
const { runUpdate } = require('../../../src/utils/graphdb/client');
const httpRouter = require('../../../src/routes/httpRequests');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/http-requests', httpRouter);
  app.use(celebrateErrors());
  return app;
}

describe('E2E HTTP - POST /http-requests/ingest-http', () => {
  beforeEach(() => {
    queueHttpRequests.add.mockClear();
    runUpdate.mockClear();
    __state.ingestJobs.length = 0;
    __state.resolverJobs.length = 0;
    __state.findingsInsertSparql.length = 0;
  });

  test('ingests and resolves HTTP requests end-to-end (queue + resolver + SPARQL builders)', async () => {
    const app = createApp();

    const rawRequest = {
      id: 'req-1',
      method: 'GET',
      uri: {
        full: 'http://insecure.example.com/path',
      },
    };

    const res = await request(app)
      .post('/http-requests/ingest-http')
      .send({
        items: [rawRequest],
        activateResolver: true,
      });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({
      resRequest: {
        accepted: true,
        jobId: 'job-ingest-1',
        count: 1,
      },
      resResolver: {
        accepted: true,
        jobId: 'job-resolver-1',
        count: 1,
      },
    });

    expect(queueHttpRequests.add).toHaveBeenCalledTimes(2);
    expect(queueHttpRequests.add).toHaveBeenNthCalledWith(
      1,
      'http-ingest',
      expect.objectContaining({
        payload: expect.any(Array),
      })
    );
    expect(queueHttpRequests.add).toHaveBeenNthCalledWith(
      2,
      'http-resolver',
      expect.objectContaining({
        list: expect.any(Array),
      })
    );

    expect(runUpdate).toHaveBeenCalled();
    expect(runUpdate.mock.calls.length).toBeGreaterThanOrEqual(1);

    expect(__state.ingestJobs).toHaveLength(1);
    const ingestJob = __state.ingestJobs[0];
    expect(ingestJob.list).toHaveLength(1);
    expect(ingestJob.list[0].id).toBe('req-1');

    expect(ingestJob.sparql).toContain('http://insecure.example.com/path');

    expect(__state.resolverJobs).toHaveLength(1);
    const resolverJob = __state.resolverJobs[0];
    const { result } = resolverJob;

    expect(result.ok).toBe(true);
    expect(result.totalFindings).toBeGreaterThanOrEqual(1);

    const ruleIds = result.findings.map((f) => f.ruleId);
    expect(ruleIds).toContain('insecure-http');

    expect(__state.findingsInsertSparql.length).toBeGreaterThanOrEqual(1);
    expect(__state.findingsInsertSparql[0]).toContain('HttpFinding');
  });

  test('ingests multiple HTTP requests without resolver (array payload)', async () => {
    const app = createApp();

    const rawRequests = [
      {
        id: 'req-1',
        method: 'GET',
        uri: {
          full: 'https://example.com/a',
        },
      },
      {
        id: 'req-2',
        method: 'POST',
        uri: {
          full: 'https://example.com/b',
        },
      },
    ];

    const res = await request(app)
      .post('/http-requests/ingest-http')
      .send(rawRequests);

    expect(res.status).toBe(202);
    expect(res.body).toEqual({
      resRequest: {
        accepted: true,
        jobId: 'job-ingest-1',
        count: 2,
      },
    });
    expect(res.body.resResolver).toBeUndefined();

    expect(queueHttpRequests.add).toHaveBeenCalledTimes(1);
    expect(queueHttpRequests.add).toHaveBeenCalledWith(
      'http-ingest',
      expect.objectContaining({
        payload: expect.any(Array),
      })
    );

    expect(__state.ingestJobs).toHaveLength(1);
    const ingestJob = __state.ingestJobs[0];

    expect(ingestJob.list).toHaveLength(2);
    expect(ingestJob.list.map((r) => r.id).sort()).toEqual(['req-1', 'req-2']);

    expect(runUpdate).toHaveBeenCalledTimes(1);
    const sparql = runUpdate.mock.calls[0][0];
    expect(sparql).toContain('https://example.com/a');
    expect(sparql).toContain('https://example.com/b');

    expect(__state.resolverJobs).toHaveLength(0);
    expect(__state.findingsInsertSparql).toHaveLength(0);
  });
});
