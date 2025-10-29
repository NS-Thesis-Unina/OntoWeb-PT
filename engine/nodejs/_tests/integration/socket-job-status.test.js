/* eslint-disable no-console */
const { getHealth, postIngestHttp, extractJobId } = require('../helpers/http');
const { connectSocket, subscribeToJob } = require('../helpers/socket');

jest.setTimeout(90000);

// Default graph for the test
const TEST_GRAPH = process.env.TEST_GRAPH_DEFAULT
  || 'http://example.com/graphs/http-requests';

describe('Socket emits job status updates (progress/completed/failed) for an ingest job', () => {
  let socket;

  beforeAll(async () => {
    // Ensure the HTTP layer is healthy (Nginx -> Node)
    const health = await getHealth();
    if (health.status !== 200) {
      throw new Error(`/health not OK. Status=${health.status} Body=${JSON.stringify(health.data)}`);
    }

    socket = connectSocket();
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('socket connect timeout')), 15000);
      socket.on('connect', () => { clearTimeout(timer); resolve(); });
      socket.on('connect_error', (e) => { clearTimeout(timer); reject(e); });
    });
  });

  afterAll(async () => {
    if (socket && socket.connected) socket.disconnect();
  });

  it('receives progress and completes for a single-item ingest job', async () => {
    const reqId = `req-socket-${Date.now()}`;

    // Create a "heavier" payload to reduce race conditions (gives time to subscribe)
    const bigBody = Buffer.alloc(500_000, 65).toString('base64'); // ~500KB of 'A' base64

    const body = {
      items: [
        {
          id: reqId,
          method: 'POST',
          httpVersion: 'HTTP/1.1',
          graph: TEST_GRAPH,
          uri: {
            full: 'https://api.example.com/v1/socket-check',
            scheme: 'https',
            authority: 'api.example.com',
            path: '/v1/socket-check'
          },
          requestHeaders: [{ name: 'Content-Type', value: 'application/json' }],
          bodyBase64: bigBody, // larger body to slow down the job
          response: { status: 200, reason: 'OK' }
        }
      ]
    };

    // Enqueue job
    const res = await postIngestHttp(body);
    expect([202, 200]).toContain(res.status);

    const jobId = extractJobId(res.data);
    expect(jobId).toBeTruthy();

    // Subscribe to that specific jobId per server contract
    const { events, waitForDone, cleanup } = subscribeToJob(socket, jobId, 60000);

    let outcome;
    try {
      outcome = await waitForDone; // { ok: boolean, payload }
    } finally {
      cleanup();
    }

    // At least one event should have been received
    expect(events.length).toBeGreaterThan(0);

    // Expect the job to complete successfully
    expect(outcome && typeof outcome.ok === 'boolean').toBe(true);
    if (!outcome.ok) {
      const last = events[events.length - 1];
      throw new Error(`job failed: ${JSON.stringify(last?.payload || outcome.payload)}`);
    }
  });
});
