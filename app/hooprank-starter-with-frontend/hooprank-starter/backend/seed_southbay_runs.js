#!/usr/bin/env node
/**
 * Seed South Bay (San Jose / Milpitas / Santa Clara / Sunnyvale) Scheduled Runs
 * Creates courts then seeds 4 weeks of recurring runs.
 * Uses setUTCHours so stored times match intended display times.
 *
 * Seeded (5 venues):
 *   1. Milpitas Sports Center — Mon 5:30pm (flagship, $11)
 *   2. Santa Clara CRC — Wed 6:30pm (midweek anchor)
 *   3. Sunnyvale CC — Sun 7am (40+ men, cap 25)
 *   4. Camden CC — Mon-Thu 11am (lunch run, daytime only viable)
 *   5. Bascom CC — Mon-Fri 11am (lunch run candidate)
 *
 * NOT seeded (8 venues — unverified/private/variable):
 *   - Seven Trees CC — satellite/overflow, schedule volatile
 *   - Mayfair CC — satellite/overflow, schedule volatile
 *   - Bay Club Courtside — elite/private, unscheduled organic
 *   - Bay Club Santa Clara — elite/private, unscheduled organic
 *   - City Sports Club (Brokaw) — times not specified
 *   - City Sports Club (Newhall) — times not specified
 *   - City Sports Club (Saratoga) — times not specified
 *   - City Sports Club (E Arques) — times not specified
 */

const BASE = 'https://heartfelt-appreciation-production-65f1.up.railway.app';
const BRETT_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';
const TOKEN = process.env.FIREBASE_TOKEN || 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImY1MzMwMzNhMTMzYWQyM2EyYzlhZGNmYzE4YzRlM2E3MWFmYWY2MjkiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQnJldHQiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jS2pTNFBRNzlzNEx1bDNTMU1mUWlsSnlPaDNzeV9qSHJsTUwyNW5LeWVSQmRhNHFQVXU9czk2LWMiLCJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vaG9vcHJhbmstNTAzIiwiYXVkIjoiaG9vcHJhbmstNTAzIiwiYXV0aF90aW1lIjoxNzcxMzY2OTEzLCJ1c2VyX2lkIjoiNE9EWlVyeVNSVWhGREM1d1ZXNmRDeVNCcHJEMiIsInN1YiI6IjRPRFpVcnlTUlVoRkRDNXdWVzZkQ3lTQnByRDIiLCJpYXQiOjE3NzEzNjY5MTMsImV4cCI6MTc3MTM3MDUxMywiZW1haWwiOiJicmV0dG1jb3JiZXR0QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7Imdvb2dsZS5jb20iOlsiMTA4ODYwNzYwNjAwMjM0NDM1MjYzIl0sImVtYWlsIjpbImJyZXR0bWNvcmJldHRAZ21haWwuY29tIl19LCJzaWduX2luX3Byb3ZpZGVyIjoiZ29vZ2xlLmNvbSJ9fQ.dAViQiBIlubKGTKOuKCBPnOwkriOIwVGXL3cxOxZ9n9QgaPgoSKhjuk0x_2gLNS5of-AbYu7JlvsTSl3YMiKUOq9uwyLf34IuAmJIpVpl6gwwFiXWutUdS3CL7WoZNOtVWLg0IXDMZNFr8XpqmAXAFkjGqR7i-RPeStkG1S8IQN44EIUCJ_j7JpLN0V5abHZNl_SYApOg0LgpR2YSE5V3RoQoaOmX4DsObVYSgOpoSw_7hLgTZJeXglTISBQHAEhDFq5dtJc0XBRv3kWyObOAyZ7s8p7_dEX-UgcWl4kBRZp4FomlhRmpQnU0mYiZI6IXUvwtODn72MXEvxziIKJ0A';
const { randomUUID } = require('crypto');

const DAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// ═══════════════════════════════════════════════════════════════════
//  COURT DEFINITIONS
// ═══════════════════════════════════════════════════════════════════
const VENUE_DEFS = [
    {
        key: 'milpitasSports', name: 'Milpitas Sports Center', city: 'Milpitas, CA',
        lat: 37.4323, lng: -121.8996, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '1325 E Calaveras Blvd, Milpitas, CA 95035'
    },
    {
        key: 'santaClaraCRC', name: 'Santa Clara Community Recreation Center', city: 'Santa Clara, CA',
        lat: 37.3541, lng: -121.9552, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '969 Kiely Blvd, Santa Clara, CA 95051'
    },
    {
        key: 'sunnyvaleCC', name: 'Sunnyvale Community Center', city: 'Sunnyvale, CA',
        lat: 37.3688, lng: -122.0363, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '550 E Remington Dr, Sunnyvale, CA 94087'
    },
    {
        key: 'camdenCC', name: 'Camden Community Center', city: 'San Jose, CA',
        lat: 37.2520, lng: -121.9320, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '3369 Union Ave, San Jose, CA 95124'
    },
    {
        key: 'bascomCC', name: 'Bascom Community Center', city: 'San Jose, CA',
        lat: 37.3110, lng: -121.9316, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '1000 S Bascom Ave, San Jose, CA 95128'
    },
];

// ═══════════════════════════════════════════════════════════════════
//  RUN DEFINITIONS
// ═══════════════════════════════════════════════════════════════════
const RUNS = [
    // Milpitas Sports Center — Mon 5:30-9pm, $11
    {
        venueKey: 'milpitasSports',
        title: 'Monday Open Gym — Milpitas Sports Center',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: 'Flagship "Blue Chip" run. 3 courts (tiered: winner\'s court + overflow). First come first serve. $11 ($8 + $3 processing). Arrive early — culture of punctuality.',
        durationMinutes: 210, maxPlayers: 20,
        schedule: [{ days: [DAY.Mon], hour: 17, minute: 30 }]
    },

    // Santa Clara CRC — Wed 6:30-8:30pm
    {
        venueKey: 'santaClaraCRC',
        title: 'Wednesday Run — Santa Clara CRC',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: 'Midweek anchor. "High School & Adult." Youth Membership Card or Adult Activity Pass required — stable player pool, higher consistency.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Wed], hour: 18, minute: 30 }]
    },

    // Sunnyvale CC — Sun 7-9am, Over 40 Men
    {
        venueKey: 'sunnyvaleCC',
        title: 'Sunday Morning 40+ — Sunnyvale CC',
        gameMode: '5v5', courtType: 'full', ageRange: '40+',
        notes: 'Over 40 men. Meetup-managed + PandaDoc waiver. Cap 25 w/ waitlist. <16 = one 5v5; 16-20 = two games; games to 9 (7 if crowded). Winners on / loser\'s court move over.',
        durationMinutes: 120, maxPlayers: 25,
        schedule: [{ days: [DAY.Sun], hour: 7, minute: 0 }]
    },

    // Camden CC — Mon-Thu, daytime lunch run (teen center blocks 3-6pm)
    {
        venueKey: 'camdenCC',
        title: 'Lunch Run — Camden CC',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: 'Daytime-only adult window. Teen Center blocks gym 3-6pm. Facility closes 8pm. $5.50 adult / $2.75 senior. High variance player pool. Exact hours — verify locally.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu], hour: 11, minute: 0 }]
    },

    // Bascom CC — Mon-Fri, lunch run candidate (teen center blocks 2-6pm)
    {
        venueKey: 'bascomCC',
        title: 'Lunch Run — Bascom CC',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: 'Lunch run candidate. Closes 6pm; Teen Center block 2-6pm. Better floor quality (therapeutic/wheelchair sports hosted). Exact adult hours — verify locally.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 11, minute: 0 }]
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
    console.log('=== Creating South Bay courts ===');
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
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${TOKEN}`,
                                'x-user-id': BRETT_ID,
                            },
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
