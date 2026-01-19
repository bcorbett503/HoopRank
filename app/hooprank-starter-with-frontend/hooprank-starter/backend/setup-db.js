const { Client } = require('pg');

const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
    ssl: false
});

console.log('Testing connection as postgres superuser...');

client.connect()
    .then(() => {
        console.log('✅ Connected as postgres!');
        // Try to create hooprank user and database
        return client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'hooprank') THEN
          CREATE USER hooprank WITH PASSWORD 'hooprank';
        END IF;
      END
      $$;
    `);
    })
    .then(() => {
        console.log('✅ User hooprank created/exists');
        return client.query(`
      SELECT 1 FROM pg_database WHERE datname = 'hooprank';
    `);
    })
    .then((res) => {
        if (res.rows.length === 0) {
            console.log('Creating hooprank database...');
            return client.query('CREATE DATABASE hooprank OWNER hooprank;');
        } else {
            console.log('✅ Database hooprank already exists');
        }
    })
    .then(() => {
        console.log('✅ Setup complete!');
        client.end();
    })
    .catch((err) => {
        console.error('❌ Error:', err.message);
        client.end();
        process.exit(1);
    });
