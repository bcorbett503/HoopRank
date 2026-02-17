#!/usr/bin/env node
/**
 * Seed Marin County Scheduled Runs
 * Creates courts then seeds 4 weeks of recurring runs.
 * Uses setUTCHours so stored times match intended display times.
 *
 * Seedable venues (4):
 *   1. Strawberry Rec District Gym — Mon 7pm (30+ Veterans), Thu 7pm (18+ Open)
 *   2. Albert J. Boro CC (Pickleweed) — Mon/Wed/Fri evenings (16+, $4)
 *   3. Hill Gymnasium — Mon evenings (18+, seasonal Jun 22–Aug 3 only)
 *
 * NOT seeded:
 *   - Bay Club Marin — members-only, variable pickup times
 *   - Mill Valley CC — unverified
 *   - Marin YMCA — youth schedule only verified
 *   - Terra Linda CC — no evidence of recurring adult run
 *   - Sausalito — "dark zone" for public adult basketball
 */

const BASE = 'https://heartfelt-appreciation-production-65f1.up.railway.app';
const BRETT_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';
const { randomUUID } = require('crypto');

const DAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// ═══════════════════════════════════════════════════════════════════
//  COURT DEFINITIONS
// ═══════════════════════════════════════════════════════════════════
const VENUE_DEFS = [
    {
        key: 'strawberryRec', name: 'Strawberry Recreation District Gym', city: 'Mill Valley, CA',
        lat: 37.8965, lng: -122.5095, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '118 E Strawberry Dr, Mill Valley, CA 94941'
    },
    {
        key: 'boroCC', name: 'Albert J. Boro Community Center', city: 'San Rafael, CA',
        lat: 37.9566, lng: -122.5098, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '50 Canal St, San Rafael, CA 94901'
    },
    {
        key: 'hillGym', name: 'Hill Gymnasium & Recreation Area', city: 'Novato, CA',
        lat: 38.1045, lng: -122.5715, indoor: true, access: 'public', venue_type: 'rec_center',
        address: 'Novato, CA 94947'
    },
];

// ═══════════════════════════════════════════════════════════════════
//  RUN DEFINITIONS
// ═══════════════════════════════════════════════════════════════════
const RUNS = [
    // Strawberry Rec — Monday "Veterans" 7-9pm, 30+ Only
    {
        venueKey: 'strawberryRec',
        title: 'Veterans Run — Strawberry Rec',
        gameMode: '5v5', courtType: 'full', ageRange: '30+',
        notes: '30+ only. Games to 15 or 10-min cap. $10 drop-in or $50 (10-pass). 2026 start: Mar 31. Closed Feb 16-20 (floor repair).',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon], hour: 19, minute: 0 }]
    },

    // Strawberry Rec — Thursday "Open" 7-9pm, 18+
    {
        venueKey: 'strawberryRec',
        title: 'Open Run — Strawberry Rec',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: '18+. Games to 15 or 10-min cap. $10 drop-in or $50 (10-pass). Year-round. Closed Feb 16-20, 2026 (floor repair).',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Thu], hour: 19, minute: 0 }]
    },

    // Boro CC / Pickleweed "Canal" run — Mon/Wed/Fri Evenings, 16+
    {
        venueKey: 'boroCC',
        title: 'Evening Drop-In — Boro CC (Pickleweed)',
        gameMode: '5v5', courtType: 'full', ageRange: '16+',
        notes: '16+ drop-in. $4/session. High-volume, mixed skill. Start time may vary — verify locally.',
        durationMinutes: 120, maxPlayers: 16,
        schedule: [{ days: [DAY.Mon, DAY.Wed, DAY.Fri], hour: 18, minute: 30 }]
    },

    // Hill Gymnasium — Monday Evenings, 18+, SEASONAL (Jun 22 – Aug 3, 2026)
    {
        venueKey: 'hillGym',
        title: 'Summer Open Gym — Hill Gymnasium',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: '18+. Seasonal: Jun 22–Aug 3, 2026 only. ~$64 season pass. Exact start time unverified — verify locally.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon], hour: 18, minute: 0 }]
    },
];

// ═══════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════
function getNextOccurrences(dayOfWeek, hour, minute, weeks = 4) {
    const dates = [];
    const now = new Date();
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    for (let w = 0; w < weeks; w++) {
        for (let d = 0; d < 7; d++) {
            const candidate = new Date(start);
            candidate.setUTCDate(start.getUTCDate() + w * 7 + d);
            if (candidate.getUTCDay() === dayOfWeek) {
                candidate.setUTCHours(hour, minute, 0, 0);
                if (candidate > now) dates.push(candidate);
            }
        }
    }
    return dates;
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════
(async () => {
    const courtIds = {};
    console.log('=== Creating Marin County courts ===');
    for (const v of VENUE_DEFS) {
        const id = randomUUID();
        const qs = new URLSearchParams({
            id, name: v.name, city: v.city,
            lat: String(v.lat), lng: String(v.lng),
            indoor: String(v.indoor), access: v.access,
            venue_type: v.venue_type, address: v.address,
        });
        try {
            const res = await fetch(`${BASE}/courts/admin/create?${qs}`, {
                method: 'POST', headers: { 'x-user-id': BRETT_ID },
            });
            const result = await res.json();
            courtIds[v.key] = result.court?.id || result.id || id;
            console.log(`  ✓ ${v.name} → ${courtIds[v.key]}`);
        } catch (e) {
            console.error(`  ✗ ${v.name}: ${e.message}`);
            courtIds[v.key] = id;
        }
    }

    console.log('\n=== Seeding runs ===');
    let created = 0, errors = 0;

    for (const run of RUNS) {
        const courtId = courtIds[run.venueKey];
        if (!courtId) { console.error(`  ✗ No ID for ${run.venueKey}`); errors++; continue; }

        for (const sched of run.schedule) {
            for (const day of sched.days) {
                const dates = getNextOccurrences(day, sched.hour, sched.minute);
                for (const dt of dates) {
                    const body = {
                        courtId, scheduledAt: dt.toISOString(),
                        title: run.title, gameMode: run.gameMode,
                        courtType: run.courtType, ageRange: run.ageRange,
                        notes: run.notes, durationMinutes: run.durationMinutes,
                        maxPlayers: run.maxPlayers,
                    };
                    try {
                        const res = await fetch(`${BASE}/runs`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'x-user-id': BRETT_ID },
                            body: JSON.stringify(body),
                        });
                        const result = await res.json();
                        if (result.success) created++;
                        else { console.error('  ✗', run.title, dt.toISOString(), result); errors++; }
                    } catch (e) { console.error('  ✗', run.title, e.message); errors++; }
                }
            }
        }
        console.log(`  ✓ ${run.title}`);
    }

    console.log(`\nDone! Created ${created} runs (${errors} errors).`);
    console.log(`Courts created: ${Object.keys(courtIds).length}`);
})();
