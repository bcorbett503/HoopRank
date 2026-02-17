#!/usr/bin/env node
/**
 * Seed Virginia Scheduled Runs — NOVA, Richmond, Virginia Beach
 * Creates courts then seeds 4 weeks of recurring runs.
 * Uses setUTCHours so stored times match intended display times.
 */

const BASE = 'https://heartfelt-appreciation-production-65f1.up.railway.app';
const BRETT_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';
const { randomUUID } = require('crypto');

const DAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// ═══════════════════════════════════════════════════════════════════
//  COURT DEFINITIONS
// ═══════════════════════════════════════════════════════════════════
const VENUE_DEFS = [
    // ── NOVA ─────────────────────────────────────────────────────
    {
        key: 'tjCC', name: 'Thomas Jefferson Community Center', city: 'Arlington, VA',
        lat: 38.8830, lng: -77.0947, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '3501 2nd St S, Arlington, VA 22204'
    },
    {
        key: 'lubberRun', name: 'Lubber Run Community Center', city: 'Arlington, VA',
        lat: 38.8726, lng: -77.1142, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '300 N Park Dr, Arlington, VA 22203'
    },
    {
        key: 'charlesDrew', name: 'Charles Drew Community Center', city: 'Arlington, VA',
        lat: 38.8610, lng: -77.0690, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '3500 23rd St S, Arlington, VA 22206'
    },
    {
        key: 'langstonBrown', name: 'Langston-Brown Community Center', city: 'Arlington, VA',
        lat: 38.8855, lng: -77.0828, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '2121 N Culpeper St, Arlington, VA 22207'
    },
    {
        key: 'walterReed', name: 'Walter Reed Community Center', city: 'Arlington, VA',
        lat: 38.8576, lng: -77.1014, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '2909 16th St S, Arlington, VA 22204'
    },
    {
        key: 'gmuActivities', name: 'George Mason University Activities Building', city: 'Fairfax, VA',
        lat: 38.8316, lng: -77.3087, indoor: true, access: 'private', venue_type: 'university',
        address: '4400 University Dr, Fairfax, VA 22030'
    },
    {
        key: 'stJames', name: 'The St. James', city: 'Springfield, VA',
        lat: 38.7758, lng: -77.1713, indoor: true, access: 'private', venue_type: 'gym',
        address: '6805 Industrial Rd, Springfield, VA 22151'
    },

    // ── Richmond ─────────────────────────────────────────────────
    {
        key: 'bellemeade', name: 'Bellemeade Community Center', city: 'Richmond, VA',
        lat: 37.4980, lng: -77.4555, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '1800 Lynhaven Ave, Richmond, VA 23224'
    },
    {
        key: 'easternHenrico', name: 'Eastern Henrico Recreation Center', city: 'Henrico, VA',
        lat: 37.5500, lng: -77.3600, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '1440 N Laburnum Ave, Richmond, VA 23223'
    },
    {
        key: 'deepRun', name: 'Deep Run Recreation Center', city: 'Henrico, VA',
        lat: 37.6300, lng: -77.5800, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '9910 Ridgefield Pkwy, Henrico, VA 23233'
    },
    {
        key: 'powhatanHill', name: 'Powhatan Hill Community Center', city: 'Richmond, VA',
        lat: 37.5190, lng: -77.4020, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '5765 Louisa Ave, Richmond, VA 23231'
    },
    {
        key: 'tbSmith', name: 'T.B. Smith Community Center', city: 'Richmond, VA',
        lat: 37.4930, lng: -77.4480, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '2019 Ruffin Rd, Richmond, VA 23234'
    },
    {
        key: 'vcuCarySt', name: 'VCU Cary Street Gym', city: 'Richmond, VA',
        lat: 37.5407, lng: -77.4500, indoor: true, access: 'private', venue_type: 'university',
        address: '911 W Cary St, Richmond, VA 23284'
    },
    {
        key: 'swiftCreekY', name: 'Swift Creek YMCA', city: 'Midlothian, VA',
        lat: 37.4800, lng: -77.5700, indoor: true, access: 'private', venue_type: 'gym',
        address: 'Midlothian, VA'
    },

    // ── Virginia Beach ───────────────────────────────────────────
    {
        key: 'kempsvilleRec', name: 'Kempsville Recreation Center', city: 'Virginia Beach, VA',
        lat: 36.8200, lng: -76.1180, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '800 Monmouth Ln, Virginia Beach, VA 23464'
    },
    {
        key: 'princessAnne', name: 'Princess Anne Recreation Center', city: 'Virginia Beach, VA',
        lat: 36.7800, lng: -76.0350, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '1400 Nimmo Pkwy, Virginia Beach, VA 23456'
    },
    {
        key: 'williamsFarm', name: 'Williams Farm Recreation Center', city: 'Virginia Beach, VA',
        lat: 36.8150, lng: -76.0780, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '5252 Learning Ln, Virginia Beach, VA 23462'
    },
    {
        key: 'bowCreek', name: 'Bow Creek Recreation Center', city: 'Virginia Beach, VA',
        lat: 36.8300, lng: -76.1000, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '3427 Club House Rd, Virginia Beach, VA 23452'
    },
    {
        key: 'vbFieldHouse', name: 'Virginia Beach Field House', city: 'Virginia Beach, VA',
        lat: 36.7960, lng: -76.0920, indoor: true, access: 'public', venue_type: 'rec_center',
        address: '2020 Landstown Rd, Virginia Beach, VA 23456'
    },
];

// ═══════════════════════════════════════════════════════════════════
//  RUN DEFINITIONS
// ═══════════════════════════════════════════════════════════════════
const RUNS = [
    // ── NOVA ─────────────────────────────────────────────────────
    // Thomas Jefferson CC — Tue/Thu 6:30p Adults Only, 3 Courts
    {
        venueKey: 'tjCC',
        title: 'Competitive Run — Thomas Jefferson CC',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: 'Adults Only. 3 courts. The premier competitive run in NOVA. Membership or daily fee.',
        durationMinutes: 135, maxPlayers: 20,
        schedule: [{ days: [DAY.Tue, DAY.Thu], hour: 18, minute: 30 }]
    },
    // Thomas Jefferson CC — Mon/W/F 4:30p General Drop-in, 2 Courts
    {
        venueKey: 'tjCC',
        title: 'Drop-in Run — Thomas Jefferson CC',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'General drop-in. 2 courts. Mixed competition. Membership or daily fee.',
        durationMinutes: 255, maxPlayers: 20,
        schedule: [{ days: [DAY.Mon, DAY.Wed, DAY.Fri], hour: 16, minute: 30 }]
    },
    // Lubber Run CC — Mon-Fri 12p-2p
    {
        venueKey: 'lubberRun',
        title: 'Lunch Run — Lubber Run CC',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: 'Adult full court. High-efficiency lunch run. Membership or daily fee.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 12, minute: 0 }]
    },
    // Charles Drew CC — Tue/Thu 6p-9p
    {
        venueKey: 'charlesDrew',
        title: 'Evening Run — Charles Drew CC',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: 'Adults Only. Neighborhood alternative to TJ. Membership or daily fee.',
        durationMinutes: 180, maxPlayers: 14,
        schedule: [{ days: [DAY.Tue, DAY.Thu], hour: 18, minute: 0 }]
    },
    // Langston-Brown CC — Mon 6p-8:45p
    {
        venueKey: 'langstonBrown',
        title: 'Monday Night — Langston-Brown CC',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: 'Adult drop-in. Best option for Monday nights in Arlington.',
        durationMinutes: 165, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon], hour: 18, minute: 0 }]
    },
    // Walter Reed CC — Fri 6p-9p
    {
        venueKey: 'walterReed',
        title: 'Friday Night — Walter Reed CC',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: 'Adult drop-in. End-of-week run. Membership or daily fee.',
        durationMinutes: 180, maxPlayers: 14,
        schedule: [{ days: [DAY.Fri], hour: 18, minute: 0 }]
    },
    // Walter Reed CC — Wed 12p-2:15p 55+ Only
    {
        venueKey: 'walterReed',
        title: 'Senior Run — Walter Reed CC',
        gameMode: '5v5', courtType: 'full', ageRange: '55+',
        notes: '55+ Only. Senior seeding run. Membership or daily fee.',
        durationMinutes: 135, maxPlayers: 12,
        schedule: [{ days: [DAY.Wed], hour: 12, minute: 0 }]
    },
    // GMU Activities Bldg — Tue/Fri 6p-Close
    {
        venueKey: 'gmuActivities',
        title: 'Evening Run — GMU Activities Bldg',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: 'Dedicated play. Gym A. 18+ only. Protected time. Community membership req.',
        durationMinutes: 180, maxPlayers: 14,
        schedule: [{ days: [DAY.Tue, DAY.Fri], hour: 18, minute: 0 }]
    },
    // The St. James — Varies (league/rental)
    {
        venueKey: 'stJames',
        title: 'League Play — The St. James',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Premium facility. High friction. Mostly organized leagues. Rental fees apply.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Sat], hour: 10, minute: 0 }]
    },

    // ── Richmond ─────────────────────────────────────────────────
    // Bellemeade CC — Sat 8a-10a, 30+
    {
        venueKey: 'bellemeade',
        title: 'Saturday Morning — Bellemeade CC',
        gameMode: '5v5', courtType: 'full', ageRange: '30+',
        notes: '30+ Only. Mature run, organized play. Free.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Sat], hour: 8, minute: 0 }]
    },
    // Eastern Henrico Rec — Mon/Wed 5:30p-8p, 30+
    {
        venueKey: 'easternHenrico',
        title: 'Evening Run — Eastern Henrico Rec',
        gameMode: '5v5', courtType: 'full', ageRange: '30+',
        notes: '30+ Only. Suburban mature run. Free.',
        durationMinutes: 150, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Wed], hour: 17, minute: 30 }]
    },
    // Deep Run Rec — Sun 3p-5p, 18+
    {
        venueKey: 'deepRun',
        title: 'Sunday Afternoon — Deep Run Rec',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: '18+ Only. Weekend afternoon option. Free.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Sun], hour: 15, minute: 0 }]
    },
    // Powhatan Hill CC — Fri 12p-2p, 18+
    {
        venueKey: 'powhatanHill',
        title: 'Lunch Run — Powhatan Hill CC',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: '18+ lunch run. Free.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Fri], hour: 12, minute: 0 }]
    },
    // T.B. Smith CC — Mon-Fri 12p-1p, 18+
    {
        venueKey: 'tbSmith',
        title: 'Lunch Run — T.B. Smith CC',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: '18+ lunch run. Strict 1-hr window. Free.',
        durationMinutes: 60, maxPlayers: 12,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 12, minute: 0 }]
    },
    // VCU Cary St Gym — Daily 5:45a-11p
    {
        venueKey: 'vcuCarySt',
        title: 'Open Gym — VCU Cary St Gym',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Student/Community mix. High volume. Membership required.',
        durationMinutes: 180, maxPlayers: 20,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri, DAY.Sat, DAY.Sun], hour: 10, minute: 0 }]
    },
    // Swift Creek YMCA — Weekdays 5a-6a
    {
        venueKey: 'swiftCreekY',
        title: 'Sunrise Ball — Swift Creek YMCA',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Sunrise ball. Informal group. YMCA membership required.',
        durationMinutes: 60, maxPlayers: 12,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 5, minute: 0 }]
    },

    // ── Virginia Beach ───────────────────────────────────────────
    // Kempsville Rec — M/W/F 5a-8a, 18+
    {
        venueKey: 'kempsvilleRec',
        title: 'Sunrise Ball — Kempsville Rec',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: 'Sunrise ball. 18+. Committed crowd. Rec membership or day pass.',
        durationMinutes: 180, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Wed, DAY.Fri], hour: 5, minute: 0 }]
    },
    // Kempsville Rec — Mon/Wed 6p-8:45p
    {
        venueKey: 'kempsvilleRec',
        title: 'Evening Run — Kempsville Rec',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: 'Adult evening run. Pass required (available 5:15p). High demand.',
        durationMinutes: 165, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Wed], hour: 18, minute: 0 }]
    },
    // Princess Anne Rec — Mon/Wed 5a-7a
    {
        venueKey: 'princessAnne',
        title: 'Breakfast Ball — Princess Anne Rec',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: 'Breakfast ball. 18+. Rec membership or day pass.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Wed], hour: 5, minute: 0 }]
    },
    // Princess Anne Rec — Mon/Wed 12p-2p
    {
        venueKey: 'princessAnne',
        title: 'Lunch Run — Princess Anne Rec',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Lunch run. Sign-up at 11:45a. Rec membership or day pass.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Wed], hour: 12, minute: 0 }]
    },
    // Williams Farm Rec — Tue/Thu 6p-9p
    {
        venueKey: 'williamsFarm',
        title: 'Evening Run — Williams Farm Rec',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: 'Adult evening run. 18+. Rec membership or day pass.',
        durationMinutes: 180, maxPlayers: 14,
        schedule: [{ days: [DAY.Tue, DAY.Thu], hour: 18, minute: 0 }]
    },
    // Bow Creek Rec — Sun 11a-2p
    {
        venueKey: 'bowCreek',
        title: 'Sunday Run — Bow Creek Rec',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: 'Adult day. 18+. Weekend run. Rec membership or day pass.',
        durationMinutes: 180, maxPlayers: 14,
        schedule: [{ days: [DAY.Sun], hour: 11, minute: 0 }]
    },
    // VB Field House — Daily 1p-11p
    {
        venueKey: 'vbFieldHouse',
        title: 'Drop-In — VB Field House',
        gameMode: '5v5', courtType: 'full', ageRange: '16+',
        notes: 'Pay-to-play drop-in. 16+. $5. Check schedule for court availability.',
        durationMinutes: 180, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri, DAY.Sat, DAY.Sun], hour: 17, minute: 0 }]
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
    // Step 1: Create courts
    const courtIds = {};
    console.log('=== Creating 19 Virginia courts ===');
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

    // Step 2: Seed runs
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
