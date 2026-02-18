/**
 * seed_iconic_runs.js — Seeds 26 iconic basketball venues across the US
 *
 * Discovery-found courts (use existing IDs):
 *   West 4th Street "The Cage"     → 65d8e17b-95a8-ddd1-9521-b872a59bdbd4
 *   Rucker Park                    → 235a779d-5c5d-cfe3-0a94-a166a78b1de6
 *   Venice Beach Basketball Courts → 937c073c-367e-de83-5913-382441cededb
 *   UCLA John Wooden Center        → 8eca4ade-2971-1154-0ee7-94bf453f4e92
 *
 * To be created (22 venues — outdoor/niche not in discovery data).
 *
 * SKIPPED from seeding (too vague / seasonal / invite-only):
 *   - Life Time Sky Manhattan — "Varies" schedule, membership-gated
 *   - Barry Farm Rec (Goodman League) — Summer-only league, current dates are winter
 *   - Tustin Playground (Philly) — "Not specified" times
 *   - Columbus Park (Boston) — "Not specified" times
 *   - UCLA SAC Rico Hines — Summer invite-only pro scrimmage
 *   - Kezar Pavilion (SF) — "Varies", school-year constraints
 *   - St. Cecilia "The Saint" (Detroit) — "Varies", historic but no times
 *
 * Sunset Park LV — ALREADY SEEDED (skip duplicate)
 *
 * Usage: TOKEN=<firebase-id-token> node seed_iconic_runs.js
 */

const crypto = require('crypto');
const BASE = 'https://heartfelt-appreciation-production-65f1.up.railway.app';
const BRETT_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
    console.error('Usage: TOKEN=<firebase-id-token> node seed_iconic_runs.js');
    process.exit(1);
}

const DAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const delay = ms => new Promise(r => setTimeout(r, ms));

// ─── Courts to CREATE (not in discovery DB) ─────────────────────────────────

const COURTS_TO_CREATE = [
    // DC
    { id: crypto.randomUUID(), name: 'Barry Farm Recreation Center', city: 'Washington', lat: 38.8487, lng: -76.9901, indoor: true, venue_type: 'recreation_center', address: '1230 Sumner Rd SE, Washington, DC 20020' },

    // Philadelphia
    { id: crypto.randomUUID(), name: 'Hank Gathers Recreation Center', city: 'Philadelphia', lat: 39.9731, lng: -75.1583, indoor: true, venue_type: 'recreation_center', address: '2501 W Diamond St, Philadelphia, PA 19121' },

    // Oakland
    { id: crypto.randomUUID(), name: 'Mosswood Park Basketball Courts', city: 'Oakland', lat: 37.8274, lng: -122.2608, indoor: false, venue_type: 'park', address: '3612 Webster St, Oakland, CA 94609' },

    // SF
    { id: crypto.randomUUID(), name: 'The Panhandle Basketball Courts', city: 'San Francisco', lat: 37.7729, lng: -122.4410, indoor: false, venue_type: 'park', address: 'Panhandle Park, San Francisco, CA 94117' },

    // Seattle
    { id: crypto.randomUUID(), name: 'Green Lake Park Basketball Courts', city: 'Seattle', lat: 47.6802, lng: -122.3395, indoor: false, venue_type: 'park', address: '7201 E Green Lake Dr N, Seattle, WA 98115' },

    // Portland
    { id: crypto.randomUUID(), name: 'Irving Park Basketball Courts', city: 'Portland', lat: 45.5387, lng: -122.6421, indoor: false, venue_type: 'park', address: '707 NE Fremont St, Portland, OR 97212' },

    // Chicago
    { id: crypto.randomUUID(), name: 'Foster Park', city: 'Chicago', lat: 41.7390, lng: -87.6394, indoor: false, venue_type: 'park', address: '1440 W 84th St, Chicago, IL 60620' },
    { id: crypto.randomUUID(), name: 'Humboldt Park Basketball Courts', city: 'Chicago', lat: 41.9020, lng: -87.7034, indoor: false, venue_type: 'park', address: '1400 N Sacramento Ave, Chicago, IL 60622' },

    // Detroit
    { id: crypto.randomUUID(), name: 'Joe Dumars Fieldhouse', city: 'Shelby Township', lat: 42.6614, lng: -83.0340, indoor: true, venue_type: 'fieldhouse', address: '45300 Mound Rd, Shelby Township, MI 48317' },

    // Cleveland
    { id: crypto.randomUUID(), name: 'Mandel Jewish Community Center', city: 'Beachwood', lat: 41.4683, lng: -81.5080, indoor: true, venue_type: 'community_center', address: '26001 S Woodland Rd, Beachwood, OH 44122' },

    // Houston
    { id: crypto.randomUUID(), name: 'Fonde Recreation Center', city: 'Houston', lat: 29.7367, lng: -95.3484, indoor: true, venue_type: 'recreation_center', address: '110 Sabine St, Houston, TX 77007' },

    // Las Vegas
    { id: crypto.randomUUID(), name: 'Atlas Basketball (The Loop)', city: 'Las Vegas', lat: 36.1150, lng: -115.1720, indoor: true, venue_type: 'gym', address: '6485 S Rainbow Blvd #100, Las Vegas, NV 89118' },

    // Miami
    { id: crypto.randomUUID(), name: 'Flamingo Park Basketball Courts', city: 'Miami Beach', lat: 25.7770, lng: -80.1350, indoor: false, venue_type: 'park', address: '1200 Meridian Ave, Miami Beach, FL 33139' },
    { id: crypto.randomUUID(), name: 'Life Time - Coral Gables', city: 'Coral Gables', lat: 25.7500, lng: -80.2600, indoor: true, venue_type: 'gym', address: '4000 SW 57th Ave, Coral Gables, FL 33155' },

    // Atlanta
    { id: crypto.randomUUID(), name: 'Life Time - Buckhead', city: 'Atlanta', lat: 33.8480, lng: -84.3560, indoor: true, venue_type: 'gym', address: '3445 Peachtree Rd NE, Atlanta, GA 30326' },

    // Dallas
    { id: crypto.randomUUID(), name: 'Reverchon Park Basketball Courts', city: 'Dallas', lat: 32.7990, lng: -96.8080, indoor: false, venue_type: 'park', address: '3505 Maple Ave, Dallas, TX 75219' },
];

// ─── Courts already in discovery DB ──────────────────────────────────────────

const EXISTING_COURTS = {
    west4th: '65d8e17b-95a8-ddd1-9521-b872a59bdbd4',
    rucker: '235a779d-5c5d-cfe3-0a94-a166a78b1de6',
    veniceBeach: '937c073c-367e-de83-5913-382441cededb',
};

// ─── Run definitions ─────────────────────────────────────────────────────────

function buildRuns(courtMap) {
    return [
        // ═══ NEW YORK CITY ═══
        {
            courtId: EXISTING_COURTS.west4th,
            title: 'Weekend Afternoon — The Cage (West 4th)',
            days: [DAY.Sat, DAY.Sun], hour: 12, minute: 0,
            gameMode: '3v3', courtType: 'half', ageRange: 'open',
            durationMinutes: 300, maxPlayers: 20,
            notes: 'Undersized cage court; very physical/fast play. Winner stays. Peak hours noon to dusk.',
        },
        {
            courtId: EXISTING_COURTS.west4th,
            title: 'Weekday Evening — The Cage (West 4th)',
            days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 17, minute: 0,
            gameMode: '3v3', courtType: 'half', ageRange: 'open',
            durationMinutes: 180, maxPlayers: 16,
            notes: 'After-work runs. Physical, fast pace. Season/league dependent.',
        },
        {
            courtId: EXISTING_COURTS.rucker,
            title: 'Morning Pickup — Rucker Park',
            days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri, DAY.Sat, DAY.Sun], hour: 10, minute: 0,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 240, maxPlayers: 20,
            notes: 'Historic Harlem court. Best pickup during mornings/early afternoons. Summer evenings dominated by EBC/leagues.',
        },

        // ═══ PHILADELPHIA ═══
        {
            courtId: courtMap['Hank Gathers Recreation Center'],
            title: 'Weekend Afternoon — Hank Gathers Rec',
            days: [DAY.Sat, DAY.Sun], hour: 12, minute: 0,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 240, maxPlayers: 20,
            notes: 'Intense community-rooted run. 12–4pm weekends. Winter constrained by school use.',
        },
        {
            courtId: courtMap['Hank Gathers Recreation Center'],
            title: 'Weekday Evening — Hank Gathers Rec',
            days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 17, minute: 0,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 180, maxPlayers: 20,
            notes: 'After-work evening run 5–8pm. North Philly staple.',
        },

        // ═══ LOS ANGELES ═══
        {
            courtId: EXISTING_COURTS.veniceBeach,
            title: 'Morning Run — Venice Beach',
            days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri, DAY.Sat], hour: 10, minute: 0,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 180, maxPlayers: 20,
            notes: 'Court 1 elite "winner stays" to 11 straight. Arrive early for first game.',
        },
        {
            courtId: EXISTING_COURTS.veniceBeach,
            title: 'Afternoon Run — Venice Beach',
            days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 16, minute: 0,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 180, maxPlayers: 20,
            notes: 'Second wave. Still competitive. Court 1 elite. Free.',
        },
        {
            courtId: EXISTING_COURTS.veniceBeach,
            title: 'Sunday League/Pickup — Venice Beach',
            days: [DAY.Sun], hour: 12, minute: 0,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 240, maxPlayers: 20,
            notes: 'VBL dominates many Sundays in summer. Off-season: open pickup from noon.',
        },

        // ═══ OAKLAND ═══
        {
            courtId: courtMap['Mosswood Park Basketball Courts'],
            title: 'Weekend Afternoon — Mosswood Park',
            days: [DAY.Fri, DAY.Sat], hour: 14, minute: 0,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 180, maxPlayers: 20,
            notes: 'Historic East Bay run. Games start ~2–3pm. Can be hit-or-miss.',
        },

        // ═══ SAN FRANCISCO ═══
        {
            courtId: courtMap['The Panhandle Basketball Courts'],
            title: 'Afternoon Run — The Panhandle',
            days: [DAY.Thu, DAY.Fri, DAY.Sat, DAY.Sun], hour: 14, minute: 0,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 180, maxPlayers: 16,
            notes: 'Reliable, competitive but friendly. Outdoor courts. Free.',
        },

        // ═══ SEATTLE ═══
        {
            courtId: courtMap['Green Lake Park Basketball Courts'],
            title: 'Weekend Evening — Green Lake Park',
            days: [DAY.Sat, DAY.Sun], hour: 17, minute: 0,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 180, maxPlayers: 20,
            notes: 'Outdoor summer staple. Best in warmer months. Free.',
        },

        // ═══ PORTLAND ═══
        {
            courtId: courtMap['Irving Park Basketball Courts'],
            title: 'Weekend Afternoon — Irving Park',
            days: [DAY.Sat, DAY.Sun], hour: 13, minute: 0,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 180, maxPlayers: 16,
            notes: 'High-skill outdoor run. Covered court helps in drizzle. Free.',
        },

        // ═══ CHICAGO ═══
        {
            courtId: courtMap['Foster Park'],
            title: 'Saturday Morning — Foster Park (FPBL)',
            days: [DAY.Sat], hour: 11, minute: 0,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 165, maxPlayers: 20,
            notes: 'Foster Park Basketball League (FPBL) cadence. 11am–1:45pm Saturday. Competitive.',
        },
        {
            courtId: courtMap['Foster Park'],
            title: 'Weeknight Run — Foster Park',
            days: [DAY.Mon, DAY.Wed, DAY.Thu, DAY.Fri], hour: 18, minute: 0,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 150, maxPlayers: 20,
            notes: 'League nights. Mon/Wed/Thu/Fri evenings.',
        },
        {
            courtId: courtMap['Humboldt Park Basketball Courts'],
            title: 'Sunday Morning — Humboldt Park',
            days: [DAY.Sun], hour: 10, minute: 0,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 180, maxPlayers: 20,
            notes: '"Church" pickup run. Sunday mornings. Outdoor.',
        },

        // ═══ DETROIT ═══
        {
            courtId: courtMap['Joe Dumars Fieldhouse'],
            title: 'Evening Run — Joe Dumars Fieldhouse',
            days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri, DAY.Sat, DAY.Sun], hour: 20, minute: 0,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 360, maxPlayers: 20,
            notes: 'Open late until ~2am. Volume gym. Run quality varies.',
        },

        // ═══ CLEVELAND ═══
        {
            courtId: courtMap['Mandel Jewish Community Center'],
            title: 'Sunday Morning — Mandel JCC',
            days: [DAY.Sun], hour: 7, minute: 30,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 210, maxPlayers: 16,
            notes: 'Consistent indoor pickup. 7:30–11am Sundays. Membership/day pass.',
        },
        {
            courtId: courtMap['Mandel Jewish Community Center'],
            title: 'Tuesday Early Bird — Mandel JCC',
            days: [DAY.Tue], hour: 5, minute: 30,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 120, maxPlayers: 14,
            notes: 'Early-morning run 5:30–7:30am. Before-work crowd.',
        },

        // ═══ HOUSTON ═══
        {
            courtId: courtMap['Fonde Recreation Center'],
            title: 'Evening Run — Fonde Rec ("No Excuses")',
            days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu], hour: 18, minute: 0,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 180, maxPlayers: 20,
            notes: '"No Excuses" culture. Elite intensity. Mon–Thu evenings.',
        },

        // ═══ LAS VEGAS ═══
        {
            courtId: courtMap['Atlas Basketball (The Loop)'],
            title: 'Weekend Organized Run — Atlas Basketball',
            days: [DAY.Sat, DAY.Sun], hour: 12, minute: 0,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 120, maxPlayers: 20,
            notes: 'Paid organized run (~$12). Officiated. Noon–2pm weekends.',
        },

        // ═══ MIAMI ═══
        {
            courtId: courtMap['Flamingo Park Basketball Courts'],
            title: 'Morning Run — Flamingo Park',
            days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri, DAY.Sat, DAY.Sun], hour: 7, minute: 0,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 420, maxPlayers: 20,
            notes: 'Daylight-heavy outdoor run. 7am–2pm. Evening courts often rented. Free.',
        },
        {
            courtId: courtMap['Life Time - Coral Gables'],
            title: 'Early Morning Pickup — Life Time Coral Gables',
            days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 5, minute: 0,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 120, maxPlayers: 14,
            notes: 'Premium "executive" pickup. 5–7am. Membership required ($150+/mo).',
        },

        // ═══ ATLANTA ═══
        {
            courtId: courtMap['Life Time - Buckhead'],
            title: 'Morning Pickup — Life Time Buckhead',
            days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 6, minute: 0,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 120, maxPlayers: 14,
            notes: '"Country club" hoops. Morning. Membership required.',
        },
        {
            courtId: courtMap['Life Time - Buckhead'],
            title: 'Evening Pickup — Life Time Buckhead',
            days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 18, minute: 0,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 120, maxPlayers: 14,
            notes: 'After-work run. Formation-based. Membership required.',
        },

        // ═══ DALLAS ═══
        {
            courtId: courtMap['Reverchon Park Basketball Courts'],
            title: 'After-Work Run — Reverchon Park',
            days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 18, minute: 0,
            gameMode: '5v5', courtType: 'full', ageRange: 'open',
            durationMinutes: 90, maxPlayers: 20,
            notes: 'Legendary after-work outdoor run. Lit courts. Peak 6–7pm. Free.',
        },
    ];
}

// ─── Helper: Next occurrences ────────────────────────────────────────────────

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

// ─── Main ────────────────────────────────────────────────────────────────────

(async () => {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        'x-user-id': BRETT_ID,
    };

    // Step 1: Create courts
    console.log(`\n=== Creating ${COURTS_TO_CREATE.length} courts ===`);
    const courtMap = {};
    for (const court of COURTS_TO_CREATE) {
        await delay(200);
        const params = new URLSearchParams({
            id: court.id,
            name: court.name,
            city: court.city,
            lat: String(court.lat),
            lng: String(court.lng),
            indoor: String(court.indoor),
            venue_type: court.venue_type || '',
            address: court.address || '',
        });
        try {
            const res = await fetch(`${BASE}/courts/admin/create?${params}`, {
                method: 'POST',
                headers,
            });
            const result = await res.json();
            if (result.success) {
                courtMap[court.name] = court.id;
                console.log(`  ✓ ${court.name} → ${court.id}`);
            } else {
                console.error(`  ✗ ${court.name}:`, result.error || result);
                courtMap[court.name] = court.id; // still use ID for runs
            }
        } catch (e) {
            console.error(`  ✗ ${court.name}: ${e.message}`);
            courtMap[court.name] = court.id;
        }
    }

    // Step 2: Seed runs
    const runs = buildRuns(courtMap);
    console.log(`\n=== Seeding ${runs.length} run types ===`);
    let created = 0, errors = 0;

    for (const run of runs) {
        if (!run.courtId) {
            console.error(`  ✗ SKIP ${run.title} — no courtId`);
            errors++;
            continue;
        }

        let runOk = 0;
        for (const day of run.days) {
            const dates = getNextOccurrences(day, run.hour, run.minute);
            for (const dt of dates) {
                await delay(300);
                const body = {
                    courtId: run.courtId,
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
                        headers,
                        body: JSON.stringify(body),
                    });
                    const result = await res.json();
                    if (result.success) {
                        created++;
                        runOk++;
                    } else {
                        console.error(`  ✗ ${run.title} ${dt.toISOString()} ${JSON.stringify(result)}`);
                        errors++;
                    }
                } catch (e) {
                    console.error(`  ✗ ${run.title}: ${e.message}`);
                    errors++;
                }
            }
        }
        console.log(`  ✓ ${run.title} (${runOk} instances)`);
    }

    console.log(`\nDone! Created ${created} runs (${errors} errors).`);
    console.log(`Courts created: ${COURTS_TO_CREATE.length}`);
})();
