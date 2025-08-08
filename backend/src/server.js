const http = require('http');

const version = '0.1.0';

function createServer() {
  return http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', ts: new Date().toISOString() }));
    } else if (req.method === 'GET' && req.url === '/api/v1/version') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ version }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  const server = createServer();
  server.listen(port, () => console.log(`API listening on ${port}`));
}

module.exports = { createServer };
