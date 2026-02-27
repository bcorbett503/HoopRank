const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { venues } = require('./scripts/ops/run_data');

const dbPath = path.resolve(__dirname, 'data/hoop_rank.sqlite');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error opening db:', err.message);
        process.exit(1);
    }
});

const laVenues = venues.filter(v =>
    v.key.startsWith('la_') || v.key === 'crosscourtDTLA' || v.key === 'laac' ||
    v.key === 'equinoxLA' || v.key === 'westwoodRec' || v.key === 'vnso' ||
    v.key === 'uclaWooden' || v.key === 'panPacific' || v.key === 'veniceBeach'
);

console.log(`Checking ${laVenues.length} LA venues via Direct SQLite Query...\n`);
let totalFound = 0;

db.all(`SELECT court_id, title, scheduled_at, is_recurring, recurrence_rule FROM scheduled_runs`, [], (err, rows) => {
    if (err) {
        console.error('Error querying scheduled_runs:', err.message);
        db.close();
        process.exit(1);
    }

    for (const v of laVenues) {
        if (!v.courtId) continue;

        const venueRuns = rows.filter(r => r.court_id === v.courtId);
        if (venueRuns.length > 0) {
            console.log(`Court: ${v.name}`);
            console.log(` > Templates found: ${venueRuns.length}`);
            totalFound += venueRuns.length;

            const sample = venueRuns[0];
            console.log(` > Sample: "${sample.title}" | is_recurring: ${sample.is_recurring} | Rule: ${sample.recurrence_rule}`);
        }
    }

    console.log(`\n✅ Total LA Runs Evaluated: ${totalFound}\n`);
    db.close();
});
