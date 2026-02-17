#!/usr/bin/env node
/**
 * Seed Chicago Scheduled Runs
 * 
 * Creates courts (if needed) and seeds 4 weeks of recurring runs.
 * Uses setUTCHours so stored times match intended display times.
 * Chicago = Central Time (UTC-6 / UTC-5 DST)
 */

const BASE = 'https://heartfelt-appreciation-production-65f1.up.railway.app';
const BRETT_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

const { randomUUID } = require('crypto');

const DAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// ── Courts to create ──────────────────────────────────────────────
const VENUE_DEFS = [
    {
        key: 'eastBank',
        name: 'East Bank Club',
        city: 'Chicago, IL',
        lat: 41.8898, lng: -87.6390,
        indoor: true, access: 'private', venue_type: 'gym',
        address: '500 N Kingsbury St, Chicago, IL 60654',
    },
    {
        key: 'rayMeyer',
        name: 'Ray Meyer Fitness & Recreation Center',
        city: 'Chicago, IL',
        lat: 41.9257, lng: -87.6553,
        indoor: true, access: 'private', venue_type: 'university',
        address: '2235 N Sheffield Ave, Chicago, IL 60614',
    },
    {
        key: 'britishSchool',
        name: 'British International School of Chicago',
        city: 'Chicago, IL',
        lat: 41.9076, lng: -87.6635,
        indoor: true, access: 'private', venue_type: 'school',
        address: '814 W Eastman St, Chicago, IL 60642',
    },
    {
        key: 'bennettDay',
        name: 'Bennett Day School',
        city: 'Chicago, IL',
        lat: 41.8912, lng: -87.6531,
        indoor: true, access: 'private', venue_type: 'school',
        address: '955 W Grand Ave, Chicago, IL 60642',
    },
    {
        key: 'pulaskiPark',
        name: 'Pulaski (Casimir) Park',
        city: 'Chicago, IL',
        lat: 41.9105, lng: -87.6667,
        indoor: true, access: 'public', venue_type: 'rec_center',
        address: '1419 W Blackhawk St, Chicago, IL 60642',
    },
    {
        key: 'irvingParkYMCA',
        name: 'Irving Park YMCA',
        city: 'Chicago, IL',
        lat: 41.9536, lng: -87.7234,
        indoor: true, access: 'private', venue_type: 'gym',
        address: '4251 W Irving Park Rd, Chicago, IL 60641',
    },
    {
        key: 'broadwayArmory',
        name: 'Broadway Armory Park',
        city: 'Chicago, IL',
        lat: 41.9726, lng: -87.6596,
        indoor: true, access: 'public', venue_type: 'rec_center',
        address: '5917 N Broadway, Chicago, IL 60660',
    },
    {
        key: 'cfCourtCafe',
        name: 'CF Court Cafe',
        city: 'Chicago, IL',
        lat: 41.8385, lng: -87.6914,
        indoor: true, access: 'private', venue_type: 'gym',
        address: '3044 S Gratten Ave, Chicago, IL 60608',
    },
    {
        key: 'comedRec',
        name: 'ComEd Rec Center',
        city: 'Chicago, IL',
        lat: 41.8932, lng: -87.6476,
        indoor: true, access: 'public', venue_type: 'rec_center',
        address: 'Chicago, IL',
    },
];

// ── Run definitions ────────────────────────────────────────────────
const RUNS = [
    // East Bank Club – Membership, Weekdays 5am-11pm, 2 Full Gyms
    {
        venueKey: 'eastBank',
        title: 'Morning Run — East Bank Club',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Membership facility. 2 full gyms in River North. High reliability.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 7, minute: 0 }],
    },
    {
        venueKey: 'eastBank',
        title: 'Lunch Run — East Bank Club',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Membership facility. Midday games, 2 full gyms.',
        durationMinutes: 90, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Wed, DAY.Fri], hour: 12, minute: 0 }],
    },

    // Ray Meyer Center (DePaul) – Membership, M-F 8am-8pm
    {
        venueKey: 'rayMeyer',
        title: 'Evening Run — Ray Meyer (DePaul)',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'DePaul university facility. Membership required. University-level gym.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu], hour: 18, minute: 0 }],
    },

    // British School (All Ball) – Reserved $15, Sat/Sun 8:00am-9:30am, Select Skill Level
    {
        venueKey: 'britishSchool',
        title: 'Weekend Morning — All Ball @ British School',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'All Ball organized run. $15. Select skill level. Sat & Sun 8-9:30am.',
        durationMinutes: 90, maxPlayers: 14,
        schedule: [{ days: [DAY.Sat, DAY.Sun], hour: 8, minute: 0 }],
    },

    // Bennett Day School (All Ball) – Reserved $13, Thu 8:30pm; Sun 1pm, Co-ed / Select
    {
        venueKey: 'bennettDay',
        title: 'Thursday Night — All Ball @ Bennett Day',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'All Ball organized. $13. Co-ed / Select skill level.',
        durationMinutes: 90, maxPlayers: 14,
        schedule: [{ days: [DAY.Thu], hour: 20, minute: 30 }],
    },
    {
        venueKey: 'bennettDay',
        title: 'Sunday Afternoon — All Ball @ Bennett Day',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'All Ball organized. $13. Co-ed / Select skill level.',
        durationMinutes: 90, maxPlayers: 14,
        schedule: [{ days: [DAY.Sun], hour: 13, minute: 0 }],
    },

    // Pulaski (Casimir) Park – Reserved $12, Mon 6:30pm-8:30pm, Casual Skill
    {
        venueKey: 'pulaskiPark',
        title: 'Monday Night — Pulaski Park',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '$12 reserved. Casual skill level. Mon 6:30-8:30pm.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon], hour: 18, minute: 30 }],
    },

    // Irving Park YMCA – $10 Day Pass, Daily Open Gym, Small & Large Gyms
    {
        venueKey: 'irvingParkYMCA',
        title: 'Open Gym — Irving Park YMCA',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Membership or $10 day pass. Daily open gym. Small & large gyms.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri, DAY.Sat], hour: 11, minute: 0 }],
    },

    // Broadway Armory Park – Drop-in $10, Mon/Wed 12pm-2pm, 18+ Open Run
    {
        venueKey: 'broadwayArmory',
        title: 'Midday Run — Broadway Armory',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: '$10 drop-in. Mon & Wed 12-2pm. 18+ open run. Park District.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Wed], hour: 12, minute: 0 }],
    },

    // CF Court Cafe – Reserved $10, Tue/Wed 7:15pm; Sat 10am, Casual Skill
    {
        venueKey: 'cfCourtCafe',
        title: 'Weeknight Run — CF Court Cafe',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '$10 reserved. Casual skill level. Tue & Wed 7:15pm.',
        durationMinutes: 105, maxPlayers: 14,
        schedule: [{ days: [DAY.Tue, DAY.Wed], hour: 19, minute: 15 }],
    },
    {
        venueKey: 'cfCourtCafe',
        title: 'Saturday Morning — CF Court Cafe',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '$10 reserved. Casual skill level. Sat 10am.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Sat], hour: 10, minute: 0 }],
    },

    // ComEd Rec Center – Drop-in $6, M-F 7am-9am; Mon 8:30pm
    {
        venueKey: 'comedRec',
        title: 'Early Morning — ComEd Rec',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '$6 drop-in. M-F 7-9am. Open gym / open turf.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 7, minute: 0 }],
    },
    {
        venueKey: 'comedRec',
        title: 'Monday Night — ComEd Rec',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '$6 drop-in. Mon 8:30pm. Open gym.',
        durationMinutes: 90, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon], hour: 20, minute: 30 }],
    },

    // British School (Grab A Game) – Reserved, Fri 7:30pm-9:00pm, Weekly Reservation
    {
        venueKey: 'britishSchool',
        title: 'Friday Night — Grab A Game @ British School',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Grab A Game organized. Weekly reservation. Fri 7:30-9pm. Check app for pricing.',
        durationMinutes: 90, maxPlayers: 14,
        schedule: [{ days: [DAY.Fri], hour: 19, minute: 30 }],
    },
];

// ── Helpers ────────────────────────────────────────────────────────
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
                if (candidate > now) {
                    dates.push(candidate);
                }
            }
        }
    }
    return dates;
}

// ── Main ───────────────────────────────────────────────────────────
(async () => {
    // Step 1: Create courts
    const courtIds = {};
    console.log('=== Creating courts ===');
    for (const v of VENUE_DEFS) {
        const id = randomUUID();
        const qs = new URLSearchParams({
            id,
            name: v.name,
            city: v.city,
            lat: String(v.lat),
            lng: String(v.lng),
            indoor: String(v.indoor),
            access: v.access,
            venue_type: v.venue_type,
            address: v.address,
        });
        try {
            const res = await fetch(`${BASE}/courts/admin/create?${qs}`, {
                method: 'POST',
                headers: { 'x-user-id': BRETT_ID },
            });
            const result = await res.json();
            if (result.id) {
                courtIds[v.key] = result.id;
                console.log(`  ✓ ${v.name} → ${result.id}`);
            } else {
                console.error(`  ✗ ${v.name}:`, result);
                courtIds[v.key] = id; // fallback
            }
        } catch (e) {
            console.error(`  ✗ ${v.name}: ${e.message}`);
            courtIds[v.key] = id;
        }
    }

    // Step 2: Seed runs
    console.log('\n=== Seeding runs ===');
    let created = 0;
    let errors = 0;

    for (const run of RUNS) {
        const courtId = courtIds[run.venueKey];
        if (!courtId) {
            console.error(`  ✗ No court ID for ${run.venueKey}, skipping ${run.title}`);
            errors++;
            continue;
        }

        for (const sched of run.schedule) {
            for (const day of sched.days) {
                const dates = getNextOccurrences(day, sched.hour, sched.minute);
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

                    try {
                        const res = await fetch(`${BASE}/runs`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-user-id': BRETT_ID,
                            },
                            body: JSON.stringify(body),
                        });
                        const result = await res.json();
                        if (result.success) {
                            created++;
                        } else {
                            console.error('  ✗', run.title, dt.toISOString(), result);
                            errors++;
                        }
                    } catch (e) {
                        console.error('  ✗ Network error:', run.title, e.message);
                        errors++;
                    }
                }
            }
        }
        console.log(`  ✓ ${run.title}`);
    }

    console.log(`\nDone! Created ${created} runs (${errors} errors).`);
    console.log('Courts created:', Object.keys(courtIds).length);
})();
