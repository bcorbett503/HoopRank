import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();

  // John Apple's user ID
  const johnId = 'DKmjcFcw8eU3litE3YO9UTtcjOg2';
  console.log(`Testing query for John Apple: ${johnId}`);

  // Check all challenge_pending matches
  console.log('\n=== All Pending Challenges ===');
  const all = await client.query(`
    SELECT m.id, m.match_type, m.status, m.created_at,
           m.creator_team_id, m.opponent_team_id
    FROM matches m
    WHERE m.status = 'challenge_pending'
    ORDER BY m.created_at DESC
    LIMIT 10
  `);
  console.log(`Total pending challenges: ${all.rows.length}`);

  // Run the exact query from the API for John
  console.log('\n=== Challenges for John (API Query) ===');
  const result = await client.query(`
    SELECT m.id, m.match_type, m.status, m.created_at,
           t1.id as challenger_team_id, t1.name as challenger_team_name, t1.owner_id as challenger_owner_id,
           t2.id as opponent_team_id, t2.name as opponent_team_name, t2.owner_id as opponent_owner_id,
           u.name as challenger_name
    FROM matches m
    JOIN teams t1 ON t1.id = m.creator_team_id
    JOIN teams t2 ON t2.id = m.opponent_team_id
    JOIN users u ON u.id = m.creator_id
    WHERE m.status = 'challenge_pending'
      AND (t1.owner_id = $1 OR t2.owner_id = $1)
    ORDER BY m.created_at DESC
  `, [johnId]);

  console.log(`Found ${result.rows.length} challenges for John`);
  if (result.rows.length > 0) {
    console.log(JSON.stringify(result.rows, null, 2));
  }

  await client.end();
}

run();
