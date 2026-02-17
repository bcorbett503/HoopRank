#!/usr/bin/env node
/**
 * Seed Oakland / East Bay Scheduled Runs
 * Uses setUTCHours so stored times match intended display times.
 */

const BASE = 'https://heartfelt-appreciation-production-65f1.up.railway.app';
const BRETT_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

const DAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const COURTS = {
    ogp: '856c5817-ebab-2d31-ea32-893458e071bf', // OGP Oakland
    bushrod: '79721de7-ddfb-363e-5673-67ca1ae1c381', // Bushrod Recreation Center
    oakYmca: '13779997-e280-bae8-fa49-e3b96b0a75c5', // Oakland YMCA
    alamedaPt: 'f331b63d-93e1-25a4-c5c3-484cdba84dd8', // Alameda Point Gymnasium
    rainbow: '142eb068-791f-69c3-473b-007d8acd550c', // Rainbow Recreation Center
    bladium: '5dade5ce-0947-eaf7-75d1-675230892407', // Bladium Sports & Fitness Club
    headRoyce: 'd33fe47d-bbf8-b753-3e04-6efb68d2535b', // Head-Royce School Gym (Pick Her Up)
    fmSmith: 'af9f116e-03de-fc7b-7906-7550bc503d13', // FM Smith Recreation Center
    iraJinkins: '3bebc23c-6710-5c36-d75b-920381cf81c2', // Ira Jinkins Community Center
};

const RUNS = [
    // ── OGP Oakland ──
    {
        courtId: COURTS.ogp,
        title: 'Evening Leagues & Runs — OGP',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"The Pro Run." High-level leagues & organized runs. 4 pristine courts. Highest skill ceiling in the city. Stats tracked. M-F 6-10p.',
        durationMinutes: 240, maxPlayers: 20,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 18, minute: 0 }],
    },

    // ── Bushrod Rec Center ──
    {
        courtId: COURTS.bushrod,
        title: 'Sunday Service — Bushrod Rec',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Sunday Service." The "Curry Court." Elite pickup. Often organized via Squadz. High intensity, defense optional but encouraged. ~$10.',
        durationMinutes: 90, maxPlayers: 14,
        schedule: [{ days: [DAY.Sun], hour: 16, minute: 0 }],
    },

    // ── Oakland YMCA — Lunch ──
    {
        courtId: COURTS.oakYmca,
        title: 'The Lunch Run — Oakland YMCA',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"The Lunch Run." The new home of the Lincoln Square diaspora. High IQ, older demographic, very consistent. M-F 11:30a-1:30p.',
        durationMinutes: 120, maxPlayers: 12,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 11, minute: 30 }],
    },
    // ── Oakland YMCA — After Work ──
    {
        courtId: COURTS.oakYmca,
        title: 'After Work Run — Oakland YMCA',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"The After Work Run." Younger, faster, chaotic. High volume of players. Good for testing cardio/durability. M-Th 5-8p.',
        durationMinutes: 180, maxPlayers: 16,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu], hour: 17, minute: 0 }],
    },

    // ── Alameda Point Gym ──
    {
        courtId: COURTS.alamedaPt,
        title: 'Sunday Evening — Alameda Point',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: '"The Overflow." 18+ Only. Massive 4-hour window absorbs Oakland players on Sunday nights. High value run. $8-$10.',
        durationMinutes: 240, maxPlayers: 20,
        schedule: [{ days: [DAY.Sun], hour: 18, minute: 0 }],
    },

    // ── Rainbow Rec Center ──
    {
        courtId: COURTS.rainbow,
        title: 'Midday Grind — Rainbow Rec',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Eastside Grinder." Physical, midday run. Closed summers. "Jason Richardson Gym." Raw talent, looser officiating. M-F 11a-2p. Free.',
        durationMinutes: 180, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 11, minute: 0 }],
    },

    // ── Bladium (Sofive) ──
    {
        courtId: COURTS.bladium,
        title: "Barbz Open Gym — Bladium",
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Barbz Open Gym." "Queen Court" format (Winner Stays). High pressure. Good for evaluating clutch performance. Fri 8-11p. ~$15.',
        durationMinutes: 180, maxPlayers: 14,
        schedule: [{ days: [DAY.Fri], hour: 20, minute: 0 }],
    },

    // ── Pick Her Up (at Head-Royce) ──
    {
        courtId: COURTS.headRoyce,
        title: "Women's Run — Pick Her Up",
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Women\'s Run." The premier recurring women\'s run in the East Bay. Location rotates (often Head Royce). Sun 9-11a. $10.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Sun], hour: 9, minute: 0 }],
    },

    // ── FM Smith Rec ──
    {
        courtId: COURTS.fmSmith,
        title: 'Neighborhood Run — FM Smith Rec',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Neighborhood Run." Territorial. "Regulars" have priority. No restrooms on site. High variance. Sun late AM. Free.',
        durationMinutes: 180, maxPlayers: 12,
        schedule: [{ days: [DAY.Sun], hour: 11, minute: 0 }],
    },

    // ── Ira Jinkins Rec ──
    {
        courtId: COURTS.iraJinkins,
        title: 'Evening Speed Run — Ira Jinkins',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"The Speed Run." Collegiate-sized floor favors fast players. Programs often prioritize youth, so check ahead. M/T/Th evenings. Free.',
        durationMinutes: 150, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Thu], hour: 18, minute: 30 }],
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
