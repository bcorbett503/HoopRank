const { Client } = require('pg');

const connectionString = 'postgres://hooprank:hooprank@localhost:5432/hooprank';

console.log('Testing connection to:', connectionString);

const client = new Client({
    connectionString,
    ssl: false
});

client.connect()
    .then(() => {
        console.log('✅ Successfully connected to database!');
        return client.query('SELECT NOW()');
    })
    .then((res) => {
        console.log('Query result:', res.rows[0]);
        client.end();
    })
    .catch((err) => {
        console.error('❌ Connection error:', err.message);
        console.error('Full error:', err);
        process.exit(1);
    });
