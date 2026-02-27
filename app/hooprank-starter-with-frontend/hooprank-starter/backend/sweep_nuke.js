const http = require('http');

async function probe(port) {
    return new Promise((resolve) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: port,
            path: '/cleanup/nuke-templates',
            method: 'GET'
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ port, status: res.statusCode, body: data }));
        });

        req.on('error', () => resolve({ port, error: true }));
        req.setTimeout(500, () => { req.destroy(); resolve({ port, timeout: true }); });
        req.end();
    });
}

async function sweep() {
    console.log("Sweeping localhost ports 3000-3020 for the active NestJS server...");
    for (let port = 3000; port <= 3020; port++) {
        const result = await probe(port);
        if (!result.error && !result.timeout) {
            console.log(`Port ${port} Responded with HTTP ${result.status}:`, result.body);
            if (result.status === 200) {
                console.log("✅ SUCCESSFULLY HIT NUKE ENDPOINT.");
                process.exit(0);
            }
        }
    }
    console.log("Sweep complete. No active NestJS server found.");
}

sweep();
