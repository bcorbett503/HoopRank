#!/usr/bin/env node
/**
 * ops/seed_runs.js — Unified run seeder
 *
 * Usage:
 *   TOKEN=xxx node scripts/ops/seed_runs.js                          # Seed ALL runs
 *   TOKEN=xxx node scripts/ops/seed_runs.js --market sf              # Seed only SF runs
 *   TOKEN=xxx node scripts/ops/seed_runs.js --market chicago --dry   # Dry-run Chicago
 *   TOKEN=xxx node scripts/ops/seed_runs.js --weeks 8                # Seed 8 weeks ahead
 *
 * Reads venue/run data from run_data.js, creates courts if needed,
 * and seeds scheduled run occurrences.
 */

const { createCourt, seedRun, getNextOccurrences, sleep, getTokenInteractive, BRETT_ID } = require('./lib');
const { venues, runs } = require('./run_data');

// ── CLI parsing ──────────────────────────────────────────────────
const args = process.argv.slice(2);
let TOKEN = process.env.TOKEN;
const DRY = args.includes('--dry');
const WEEKS = (() => {
    const i = args.indexOf('--weeks');
    return i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : 4;
})();
const MARKET = (() => {
    const i = args.indexOf('--market');
    return i >= 0 && args[i + 1] ? args[i + 1].toLowerCase() : null;
})();



// ── Market filter (city name substring matching) ─────────────────
const MARKET_MAP = {
    sf: ['San Francisco'],
    oakland: ['Oakland', 'Alameda'],
    marin: ['Mill Valley', 'San Rafael', 'Novato'],
    chicago: ['Chicago'],
    seattle: ['Seattle'],
    portland: ['Portland', 'Gresham'],
    la: ['Los Angeles', 'Burbank'],
    nyc: ['New York', 'Brooklyn', 'Queens'],
    texas: ['Austin', 'Houston', 'Dallas'],
    virginia: ['Arlington', 'Fairfax', 'Springfield', 'Richmond', 'Henrico', 'Midlothian', 'Virginia Beach'],
    iconic: ['Washington', 'Philadelphia', 'Shelby', 'Beachwood', 'Las Vegas', 'Miami', 'Coral Gables', 'Atlanta'],
    merritt: ['Merritt Island', 'Cocoa', 'Melbourne'],
    boston: ['Boston', 'Cambridge', 'Brighton'],
    peninsula: ['San Mateo', 'Redwood City', 'San Carlos', 'Menlo Park', 'Palo Alto', 'South San Francisco', 'San Bruno', 'Foster City', 'Mountain View'],
};

function matchesMarket(venue) {
    if (!MARKET) return true;
    const cities = MARKET_MAP[MARKET];
    if (!cities) {
        console.error(`Unknown market: ${MARKET}. Available: ${Object.keys(MARKET_MAP).join(', ')}`);
        process.exit(1);
    }
    return cities.some((c) => venue.city.includes(c));
}

// ── Main ─────────────────────────────────────────────────────────
(async () => {
    if (!DRY && !TOKEN && !process.env.NO_INTERACTIVE) {
        TOKEN = await getTokenInteractive();
    }
    // Build venue index & filter
    const venueMap = {};
    venues.forEach((v) => { venueMap[v.key] = v; });

    const filteredRuns = runs.filter((r) => {
        const v = venueMap[r.venueKey];
        return v && matchesMarket(v);
    });

    if (filteredRuns.length === 0) {
        console.log('No runs match the filter. Check --market value.');
        return;
    }

    console.log(`\n═══════════════════════════════════════`);
    console.log(`  HoopRank Run Seeder ${DRY ? '(DRY RUN)' : ''}`);
    console.log(`  Market: ${MARKET || 'ALL'} | Weeks: ${WEEKS}`);
    console.log(`  Run definitions: ${filteredRuns.length}`);
    console.log(`═══════════════════════════════════════\n`);

    // Step 1: Create courts that need creating
    const courtIds = {};
    const venuesToCreate = [];
    const seen = new Set();

    for (const r of filteredRuns) {
        const v = venueMap[r.venueKey];
        if (!v || seen.has(v.key)) continue;
        seen.add(v.key);

        if (v.courtId) {
            courtIds[v.key] = v.courtId;
        } else if (v.create) {
            venuesToCreate.push(v);
        }
    }

    if (venuesToCreate.length > 0) {
        console.log(`=== Creating ${venuesToCreate.length} courts ===`);
        for (const v of venuesToCreate) {
            if (DRY) {
                console.log(`  [DRY] Would create: ${v.name}`);
                courtIds[v.key] = `dry-${v.key}`;
                continue;
            }
            await sleep(200);
            try {
                const { id, result } = await createCourt(v, TOKEN);
                courtIds[v.key] = id;
                console.log(`  ✓ ${v.name} → ${id}`);
            } catch (e) {
                console.error(`  ✗ ${v.name}: ${e.message}`);
            }
        }
    }

    // Step 2: Seed runs
    console.log(`\n=== Seeding ${filteredRuns.length} run types (${WEEKS} weeks) ===`);
    let created = 0, errors = 0, skipped = 0;

    for (const run of filteredRuns) {
        const courtId = courtIds[run.venueKey];
        if (!courtId) {
            console.error(`  ✗ No court ID for ${run.venueKey}, skipping ${run.title}`);
            skipped++;
            continue;
        }

        let runOk = 0;
        for (const sched of run.schedule) {
            for (const day of sched.days) {
                const dates = getNextOccurrences(day, sched.hour, sched.minute, WEEKS);
                for (const dt of dates) {
                    const body = {
                        courtId,
                        scheduledAt: dt.toISOString(),
                        title: run.title,
                        gameMode: run.gameMode,
                        courtType: run.courtType,
                        ageRange: run.ageRange,
                        notes: run.notes,
                        durationMinutes: run.durationMinutes,
                        maxPlayers: run.maxPlayers,
                    };

                    if (DRY) {
                        runOk++;
                        created++;
                        continue;
                    }

                    await sleep(600);
                    try {
                        const result = await seedRun(body, TOKEN);
                        if (result.success) {
                            created++;
                            runOk++;
                        } else {
                            console.error(`  ✗ ${run.title} ${dt.toISOString()}`, result);
                            errors++;
                        }
                    } catch (e) {
                        console.error(`  ✗ ${run.title}: ${e.message}`);
                        errors++;
                    }
                }
            }
        }
        console.log(`  ✓ ${run.title} (${runOk} instances)`);
    }

    console.log(`\n═══ Results ═══`);
    console.log(`  Created: ${created} run instances`);
    console.log(`  Errors:  ${errors}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Courts:  ${Object.keys(courtIds).length}`);
})();
