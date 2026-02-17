#!/usr/bin/env node
/**
 * Seed Texas Scheduled Runs (Austin, Dallas, Houston)
 * Uses setUTCHours so stored times match intended display times.
 */

const BASE = 'https://heartfelt-appreciation-production-65f1.up.railway.app';
const BRETT_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

const DAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const COURTS = {
    // Austin
    austinRec: '0210cfa6-d094-10fc-d2fe-5a1b85819444', // Austin Recreation Center
    southAustinRec: 'e5e1b9e3-88b8-0756-a59b-ef0e4c3562e7', // South Austin Recreation Center
    northwestRec: 'e6f5e9b9-1667-2efe-ccfd-62b90b8f1b58', // Northwest Recreation Center, Austin
    // Houston
    fondeRec: '6c3e9fcf-db0d-7183-9839-9729d83b0962', // Fonde Recreation Center Courts
    // Not in DB: SportsKind (Austin), Timberglen (Dallas), Walnut Hill (Dallas),
    //            MLK Jr Rec (Dallas), SportsKind NW Park (Dallas), Life Time Highland Park (Dallas),
    //            JCC Houston, Alief Rec (Houston), Life Time Missouri City (Houston)
};

const RUNS = [
    // ════════════════════════
    // AUSTIN
    // ════════════════════════

    // ── Austin Rec Center — Thu (Prime) ──
    {
        courtId: COURTS.austinRec,
        title: 'Thursday Open Gym (Prime) — Austin Rec',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Prime open gym. Thu 9a-11:30p. Gym divided — multiple runs happening. Free / low cost.',
        durationMinutes: 150, maxPlayers: 16,
        schedule: [{ days: [DAY.Thu], hour: 9, minute: 0 }],
    },
    // ── Austin Rec Center — Tue ──
    {
        courtId: COURTS.austinRec,
        title: 'Tuesday Open Gym — Austin Rec',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Tuesday open gym session. Tue 9a-5p. Free / low cost.',
        durationMinutes: 480, maxPlayers: 16,
        schedule: [{ days: [DAY.Tue], hour: 9, minute: 0 }],
    },

    // ── South Austin Rec ──
    {
        courtId: COURTS.southAustinRec,
        title: 'Thursday Evening — South Austin Rec',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Thu 6-9pm open gym. Free / low cost.',
        durationMinutes: 180, maxPlayers: 14,
        schedule: [{ days: [DAY.Thu], hour: 18, minute: 0 }],
    },
    {
        courtId: COURTS.southAustinRec,
        title: 'Saturday Midday — South Austin Rec',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Sat 12-3pm open gym. Free / low cost.',
        durationMinutes: 180, maxPlayers: 14,
        schedule: [{ days: [DAY.Sat], hour: 12, minute: 0 }],
    },

    // ── Northwest Rec (Nooners) ──
    {
        courtId: COURTS.northwestRec,
        title: '"Nooners" — Northwest Rec',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Nooners." Standing game. Tue/Thu 11:30a-1:15p. Free / low cost.',
        durationMinutes: 105, maxPlayers: 12,
        schedule: [{ days: [DAY.Tue, DAY.Thu], hour: 11, minute: 30 }],
    },

    // ════════════════════════
    // HOUSTON
    // ════════════════════════

    // ── Fonde Rec Center — Lunch ──
    {
        courtId: COURTS.fondeRec,
        title: 'Elite Lunch Run — Fonde Rec',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Legend." The premier Houston run. Elite pickup. M-F 11a-1p. Free.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 11, minute: 0 }],
    },
    // ── Fonde Rec Center — Saturday ──
    {
        courtId: COURTS.fondeRec,
        title: 'Saturday Morning — Fonde Rec',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Legend." Saturday morning session. Free.',
        durationMinutes: 180, maxPlayers: 14,
        schedule: [{ days: [DAY.Sat], hour: 9, minute: 0 }],
    },
];

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
        console.log(`✓ ${run.title}`);
    }

    console.log(`\nDone! Created ${created} runs (${errors} errors).`);
})();
