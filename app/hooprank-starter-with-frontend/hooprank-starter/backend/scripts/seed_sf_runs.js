#!/usr/bin/env node
/**
 * Seed SF Scheduled Runs
 * Creates recurring scheduled runs for known San Francisco venues.
 * Generates the next 4 weeks of occurrences for each run.
 */

const BASE = 'https://heartfelt-appreciation-production-65f1.up.railway.app';
const BRETT_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

// ── Court ID mapping (verified against DB) ──
const COURTS = {
    embarcaderoYmca: '989c4383-9088-d6d9-940b-c2761ccd1425',
    potreroHillRec: '33677a80-28f7-f0c8-6f1b-9024f0955ada',
    koretCenter: 'b638a8a8-1df2-ec14-a864-6d4d3986e84b',
    richmondRec: '10777896-f063-8886-a68a-4c6f66347099',
    equinoxSF: 'fc74ef72-1ad1-0c4d-b7cc-019c010f1e68',
    ucsfBakar: 'd351b10a-4fc9-bb7b-ed2d-82480bee2084',
    bettyAnnOng: '87429d94-621c-0c81-6da8-abe7aa1ab541',
    missionRec: '274ec68b-4c85-dc90-559d-2b7ffa47938a',
    // Squadz not in DB — skip for now
};

// Day-of-week helpers (0=Sun, 1=Mon, ..., 6=Sat)
const DAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * Each run definition:
 *   courtId, title, gameMode, courtType, ageRange, notes,
 *   durationMinutes, maxPlayers,
 *   schedule: [{ days: [int], hour: int, minute: int }]
 */
const RUNS = [
    // ── Embarcadero YMCA ──
    {
        courtId: COURTS.embarcaderoYmca,
        title: 'Morning Run — "The Chalkboard"',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Serious, corporate, efficient. High intensity. M-F before 8:30a.',
        durationMinutes: 90, maxPlayers: 12,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 7, minute: 0 }],
    },
    {
        courtId: COURTS.embarcaderoYmca,
        title: 'Lunch Run — Embarcadero YMCA',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Midday corporate crowd. High intensity.',
        durationMinutes: 90, maxPlayers: 12,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 11, minute: 30 }],
    },

    // ── Potrero Hill Rec ──
    {
        courtId: COURTS.potreroHillRec,
        title: 'Midday Open Run — Potrero Hill',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Midday work-break crowd. Scenic views. T-Th 10a-2p.',
        durationMinutes: 240, maxPlayers: 20,
        schedule: [{ days: [DAY.Tue, DAY.Thu], hour: 10, minute: 0 }],
    },
    {
        courtId: COURTS.potreroHillRec,
        title: 'Saturday Open Run — Potrero Hill',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Long Saturday window. 10a-4p. Scenic views.',
        durationMinutes: 360, maxPlayers: 20,
        schedule: [{ days: [DAY.Sat], hour: 10, minute: 0 }],
    },

    // ── USF Koret Center ──
    {
        courtId: COURTS.koretCenter,
        title: 'Weekend Morning Run — USF Koret',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Younger/Stronger." High skill ceiling. Collegiate atmosphere. 8:30a.',
        durationMinutes: 150, maxPlayers: 14,
        schedule: [{ days: [DAY.Sat, DAY.Sun], hour: 8, minute: 30 }],
    },
    {
        courtId: COURTS.koretCenter,
        title: 'Weekday Afternoon — USF Koret',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Collegiate atmosphere. Afternoon drop-in M-F.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 15, minute: 0 }],
    },

    // ── Richmond Rec ──
    {
        courtId: COURTS.richmondRec,
        title: 'Evening Drop-in — Richmond Rec',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Neighborhood regulars. Rare evening public run. Wed/Fri 8:45p.',
        durationMinutes: 90, maxPlayers: 12,
        schedule: [{ days: [DAY.Wed, DAY.Fri], hour: 20, minute: 45 }],
    },

    // ── Equinox Sports Club SF ──
    {
        courtId: COURTS.equinoxSF,
        title: 'Noon Pickup — Equinox SF',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Tech Executive" run. High cost, high quality. M/W/F noon.',
        durationMinutes: 90, maxPlayers: 12,
        schedule: [{ days: [DAY.Mon, DAY.Wed, DAY.Fri], hour: 12, minute: 0 }],
    },
    {
        courtId: COURTS.equinoxSF,
        title: 'Sunday Morning — Equinox SF',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Tech Executive" run. Sunday morning session.',
        durationMinutes: 120, maxPlayers: 12,
        schedule: [{ days: [DAY.Sun], hour: 9, minute: 0 }],
    },

    // ── UCSF Bakar ──
    {
        courtId: COURTS.ucsfBakar,
        title: 'Evening Drop-in — UCSF Bakar',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Biotech/Medical crowd. NBA court. Modern facility. Tue/Thu evenings.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Tue, DAY.Thu], hour: 18, minute: 0 }],
    },

    // ── Betty Ann Ong ──
    {
        courtId: COURTS.bettyAnnOng,
        title: "Women's Run — Betty Ann Ong",
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: "Tailored programming. Historic basketball hub. Tuesday 10a-3p.",
        durationMinutes: 300, maxPlayers: 16,
        schedule: [{ days: [DAY.Tue], hour: 10, minute: 0 }],
    },

    // ── Mission Rec ──
    {
        courtId: COURTS.missionRec,
        title: 'Drop-in — Mission Rec',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Urban core. Thu/Fri 9a-5p. Inconsistent weekends due to youth leagues.',
        durationMinutes: 480, maxPlayers: 20,
        schedule: [{ days: [DAY.Thu, DAY.Fri], hour: 9, minute: 0 }],
    },
];

// ── Generate next 4 weeks of dates for each scheduled day ──
function getNextOccurrences(dayOfWeek, hour, minute, weeks = 4) {
    const dates = [];
    const now = new Date();
    // Start from today
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    for (let w = 0; w < weeks; w++) {
        for (let d = 0; d < 7; d++) {
            const candidate = new Date(start);
            candidate.setDate(start.getDate() + w * 7 + d);
            if (candidate.getDay() === dayOfWeek) {
                candidate.setHours(hour, minute, 0, 0);
                // Only include future dates
                if (candidate > now) {
                    dates.push(candidate);
                }
            }
        }
    }
    return dates;
}

// ── Main ──
(async () => {
    let created = 0;
    let errors = 0;

    for (const run of RUNS) {
        for (const sched of run.schedule) {
            for (const day of sched.days) {
                const dates = getNextOccurrences(day, sched.hour, sched.minute);
                for (const dt of dates) {
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
                            console.error('  ✗', run.title, dt.toLocaleDateString(), result);
                            errors++;
                        }
                    } catch (e) {
                        console.error('  ✗ Network error:', run.title, e.message);
                        errors++;
                    }
                }
            }
        }
        console.log(`✓ ${run.title}`);
    }

    console.log(`\nDone! Created ${created} runs (${errors} errors).`);
})();
