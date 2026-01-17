import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = 'postgres://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway';

async function test() {
    const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    console.log('Connected!');

    // Run a simple CREATE TABLE directly
    const sql = `
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS citext;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    
    CREATE TABLE IF NOT EXISTS users (
      id text primary key,
      email text unique,
      username citext unique,
      name text not null,
      dob date,
      avatar_url text,
      hoop_rank numeric(2,1) not null default 3.0,
      reputation numeric(2,1) not null default 5.0,
      position text,
      height text,
      weight integer,
      zip text,
      loc_enabled boolean not null default false,
      last_loc geography(point,4326),
      last_loc_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `;

    try {
        const result = await client.query(sql);
        console.log('Query result:', result);
    } catch (err) {
        console.error('Query error:', err.message);
    }

    // Check tables
    const r = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
    console.log('Tables:', r.rows.map(t => t.tablename));

    await client.end();
}

test();
