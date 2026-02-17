#!/usr/bin/env node
/**
 * Seed Portland Scheduled Runs
 * Creates recurring scheduled runs for known Portland venues.
 * Generates the next 4 weeks of occurrences for each run.
 */

const BASE = 'https://heartfelt-appreciation-production-65f1.up.railway.app';
const BRETT_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

// ── Court ID mapping (verified against DB) ──
const COURTS = {
    columbiaChristian: 'd3e69144-b8f9-67cc-67b8-09a87159435e',
    neCC: 'eabe0c76-1f16-1c49-0838-6eae0ee495ed', // Northeast Community Center (NECC)
    mittlemanJCC: 'da60ff3a-76d1-10b4-55fa-5519002369d5',
    mattDishman: '89c99e1d-52c7-f37c-b14b-af47d5d8e989',
    warnerPacific: '840600be-d828-2b03-2e51-63b3e9ab133e',
    cascadeAthletic: 'c8d33af1-251c-e914-83cc-a6d7ac4cb9bb',
    psu: '55d3660b-c26e-1042-f7b3-e8d424d212aa',
    southwestCC: 'b6e19cb6-4b0f-cb0b-f2ef-05063b4f7700',
    // Mt. Scott CC — not in DB, skipped
};

const DAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const RUNS = [
    // ── Columbia Christian School ──
    {
        courtId: COURTS.columbiaChristian,
        title: 'Saturday Noon Run — Columbia Christian',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Pick to Play". $13-$16. Guaranteed run. Refs/Scoreboard. Jerseys required.',
        durationMinutes: 180, maxPlayers: 12,
        schedule: [{ days: [DAY.Sat], hour: 12, minute: 0 }],
    },
    {
        courtId: COURTS.columbiaChristian,
        title: 'Saturday 4:20 PM — Columbia Christian',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Pick to Play". $13-$16. Guaranteed run. Refs/Scoreboard. Jerseys required.',
        durationMinutes: 120, maxPlayers: 12,
        schedule: [{ days: [DAY.Sat], hour: 16, minute: 20 }],
    },
    {
        courtId: COURTS.columbiaChristian,
        title: 'Sunday Morning — Columbia Christian',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Pick to Play". $13-$16. Guaranteed run. Refs/Scoreboard. Jerseys required. 9:20a-1p.',
        durationMinutes: 220, maxPlayers: 12,
        schedule: [{ days: [DAY.Sun], hour: 9, minute: 20 }],
    },

    // ── NE Community Center (NECC) ──
    {
        courtId: COURTS.neCC,
        title: 'Monday Lunch Run — NE Community Center',
        gameMode: '4v4', courtType: 'full', ageRange: 'open',
        notes: '"Lunch Run". Strict sign-up rules. Games to 9. Sit after 2 wins. Professional crowd. 10a-12p.',
        durationMinutes: 120, maxPlayers: 10,
        schedule: [{ days: [DAY.Mon], hour: 10, minute: 0 }],
    },
    {
        courtId: COURTS.neCC,
        title: 'Tue/Thu Lunch Run — NE Community Center',
        gameMode: '4v4', courtType: 'full', ageRange: 'open',
        notes: '"Lunch Run". Strict sign-up rules. Games to 9. Sit after 2 wins. Professional crowd. 12:30-2:30p.',
        durationMinutes: 120, maxPlayers: 10,
        schedule: [{ days: [DAY.Tue, DAY.Thu], hour: 12, minute: 30 }],
    },

    // ── Mittleman JCC (MJCC) ──
    {
        courtId: COURTS.mittlemanJCC,
        title: 'Noon Ball — Mittleman JCC',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Noon Ball". High IQ, efficient. Guest pass available. High reliability. M/W/F 12-2p.',
        durationMinutes: 120, maxPlayers: 12,
        schedule: [{ days: [DAY.Mon, DAY.Wed, DAY.Fri], hour: 12, minute: 0 }],
    },

    // ── Matt Dishman CC ──
    {
        courtId: COURTS.mattDishman,
        title: 'Monday Evening — Matt Dishman CC',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"The Hub". Historic center of Black culture in PDX. High intensity. $6 drop-in.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon], hour: 18, minute: 0 }],
    },
    {
        courtId: COURTS.mattDishman,
        title: 'Friday Evening — Matt Dishman CC',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"The Hub". Historic center of Black culture in PDX. High intensity. $6 drop-in.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Fri], hour: 18, minute: 0 }],
    },

    // ── Warner Pacific University ──
    {
        courtId: COURTS.warnerPacific,
        title: 'Sunday 10:45 AM — Warner Pacific',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"League Style". Managed by PortlandBasketball. Join a "mercenary" team against a league team.',
        durationMinutes: 140, maxPlayers: 12,
        schedule: [{ days: [DAY.Sun], hour: 10, minute: 45 }],
    },
    {
        courtId: COURTS.warnerPacific,
        title: 'Sunday 1:20 PM — Warner Pacific',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"League Style". Managed by PortlandBasketball. Join a "mercenary" team against a league team.',
        durationMinutes: 140, maxPlayers: 12,
        schedule: [{ days: [DAY.Sun], hour: 13, minute: 20 }],
    },

    // ── Cascade Athletic Club (Gresham) ──
    {
        courtId: COURTS.cascadeAthletic,
        title: 'Tuesday 40+ Run — Cascade Athletic Club',
        gameMode: '4v4', courtType: 'full', ageRange: '40+',
        notes: '"Suburban/Masters". 40+ night is a rare verified older run. Requires member sponsor for guests.',
        durationMinutes: 120, maxPlayers: 10,
        schedule: [{ days: [DAY.Tue], hour: 17, minute: 0 }],
    },
    {
        courtId: COURTS.cascadeAthletic,
        title: 'Thursday League — Cascade Athletic Club',
        gameMode: '4v4', courtType: 'full', ageRange: 'open',
        notes: '"Suburban/Masters". Thursday league play. Requires member sponsor for guests.',
        durationMinutes: 120, maxPlayers: 10,
        schedule: [{ days: [DAY.Thu], hour: 18, minute: 0 }],
    },

    // ── Portland State (PSU) ──
    {
        courtId: COURTS.psu,
        title: 'Campus Run — PSU',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Campus Run". High volume, student-heavy. Community access requires sponsor + $9. Mon/Wed 6-10p.',
        durationMinutes: 240, maxPlayers: 20,
        schedule: [{ days: [DAY.Mon, DAY.Wed], hour: 18, minute: 0 }],
    },

    // ── Southwest Community Center ──
    {
        courtId: COURTS.southwestCC,
        title: 'Sunday 30+ Team Play — Southwest CC',
        gameMode: '5v5', courtType: 'full', ageRange: '30+',
        notes: '"Family/30+". Dedicated 30+ slot reduces conflict with younger/faster players. Sunday morning.',
        durationMinutes: 150, maxPlayers: 14,
        schedule: [{ days: [DAY.Sun], hour: 9, minute: 0 }],
    },
];

// ── Generate next 4 weeks of dates for each scheduled day ──
function getNextOccurrences(dayOfWeek, hour, minute, weeks = 4) {
    const dates = [];
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    for (let w = 0; w < weeks; w++) {
        for (let d = 0; d < 7; d++) {
            const candidate = new Date(start);
            candidate.setDate(start.getDate() + w * 7 + d);
            if (candidate.getDay() === dayOfWeek) {
                candidate.setHours(hour, minute, 0, 0);
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
