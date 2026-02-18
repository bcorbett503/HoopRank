#!/usr/bin/env node
/**
 * Seed Las Vegas / Henderson Scheduled Runs
 * Creates courts then seeds 4 weeks of recurring runs.
 * Uses setUTCHours so stored times match intended display times.
 *
 * ═══════════════════════════════════════════════════════════════════
 * SEEDED (15 venues — schedule-explicit or reliable defaults):
 *   Indoor: Paradise Rec, Valley View Rec, Desert Breeze CC, Moapa Valley Rec,
 *           Doolittle CC, Stupak CC, Chuck Minker, PickUp USA Fitness,
 *           Life Time Green Valley, Heinrich YMCA, Centennial Hills YMCA,
 *           SkyView YMCA
 *   Outdoor: Sunset Park, Craig Ranch, Gardens Park
 *
 * NOT SEEDED (14 venues — calendar-dependent / call-first / closed):
 *   - Mountain Crest (shootarounds only)
 *   - Mirabelli CC (court rentals displace drop-in)
 *   - Veterans Memorial CC (heavy youth league usage)
 *   - Henderson Multigenerational (check monthly calendar)
 *   - Black Mountain Rec (check monthly calendar)
 *   - Whitney Ranch Rec (closed for maintenance Feb 11, 2026)
 *   - Silver Springs Rec (check monthly calendar)
 *   - Tarkanian Academy (mostly rentals, ~$75/hr)
 *   - Life Time Summerlin (leagues dominate evenings)
 *   - LVAC (24hr, 10pm-2am — too variable)
 *   - EoS Fitness Blue Diamond (varies)
 *   - Durango Hills YMCA (youth restricts full-court)
 *   - Desert Breeze Park outdoor (overflow)
 *   - Lorenzi Park outdoor (seasonal, no lights)
 * ═══════════════════════════════════════════════════════════════════
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
    // ── Indoor: Municipal / Rec Centers ──
    {
        key: 'paradiseRec', name: 'Paradise Recreation Center', city: 'Las Vegas, NV',
        lat: 36.1000, lng: -115.1200, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '4770 S Harrison Dr, Las Vegas, NV 89120'
    },
    {
        key: 'valleyView', name: 'Valley View Recreation Center', city: 'Henderson, NV',
        lat: 36.0400, lng: -115.0600, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '500 Harris St, Henderson, NV 89015'
    },
    {
        key: 'desertBreezeCC', name: 'Desert Breeze Community Center', city: 'Las Vegas, NV',
        lat: 36.1100, lng: -115.2400, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '8275 Spring Mountain Rd, Las Vegas, NV 89147'
    },
    {
        key: 'moapaValley', name: 'Moapa Valley Recreation Center', city: 'Overton, NV',
        lat: 36.5400, lng: -114.4400, indoor: true, access: 'public', venue_type: 'rec_center',
        address: 'Overton, NV 89040'
    },
    {
        key: 'doolittle', name: 'Doolittle Community Center', city: 'Las Vegas, NV',
        lat: 36.1820, lng: -115.1620, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '1950 J St, Las Vegas, NV 89106'
    },
    {
        key: 'stupak', name: 'Stupak Community Center', city: 'Las Vegas, NV',
        lat: 36.1610, lng: -115.1560, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '251 W Boston Ave, Las Vegas, NV 89102'
    },
    {
        key: 'chuckMinker', name: 'Chuck Minker Sports Complex', city: 'Las Vegas, NV',
        lat: 36.1710, lng: -115.1380, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '275 N Mojave Rd, Las Vegas, NV 89101'
    },

    // ── Indoor: Private / Membership ──
    {
        key: 'pickupUSA', name: 'PickUp USA Fitness', city: 'Las Vegas, NV',
        lat: 36.1150, lng: -115.1730, indoor: true, access: 'private', venue_type: 'gym',
        address: 'Las Vegas, NV 89119'
    },
    {
        key: 'lifeTimeGV', name: 'Life Time - Green Valley', city: 'Henderson, NV',
        lat: 36.0600, lng: -115.0800, indoor: true, access: 'private', venue_type: 'gym',
        address: 'Henderson, NV 89014'
    },

    // ── Indoor: YMCA ──
    {
        key: 'heinrichY', name: 'Bill & Lillie Heinrich YMCA', city: 'Las Vegas, NV',
        lat: 36.1950, lng: -115.2350, indoor: true, access: 'private', venue_type: 'gym',
        address: 'Las Vegas, NV 89146'
    },
    {
        key: 'centennialY', name: 'Centennial Hills YMCA', city: 'Las Vegas, NV',
        lat: 36.2700, lng: -115.2600, indoor: true, access: 'private', venue_type: 'gym',
        address: 'Las Vegas, NV 89149'
    },
    {
        key: 'skyviewY', name: 'SkyView YMCA', city: 'Las Vegas, NV',
        lat: 36.2300, lng: -115.2800, indoor: true, access: 'private', venue_type: 'gym',
        address: 'Las Vegas, NV 89138'
    },

    // ── Outdoor ──
    {
        key: 'sunsetPark', name: 'Sunset Park Basketball Courts', city: 'Las Vegas, NV',
        lat: 36.0780, lng: -115.1190, indoor: false, access: 'public', venue_type: 'outdoor',
        address: '2601 E Sunset Rd, Las Vegas, NV 89120'
    },
    {
        key: 'craigRanch', name: 'Craig Ranch Regional Park', city: 'North Las Vegas, NV',
        lat: 36.2450, lng: -115.1280, indoor: false, access: 'public', venue_type: 'outdoor',
        address: '628 W Craig Rd, North Las Vegas, NV 89032'
    },
    {
        key: 'gardensPark', name: 'Gardens Park', city: 'Las Vegas, NV',
        lat: 36.0350, lng: -115.2000, indoor: false, access: 'public', venue_type: 'outdoor',
        address: 'Las Vegas, NV 89123'
    },
];

// ═══════════════════════════════════════════════════════════════════
//  RUN DEFINITIONS
// ═══════════════════════════════════════════════════════════════════
const RUNS = [
    // Paradise Rec — Tue/Thu 8am-11:30am, 18+, $2
    {
        venueKey: 'paradiseRec',
        title: 'Morning Open Gym — Paradise Rec',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: '"Service industry" morning run. 18+. $2 day pass. Reliable non-traditional slot. Tue & Thu 8am-11:30am.',
        durationMinutes: 210, maxPlayers: 14,
        schedule: [{ days: [DAY.Tue, DAY.Thu], hour: 8, minute: 0 }]
    },

    // Valley View Rec — Mon 8-10pm, 18+, cap 20
    {
        venueKey: 'valleyView',
        title: 'Monday Night — Valley View Rec',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: "Men's Basketball Open Gym. 18+. Cap 20 (arrive ~7:30). Requires Henderson Participant ID.",
        durationMinutes: 120, maxPlayers: 20,
        schedule: [{ days: [DAY.Mon], hour: 20, minute: 0 }]
    },

    // Desert Breeze CC — Sat morning
    {
        venueKey: 'desertBreezeCC',
        title: 'Saturday Morning — Desert Breeze CC',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: '$2 drop-in. Key summer indoor option (weekday suspended May 27–Aug 18). Saturday remains open year-round.',
        durationMinutes: 150, maxPlayers: 14,
        schedule: [{ days: [DAY.Sat], hour: 9, minute: 0 }]
    },

    // Moapa Valley Rec — Tue/Thu 5-7pm
    {
        venueKey: 'moapaValley',
        title: 'Evening Run — Moapa Valley Rec',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Reliable evening slot. Rural/remote location. Free or $2 depending on program. Tue & Thu 5-7pm.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Tue, DAY.Thu], hour: 17, minute: 0 }]
    },

    // Doolittle CC — Mon-Sat, two gyms, $3/day
    {
        venueKey: 'doolittle',
        title: 'Midday Run — Doolittle CC',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: 'Two indoor gyms → better odds of court time. $3/day or $5/month. Mon-Sat 8am-8pm (Sat 8am-5:30pm).',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 12, minute: 0 }]
    },
    {
        venueKey: 'doolittle',
        title: 'Saturday Open Gym — Doolittle CC',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: 'Two indoor gyms. $3/day or $5/month. Saturday hours 8am-5:30pm.',
        durationMinutes: 150, maxPlayers: 14,
        schedule: [{ days: [DAY.Sat], hour: 10, minute: 0 }]
    },

    // Stupak CC — best non-Mon/non-volleyball windows, $2/day
    {
        venueKey: 'stupak',
        title: 'Afternoon Run — Stupak CC',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '$2/day; $5 monthly pass. Avoid Mon 6-8:30pm (volleyball). Call first for availability.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 14, minute: 0 }]
    },

    // Chuck Minker — mid-afternoon before leagues
    {
        venueKey: 'chuckMinker',
        title: 'Afternoon Pickup — Chuck Minker',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: 'Regulation court with seating. Best pickup mid-afternoon before evening leagues. Mon-Thu 8am-9pm / Fri-Sat 8am-5:30pm.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu], hour: 15, minute: 0 }]
    },

    // PickUp USA Fitness — evenings 7-10pm
    {
        venueKey: 'pickupUSA',
        title: 'Officiated Pickup — PickUp USA',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: 'Officiated pickup (refs + structured queue/rotations). High consistency, fewer disputes. Membership model.',
        durationMinutes: 180, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 19, minute: 0 }]
    },

    // Life Time Green Valley — daily 7am & 9am
    {
        venueKey: 'lifeTimeGV',
        title: 'Early Morning Pickup — Life Time GV',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: 'Membership-gated. Designated adult pickup at 7am. Corporate/structured vibe.',
        durationMinutes: 90, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri, DAY.Sat], hour: 7, minute: 0 }]
    },
    {
        venueKey: 'lifeTimeGV',
        title: '9 AM Pickup — Life Time GV',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: 'Membership-gated. Designated adult pickup at 9am.',
        durationMinutes: 90, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri, DAY.Sat], hour: 9, minute: 0 }]
    },

    // Heinrich YMCA — Mon-Sat (best weekday evening slot)
    {
        venueKey: 'heinrichY',
        title: 'Evening Run — Heinrich YMCA',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Indoor court staple. YMCA membership. Mon-Thu 6am-8pm / Fri 6am-7pm / Sat 7am-4pm. Sun closed.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu], hour: 17, minute: 0 }]
    },

    // Centennial Hills YMCA — Sunday window (rare!)
    {
        venueKey: 'centennialY',
        title: 'Sunday Morning — Centennial Hills YMCA',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Key Sunday indoor window (rare vs. many municipal closures). YMCA membership or day pass. Sun 9am-1pm.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Sun], hour: 9, minute: 0 }]
    },
    {
        venueKey: 'centennialY',
        title: 'Evening Run — Centennial Hills YMCA',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'YMCA membership or day pass. Mon-Thu 5am-8pm. Broad access hours.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Wed, DAY.Fri], hour: 17, minute: 0 }]
    },

    // SkyView YMCA — weekday evening
    {
        venueKey: 'skyviewY',
        title: 'Evening Run — SkyView YMCA',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Hybrid: indoor gym + outdoor court. YMCA membership. Mon-Thu 6am-8pm. Sun closed.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Tue, DAY.Thu], hour: 17, minute: 0 }]
    },

    // ── Outdoor ──
    // Sunset Park — outdoor crown jewel, lights
    {
        venueKey: 'sunsetPark',
        title: 'Evening Run — Sunset Park',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Outdoor "crown jewel" with lights + high critical mass. Summer: vampire hours only. Winter: all-day viability. Free.',
        durationMinutes: 180, maxPlayers: 20,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 18, minute: 0 }]
    },
    {
        venueKey: 'sunsetPark',
        title: 'Weekend Run — Sunset Park',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Outdoor crown jewel. Weekend all-day action in cooler months; summer evenings only. Free.',
        durationMinutes: 240, maxPlayers: 20,
        schedule: [{ days: [DAY.Sat, DAY.Sun], hour: 10, minute: 0 }]
    },

    // Craig Ranch — best weekends
    {
        venueKey: 'craigRanch',
        title: 'Weekend Morning — Craig Ranch Park',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'North Valley "mecca." Easy to get random games when weather cooperates. Summer: pre-10am; winter: all day. Free.',
        durationMinutes: 180, maxPlayers: 20,
        schedule: [{ days: [DAY.Sat, DAY.Sun], hour: 9, minute: 0 }]
    },

    // Gardens Park — Sat ~8:30am "secret" run
    {
        venueKey: 'gardensPark',
        title: 'Saturday Morning — Gardens Park',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Secret" consistent outdoor run. Best in cooler months / early summer mornings. Sat ~8:30am. Free.',
        durationMinutes: 150, maxPlayers: 14,
        schedule: [{ days: [DAY.Sat], hour: 8, minute: 30 }]
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
    console.log(`=== Creating ${VENUE_DEFS.length} Las Vegas courts ===`);
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
                method: 'POST',
                headers: { 'x-user-id': BRETT_ID, 'Authorization': `Bearer ${TOKEN}` },
            });
            const result = await res.json();
            courtIds[v.key] = result.court?.id || result.id || id;
            console.log(`  ✓ ${v.name} → ${courtIds[v.key]}`);
        } catch (e) {
            console.error(`  ✗ ${v.name}: ${e.message}`);
            courtIds[v.key] = id;
        }
    }

    console.log(`\n=== Seeding ${RUNS.length} run types ===`);
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
