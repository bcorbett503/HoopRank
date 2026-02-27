const { Client } = require('pg');

async function runSpawner() {
  const client = new Client({
    connectionString: 'postgresql://postgres:wXz9rB5vQ8p2L6nK4m7J1gH3sD0fA2e9@roundhouse.proxy.rlwy.net:45952/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  try {
      await client.connect();
      
      const res = await client.query(`
          SELECT 
              id, court_id, created_by, title, game_mode, court_type, 
              age_range, duration_minutes, max_players, notes, 
              tagged_player_ids, tag_mode, recurrence_rule, scheduled_at 
          FROM scheduled_runs 
          WHERE is_recurring = true AND recurrence_rule = 'weekly'
      `);
      const templates = res.rows;
      console.log(`Found ${templates.length} templates.`);
      
      const now = new Date();
      const windowEnd = new Date(now.getTime() + (192 * 60 * 60 * 1000));
      let spawnedCount = 0;

      for (const template of templates) {
          try {
              const originalDate = new Date(template.scheduled_at);
              const targetDayOfWeek = originalDate.getUTCDay();
              const targetHours = originalDate.getUTCHours();
              const targetMinutes = originalDate.getUTCMinutes();

              const upcomingInstance = new Date();
              upcomingInstance.setUTCHours(targetHours, targetMinutes, 0, 0);

              const currentDay = upcomingInstance.getUTCDay();
              const distance = (targetDayOfWeek + 7 - currentDay) % 7;
              upcomingInstance.setUTCDate(upcomingInstance.getUTCDate() + distance);

              if (upcomingInstance > now && upcomingInstance <= windowEnd) {
                  const checkRes = await client.query(`SELECT id FROM scheduled_runs WHERE court_id = $1 AND title = $2 AND scheduled_at = $3 AND is_recurring = false`, [template.court_id, template.title, upcomingInstance]);
                  if (checkRes.rows.length === 0) {
                      await client.query(`
                          INSERT INTO scheduled_runs (
                              court_id, created_by, title, game_mode, court_type, 
                              age_range, duration_minutes, max_players, notes, 
                              tagged_player_ids, tag_mode, scheduled_at, is_recurring, created_at
                          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false, NOW())
                      `, [template.court_id, template.created_by, template.title, template.game_mode, template.court_type, template.age_range, template.duration_minutes, template.max_players, template.notes, template.tagged_player_ids, template.tag_mode, upcomingInstance]);
                      spawnedCount++;
                  }
              }
          } catch(innerErr) {
             console.error("Inner Loop Err:", innerErr.message);
          }
      }
      
      console.log(`CRON Sim Expanded Window: Successfully spawned ${spawnedCount} true UTC instances.`);
  } catch(e) {
      console.error("Fatal Error:", e);
  } finally {
      await client.end();
  }
}
runSpawner();
