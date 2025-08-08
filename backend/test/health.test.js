const test = require('node:test');
const assert = require('node:assert');
const { createServer } = require('../src/server');

test('GET /health returns ok', async () => {
  const server = createServer();
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const res = await fetch(`http://127.0.0.1:${port}/health`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.status, 'ok');
  server.close();
});
