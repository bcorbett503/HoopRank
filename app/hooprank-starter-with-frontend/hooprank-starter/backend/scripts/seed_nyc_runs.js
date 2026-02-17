#!/usr/bin/env node
/**
 * Seed NYC Scheduled Runs
 * Uses setUTCHours so stored times match intended display times.
 */

const BASE = 'https://heartfelt-appreciation-production-65f1.up.railway.app';
const BRETT_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

const DAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const COURTS = {
    chelseaRec: '86bf4577-6e22-c57c-6a78-506d9043bb8d', // Chelsea Recreation Center, Manhattan
    thePost: '3e01c0f4-443c-9342-bcb1-6db7ff35278e', // The Post BK, Brooklyn
    bballCity: '52c3e9b1-c9e5-c197-3694-f0f5c0194e1b', // Basketball City, Manhattan
    crossIslandY: '632e099b-2775-11ae-11c8-3ab41bc576f6', // Cross Island YMCA, Queens
    ny92: 'e1820845-4297-c5d8-ece5-7585f102f273', // 92NY Gym, Manhattan
    // PS 47 — not found in DB
};

const RUNS = [
    // ── Chelsea Rec Center ──
    {
        courtId: COURTS.chelseaRec,
        title: 'Sunday Morning — Chelsea Rec',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Consistent Sunday morning run. Medium-high reliability. Low cost (membership). Good volume spot.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Sun], hour: 8, minute: 0 }],
    },

    // ── The Post BK ──
    {
        courtId: COURTS.thePost,
        title: 'Friday Night — The Post BK',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Dedicated/Hardcore." Friday night elite run in Brooklyn. High reliability. ~$15-20.',
        durationMinutes: 180, maxPlayers: 14,
        schedule: [{ days: [DAY.Fri], hour: 21, minute: 0 }],
    },

    // ── Basketball City ──
    {
        courtId: COURTS.bballCity,
        title: 'Evening League — Basketball City',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Data Calibration." Mon-Thu league play. Very high reliability. Higher cost (league fee). Stats tracked.',
        durationMinutes: 180, maxPlayers: 20,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu], hour: 18, minute: 30 }],
    },

    // ── Cross Island YMCA ──
    {
        courtId: COURTS.crossIslandY,
        title: 'Dawn Run — Cross Island YMCA',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Dedicated Regulars." M-Th 5:30 AM. High reliability. For the truly committed early risers. Membership required.',
        durationMinutes: 90, maxPlayers: 12,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu], hour: 5, minute: 30 }],
    },

    // ── 92NY ──
    {
        courtId: COURTS.ny92,
        title: 'Midday Run — 92NY',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Corporate/Stable." M-Th 11:45 AM. Very high reliability. Corporate lunch crowd. Membership required.',
        durationMinutes: 75, maxPlayers: 12,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu], hour: 11, minute: 45 }],
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
