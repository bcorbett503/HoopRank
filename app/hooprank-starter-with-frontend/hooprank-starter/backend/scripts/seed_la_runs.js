#!/usr/bin/env node
/**
 * Seed LA Scheduled Runs
 * Creates recurring scheduled runs for known Los Angeles venues.
 * Uses setUTCHours so stored times match intended display times.
 */

const BASE = 'https://heartfelt-appreciation-production-65f1.up.railway.app';
const BRETT_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

const DAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const COURTS = {
    crosscourt: '38df369a-8560-cade-e52e-2c3fdedfa07f', // Crosscourt DTLA
    mccambridge: '74b53b01-4d93-b48c-a9e6-e97895744fe4', // McCambridge Park Rec, Burbank
    equinoxLA: 'e0589d19-63a9-413d-4429-de715665e0ea', // Equinox Sports Club Los Angeles
    westwoodRec: '2ab9f899-c109-8f6c-e1af-09544d857bbc', // Westwood Recreation Center
    laac: '14e3a905-eea4-caf3-8e3f-2577be34b325', // Los Angeles Athletic Club
    vnso: '26677532-b664-7d35-cbdf-ca4ee8dbe24a', // Van Nuys Sherman Oaks Rec
    uclaWooden: '8eca4ade-2971-1154-0ee7-94bf453f4e92', // UCLA John Wooden Center
    panPacific: '343ed749-7fe2-884e-313b-3c59f27aa212', // Pan Pacific Park Gym
    // Santa Monica Memorial Park — not in DB, skipped
    // Squadz — not a fixed venue, skipped
};

const RUNS = [
    // ── Crosscourt DTLA ──
    {
        courtId: COURTS.crosscourt,
        title: '5:30 PM Session — CrossCourt DTLA',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Corporate Cardio". High-intensity 1-hour sessions. 5-minute games. Downtown professionals. Tue-Fri.',
        durationMinutes: 60, maxPlayers: 12,
        schedule: [{ days: [DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 17, minute: 30 }],
    },
    {
        courtId: COURTS.crosscourt,
        title: '6:30 PM Session — CrossCourt DTLA',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Corporate Cardio". High-intensity 1-hour sessions. 5-minute games. Downtown professionals. Tue-Fri.',
        durationMinutes: 60, maxPlayers: 12,
        schedule: [{ days: [DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 18, minute: 30 }],
    },

    // ── McCambridge Park (Burbank) ──
    {
        courtId: COURTS.mccambridge,
        title: 'Sunday Afternoon — McCambridge Park',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"The Civilized Run". Uses a sign-in sheet to manage order (rare for public parks). Good culture. Sun 1-4p.',
        durationMinutes: 180, maxPlayers: 16,
        schedule: [{ days: [DAY.Sun], hour: 13, minute: 0 }],
    },

    // ── Equinox Sports Club LA ──
    {
        courtId: COURTS.equinoxLA,
        title: 'Executive Lunch — Equinox LA',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Executive Lunch". High-level networking and play. M-F noon-2p.',
        durationMinutes: 120, maxPlayers: 12,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 12, minute: 0 }],
    },
    {
        courtId: COURTS.equinoxLA,
        title: 'Friday Evening — Equinox LA',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Executive Lunch". Friday nights are prime for members if internal league isn\'t running.',
        durationMinutes: 120, maxPlayers: 12,
        schedule: [{ days: [DAY.Fri], hour: 18, minute: 0 }],
    },

    // ── Westwood Rec Center ──
    {
        courtId: COURTS.westwoodRec,
        title: 'Adult Open — Westwood Rec',
        gameMode: '5v5', courtType: 'full', ageRange: '18+',
        notes: '"The Lunch Break". One of the few protected adult times. Evenings/Weekends heavily blocked by youth leagues. Tue/Thu 10a-12:30p.',
        durationMinutes: 150, maxPlayers: 14,
        schedule: [{ days: [DAY.Tue, DAY.Thu], hour: 10, minute: 0 }],
    },

    // ── LA Athletic Club (LAAC) ──
    {
        courtId: COURTS.laac,
        title: 'Noon Pickup — LA Athletic Club',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Historic". Played on the John R. Wooden court. "Old Man Game" style—high IQ, low athleticism. M-F noon.',
        durationMinutes: 120, maxPlayers: 12,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 12, minute: 0 }],
    },
    {
        courtId: COURTS.laac,
        title: 'Evening Run — LA Athletic Club',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Historic". Played on the John R. Wooden court. "Old Man Game" style—high IQ, low athleticism. Tue/Thu evenings.',
        durationMinutes: 120, maxPlayers: 12,
        schedule: [{ days: [DAY.Tue, DAY.Thu], hour: 18, minute: 0 }],
    },

    // ── VNSO (Van Nuys Sherman Oaks) ──
    {
        courtId: COURTS.vnso,
        title: 'Evening Outdoor Run — VNSO',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"The Cages". Lighted outdoor courts run every night. Indoor inconsistent due to Pickleball. Daily evenings.',
        durationMinutes: 150, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri, DAY.Sat, DAY.Sun], hour: 18, minute: 30 }],
    },

    // ── UCLA John Wooden Center ──
    {
        courtId: COURTS.uclaWooden,
        title: 'Friday Evening — UCLA Wooden Center',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Campus Run". High skill, young legs. Community membership required for non-students. Fri 5p-close.',
        durationMinutes: 240, maxPlayers: 20,
        schedule: [{ days: [DAY.Fri], hour: 17, minute: 0 }],
    },
    {
        courtId: COURTS.uclaWooden,
        title: 'Weekend Morning — UCLA Wooden Center',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Campus Run". High skill, young legs. Community membership required for non-students. Sat/Sun mornings.',
        durationMinutes: 180, maxPlayers: 20,
        schedule: [{ days: [DAY.Sat, DAY.Sun], hour: 9, minute: 0 }],
    },

    // ── Pan Pacific Park ──
    {
        courtId: COURTS.panPacific,
        title: 'Open Run — Pan Pacific Park',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"High Risk". Prime location but extremely vulnerable to youth league blackouts. Good run if available. Check schedule.',
        durationMinutes: 180, maxPlayers: 16,
        schedule: [{ days: [DAY.Sat], hour: 10, minute: 0 }],
    },
];

// ── FIXED: Use setUTCHours ──
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
