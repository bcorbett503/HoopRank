#!/usr/bin/env node
/**
 * Seed Seattle Scheduled Runs
 * Uses setUTCHours so stored times match intended display times.
 */

const BASE = 'https://heartfelt-appreciation-production-65f1.up.railway.app';
const BRETT_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

const DAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const COURTS = {
    psbl: '4ffd2379-d701-30d7-a273-14240800eaa0', // Puget Sound Basketball (PSBL Sodo)
    millerCC: '2d76d343-763d-64d8-fc19-5ff9c7b851e7', // Miller Community Center, Seattle
    rainierBeach: 'b8094dae-fcf9-bbae-197f-8874aacde6b9', // Rainier Beach Community Center
    wac: '2bf664e9-96ff-8b6e-9260-d3ba308ce490', // Washington Athletic Club
    sac: 'b0739174-e298-9b40-30f0-fc940190bd85', // Seattle Athletic Club
    greenLake: 'addbd447-ef2c-2765-b00f-447fe5fa7801', // Green Lake Community Center
    loyalHeights: '8017f233-1437-47c5-9858-a0a719ef1daa', // Loyal Heights Community Center
    delridge: '318cd545-f602-0284-ea25-606e360927cd', // Delridge Community Center
    // Seattle Central College — not found in DB, skipped
};

const RUNS = [
    // ── PSBL Sodo — Saturday ──
    {
        courtId: COURTS.psbl,
        title: 'Dawn Patrol 7:45 AM — PSBL Sodo',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Dawn Patrol." Most consistent competitive run in the city. Pre-registration required. Credits system. $15.',
        durationMinutes: 75, maxPlayers: 12,
        schedule: [{ days: [DAY.Sat], hour: 7, minute: 45 }],
    },
    {
        courtId: COURTS.psbl,
        title: 'Saturday 9:00 AM — PSBL Sodo',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Dawn Patrol." Second session. Pre-registration required. Credits system. $15.',
        durationMinutes: 75, maxPlayers: 12,
        schedule: [{ days: [DAY.Sat], hour: 9, minute: 0 }],
    },
    // ── PSBL Sodo — Lunch Pail (M-F) ──
    {
        courtId: COURTS.psbl,
        title: 'Lunch Pail — PSBL Sodo',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Lunch Pail." Strict 1-hour run for downtown workers. Efficient, structured, facilitators present. $15.',
        durationMinutes: 60, maxPlayers: 12,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 12, minute: 0 }],
    },

    // ── Miller Community Center ──
    {
        courtId: COURTS.millerCC,
        title: 'Friday Evening — Miller CC',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Prime Time Public." Rare evening public run. High energy, central Capitol Hill location. Best free run for "after work" crowd. Free.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Fri], hour: 18, minute: 0 }],
    },

    // ── Rainier Beach CC ──
    {
        courtId: COURTS.rainierBeach,
        title: 'Sunday Afternoon — Rainier Beach CC',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"South End Sunday." Destination run. Good facility. Note: Closed Feb 16-Mar 5 for maintenance. Free.',
        durationMinutes: 180, maxPlayers: 16,
        schedule: [{ days: [DAY.Sun], hour: 13, minute: 0 }],
    },

    // ── Washington Athletic Club — Masters ──
    {
        courtId: COURTS.wac,
        title: 'Golden Masters — WAC',
        gameMode: '5v5', courtType: 'full', ageRange: '50+',
        notes: '"Golden Masters." 50+ only. High IQ, fundamental play. Exclusive to members/guests. Tue/Thu 7:30-8:30am.',
        durationMinutes: 60, maxPlayers: 12,
        schedule: [{ days: [DAY.Tue, DAY.Thu], hour: 7, minute: 30 }],
    },
    // ── Washington Athletic Club — Executive Lunch ──
    {
        courtId: COURTS.wac,
        title: 'Executive Lunch — WAC',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Executive Lunch." High intensity corporate run. Members only. Fri noon-1p.',
        durationMinutes: 60, maxPlayers: 12,
        schedule: [{ days: [DAY.Fri], hour: 12, minute: 0 }],
    },

    // ── Seattle Athletic Club ──
    {
        courtId: COURTS.sac,
        title: 'Saturday Morning — Seattle Athletic Club',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Member Run." Cited as the best private run outside of WAC. Saturday mornings.',
        durationMinutes: 120, maxPlayers: 12,
        schedule: [{ days: [DAY.Sat], hour: 9, minute: 0 }],
    },

    // ── Green Lake CC ──
    {
        courtId: COURTS.greenLake,
        title: 'Mid-Day Run — Green Lake CC',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Old Guard." Historic gym. Mid-day times only (~10am-2pm). Skews older/unemployed/shift-work. M/W/F. Free.',
        durationMinutes: 240, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Wed, DAY.Fri], hour: 10, minute: 0 }],
    },

    // ── Loyal Heights CC ──
    {
        courtId: COURTS.loyalHeights,
        title: 'Afternoon Open — Loyal Heights CC',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Volume Play." Huge blocks of afternoon time (1:30-4:45p). Good for getting shots up, but games can be hit-or-miss. M-F. Free.',
        durationMinutes: 195, maxPlayers: 16,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 13, minute: 30 }],
    },

    // ── Delridge CC ──
    {
        courtId: COURTS.delridge,
        title: 'Afternoon Drop-in — Delridge CC',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Westside Options." Consistent afternoon availability for West Seattle residents avoiding the bridge. Tu/Th/F 12:30-5p. Free.',
        durationMinutes: 270, maxPlayers: 14,
        schedule: [{ days: [DAY.Tue, DAY.Thu, DAY.Fri], hour: 12, minute: 30 }],
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
