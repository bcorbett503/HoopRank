// Script to run full database migration including follow tables
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:YCSWhJfsGHwgErOUfqMDyWDzoKOQbQpy@shuttle.proxy.rlwy.net:48496/railway',
  ssl: false
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Connected to database...');

    // 1. Create PostGIS extension (ignore if fails)
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');
      console.log('Created/verified postgis extension');
    } catch (e) {
      console.log('PostGIS extension not available (continuing anyway)');
    }

    // 2. Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        rating NUMERIC(3,1) DEFAULT 2.5 CHECK (rating BETWEEN 1.0 AND 5.0),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log('Created users table');

    // 3. Create matches table
    await client.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        host_id INTEGER REFERENCES users(id),
        guest_id INTEGER REFERENCES users(id),
        status TEXT CHECK (status IN ('pending','accepted','completed','cancelled')),
        rating_diff_json JSONB,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log('Created matches table');

    // 4. Create elo_history table  
    await client.query(`
      CREATE TABLE IF NOT EXISTS elo_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        match_id INTEGER REFERENCES matches(id),
        elo_before INT NOT NULL,
        elo_after INT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log('Created elo_history table');

    // 5. Create user_followed_courts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_followed_courts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        court_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, court_id)
      );
    `);
    console.log('Created user_followed_courts table');

    // 6. Create user_followed_players table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_followed_players (
        id SERIAL PRIMARY KEY,
        follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        followed_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(follower_id, followed_id)
      );
    `);
    console.log('Created user_followed_players table');

    // 8. Create court_check_ins table for tracking check-ins
    await client.query(`
      CREATE TABLE IF NOT EXISTS court_check_ins (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        court_id VARCHAR(255) NOT NULL,
        checked_in_at TIMESTAMP DEFAULT NOW(),
        checked_out_at TIMESTAMP,
        UNIQUE(user_id, court_id, checked_in_at)
      );
    `);
    console.log('Created court_check_ins table');

    // 9. Create player_statuses table for status posts
    await client.query(`
      CREATE TABLE IF NOT EXISTS player_statuses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Created player_statuses table');

    // Add image_url column if it doesn't exist (for existing tables)
    await client.query(`
      ALTER TABLE player_statuses ADD COLUMN IF NOT EXISTS image_url TEXT;
    `);
    console.log('Ensured image_url column exists');

    // 10. Create status_likes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS status_likes (
        id SERIAL PRIMARY KEY,
        status_id INTEGER NOT NULL REFERENCES player_statuses(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(status_id, user_id)
      );
    `);
    console.log('Created status_likes table');

    // 11. Create status_comments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS status_comments (
        id SERIAL PRIMARY KEY,
        status_id INTEGER NOT NULL REFERENCES player_statuses(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Created status_comments table');

    // 12. Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_followed_courts_user ON user_followed_courts(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_followed_players_follower ON user_followed_players(follower_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_followed_players_followed ON user_followed_players(followed_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_checkins_court ON court_check_ins(court_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_checkins_user ON court_check_ins(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_checkins_time ON court_check_ins(checked_in_at DESC);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_statuses_user ON player_statuses(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_statuses_time ON player_statuses(created_at DESC);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_status_likes_status ON status_likes(status_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_status_comments_status ON status_comments(status_id);');
    console.log('Created indexes');

    // Verify tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('\n✅ All migrations complete! Tables in database:');
    result.rows.forEach(row => console.log('  -', row.table_name));

  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
