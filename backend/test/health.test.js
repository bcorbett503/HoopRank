const { createServer } = require('../src/server');

const startServer = () =>
  new Promise((resolve) => {
    const server = createServer();
    server.listen(0, () => resolve(server));
  });

describe('health endpoints', () => {
  let server;

  afterEach(() => {
    if (server) {
      server.close();
      server = undefined;
    }
  });

  test('GET /health returns ok payload', async () => {
    server = await startServer();
    const { port } = server.address();

    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({ status: 'ok' });
    expect(new Date(body.ts).toString()).not.toBe('Invalid Date');
  });

  test('GET /api/v1/version returns current version', async () => {
    server = await startServer();
    const { port } = server.address();

    const res = await fetch(`http://127.0.0.1:${port}/api/v1/version`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ version: '0.1.0' });
  });
});
