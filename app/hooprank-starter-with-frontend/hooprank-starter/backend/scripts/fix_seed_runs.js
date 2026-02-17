#!/usr/bin/env node
/**
 * Fix Seeded Runs — Delete all Brett-created runs and re-seed with correct UTC times.
 * Bug: original scripts used setHours() (local Pacific), then toISOString() shifted +8h.
 * Fix: use setUTCHours() so stored times match intended display times.
 */

const BASE = 'https://heartfelt-appreciation-production-65f1.up.railway.app';
const BRETT_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

const DAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// ── SF Courts ──
const SF = {
    embarcaderoYmca: '989c4383-9088-d6d9-940b-c2761ccd1425',
    potreroHillRec: '33677a80-28f7-f0c8-6f1b-9024f0955ada',
    koretCenter: 'b638a8a8-1df2-ec14-a864-6d4d3986e84b',
    richmondRec: '10777896-f063-8886-a68a-4c6f66347099',
    equinoxSF: 'fc74ef72-1ad1-0c4d-b7cc-019c010f1e68',
    ucsfBakar: 'd351b10a-4fc9-bb7b-ed2d-82480bee2084',
    bettyAnnOng: '87429d94-621c-0c81-6da8-abe7aa1ab541',
    missionRec: '274ec68b-4c85-dc90-559d-2b7ffa47938a',
};

// ── Portland Courts ──
const PDX = {
    columbiaChristian: 'd3e69144-b8f9-67cc-67b8-09a87159435e',
    neCC: 'eabe0c76-1f16-1c49-0838-6eae0ee495ed',
    mittlemanJCC: 'da60ff3a-76d1-10b4-55fa-5519002369d5',
    mattDishman: '89c99e1d-52c7-f37c-b14b-af47d5d8e989',
    warnerPacific: '840600be-d828-2b03-2e51-63b3e9ab133e',
    cascadeAthletic: 'c8d33af1-251c-e914-83cc-a6d7ac4cb9bb',
    psu: '55d3660b-c26e-1042-f7b3-e8d424d212aa',
    southwestCC: 'b6e19cb6-4b0f-cb0b-f2ef-05063b4f7700',
};

const ALL_RUNS = [
    // ════════════ SAN FRANCISCO ════════════

    // Embarcadero YMCA - Morning
    {
        courtId: SF.embarcaderoYmca,
        title: 'Morning Run — "The Chalkboard"',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"The Chalkboard." Serious, corporate, efficient. High intensity. M-F before 8:30a.',
        durationMinutes: 90, maxPlayers: 12,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 7, minute: 0 }],
    },
    // Embarcadero YMCA - Lunch
    {
        courtId: SF.embarcaderoYmca,
        title: 'Lunch Run — Embarcadero YMCA',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"The Chalkboard." Serious, corporate, efficient. High intensity. Midday session.',
        durationMinutes: 90, maxPlayers: 12,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 11, minute: 30 }],
    },

    // Potrero Hill Rec - Weekday
    {
        courtId: SF.potreroHillRec,
        title: 'Midday Open Run — Potrero Hill',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Midday work-break crowd. Scenic views. T-Th 10a-2p.',
        durationMinutes: 240, maxPlayers: 20,
        schedule: [{ days: [DAY.Tue, DAY.Thu], hour: 10, minute: 0 }],
    },
    // Potrero Hill Rec - Saturday
    {
        courtId: SF.potreroHillRec,
        title: 'Saturday Open Run — Potrero Hill',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Long Saturday window. 10a-4p. Scenic views.',
        durationMinutes: 360, maxPlayers: 20,
        schedule: [{ days: [DAY.Sat], hour: 10, minute: 0 }],
    },

    // USF Koret Center - Weekend
    {
        courtId: SF.koretCenter,
        title: 'Weekend Morning Run — USF Koret',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Younger/Stronger." High skill ceiling. Collegiate atmosphere. 8:30a.',
        durationMinutes: 150, maxPlayers: 14,
        schedule: [{ days: [DAY.Sat, DAY.Sun], hour: 8, minute: 30 }],
    },
    // USF Koret Center - Weekday
    {
        courtId: SF.koretCenter,
        title: 'Weekday Afternoon — USF Koret',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Collegiate atmosphere. Afternoon drop-in M-F.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon, DAY.Tue, DAY.Wed, DAY.Thu, DAY.Fri], hour: 15, minute: 0 }],
    },

    // Richmond Rec
    {
        courtId: SF.richmondRec,
        title: 'Evening Drop-in — Richmond Rec',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Neighborhood regulars. Rare evening public run. Wed/Fri 8:45p.',
        durationMinutes: 90, maxPlayers: 12,
        schedule: [{ days: [DAY.Wed, DAY.Fri], hour: 20, minute: 45 }],
    },

    // Equinox SF - Weekday
    {
        courtId: SF.equinoxSF,
        title: 'Noon Pickup — Equinox SF',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Tech Executive" run. High cost, high quality. M/W/F noon.',
        durationMinutes: 90, maxPlayers: 12,
        schedule: [{ days: [DAY.Mon, DAY.Wed, DAY.Fri], hour: 12, minute: 0 }],
    },
    // Equinox SF - Sunday
    {
        courtId: SF.equinoxSF,
        title: 'Sunday Morning — Equinox SF',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Tech Executive" run. Sunday morning session.',
        durationMinutes: 120, maxPlayers: 12,
        schedule: [{ days: [DAY.Sun], hour: 9, minute: 0 }],
    },

    // UCSF Bakar
    {
        courtId: SF.ucsfBakar,
        title: 'Evening Drop-in — UCSF Bakar',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Biotech/Medical crowd. NBA court. Modern facility. Tue/Thu evenings.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Tue, DAY.Thu], hour: 18, minute: 0 }],
    },

    // Betty Ann Ong
    {
        courtId: SF.bettyAnnOng,
        title: "Women's Run — Betty Ann Ong",
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: "Tailored programming. Historic basketball hub. Tuesday 10a-3p.",
        durationMinutes: 300, maxPlayers: 16,
        schedule: [{ days: [DAY.Tue], hour: 10, minute: 0 }],
    },

    // Mission Rec
    {
        courtId: SF.missionRec,
        title: 'Drop-in — Mission Rec',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: 'Urban core. Thu/Fri 9a-5p. Inconsistent weekends due to youth leagues.',
        durationMinutes: 480, maxPlayers: 20,
        schedule: [{ days: [DAY.Thu, DAY.Fri], hour: 9, minute: 0 }],
    },

    // ════════════ PORTLAND ════════════

    // Columbia Christian - Sat Noon
    {
        courtId: PDX.columbiaChristian,
        title: 'Saturday Noon Run — Columbia Christian',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Pick to Play". $13-$16. Guaranteed run. Refs/Scoreboard. Jerseys required.',
        durationMinutes: 180, maxPlayers: 12,
        schedule: [{ days: [DAY.Sat], hour: 12, minute: 0 }],
    },
    // Columbia Christian - Sat 4:20
    {
        courtId: PDX.columbiaChristian,
        title: 'Saturday 4:20 PM — Columbia Christian',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Pick to Play". $13-$16. Guaranteed run. Refs/Scoreboard. Jerseys required.',
        durationMinutes: 120, maxPlayers: 12,
        schedule: [{ days: [DAY.Sat], hour: 16, minute: 20 }],
    },
    // Columbia Christian - Sun Morning
    {
        courtId: PDX.columbiaChristian,
        title: 'Sunday Morning — Columbia Christian',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Pick to Play". $13-$16. Guaranteed run. Refs/Scoreboard. Jerseys required. 9:20a-1p.',
        durationMinutes: 220, maxPlayers: 12,
        schedule: [{ days: [DAY.Sun], hour: 9, minute: 20 }],
    },

    // NE Community Center - Mon
    {
        courtId: PDX.neCC,
        title: 'Monday Lunch Run — NE Community Center',
        gameMode: '4v4', courtType: 'full', ageRange: 'open',
        notes: '"Lunch Run". Strict sign-up rules. Games to 9. Sit after 2 wins. Professional crowd. 10a-12p.',
        durationMinutes: 120, maxPlayers: 10,
        schedule: [{ days: [DAY.Mon], hour: 10, minute: 0 }],
    },
    // NE Community Center - Tue/Thu
    {
        courtId: PDX.neCC,
        title: 'Tue/Thu Lunch Run — NE Community Center',
        gameMode: '4v4', courtType: 'full', ageRange: 'open',
        notes: '"Lunch Run". Strict sign-up rules. Games to 9. Sit after 2 wins. Professional crowd. 12:30-2:30p.',
        durationMinutes: 120, maxPlayers: 10,
        schedule: [{ days: [DAY.Tue, DAY.Thu], hour: 12, minute: 30 }],
    },

    // Mittleman JCC
    {
        courtId: PDX.mittlemanJCC,
        title: 'Noon Ball — Mittleman JCC',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Noon Ball". High IQ, efficient. Guest pass available. High reliability. M/W/F 12-2p.',
        durationMinutes: 120, maxPlayers: 12,
        schedule: [{ days: [DAY.Mon, DAY.Wed, DAY.Fri], hour: 12, minute: 0 }],
    },

    // Matt Dishman - Mon
    {
        courtId: PDX.mattDishman,
        title: 'Monday Evening — Matt Dishman CC',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"The Hub". Historic center of Black culture in PDX. High intensity. $6 drop-in.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Mon], hour: 18, minute: 0 }],
    },
    // Matt Dishman - Fri
    {
        courtId: PDX.mattDishman,
        title: 'Friday Evening — Matt Dishman CC',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"The Hub". Historic center of Black culture in PDX. High intensity. $6 drop-in.',
        durationMinutes: 120, maxPlayers: 14,
        schedule: [{ days: [DAY.Fri], hour: 18, minute: 0 }],
    },

    // Warner Pacific - 10:45
    {
        courtId: PDX.warnerPacific,
        title: 'Sunday 10:45 AM — Warner Pacific',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"League Style". Managed by PortlandBasketball. Join a "mercenary" team against a league team.',
        durationMinutes: 140, maxPlayers: 12,
        schedule: [{ days: [DAY.Sun], hour: 10, minute: 45 }],
    },
    // Warner Pacific - 1:20
    {
        courtId: PDX.warnerPacific,
        title: 'Sunday 1:20 PM — Warner Pacific',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"League Style". Managed by PortlandBasketball. Join a "mercenary" team against a league team.',
        durationMinutes: 140, maxPlayers: 12,
        schedule: [{ days: [DAY.Sun], hour: 13, minute: 20 }],
    },

    // Cascade Athletic - 40+
    {
        courtId: PDX.cascadeAthletic,
        title: 'Tuesday 40+ Run — Cascade Athletic Club',
        gameMode: '4v4', courtType: 'full', ageRange: '40+',
        notes: '"Suburban/Masters". 40+ night is a rare verified older run. Requires member sponsor for guests.',
        durationMinutes: 120, maxPlayers: 10,
        schedule: [{ days: [DAY.Tue], hour: 17, minute: 0 }],
    },
    // Cascade Athletic - League
    {
        courtId: PDX.cascadeAthletic,
        title: 'Thursday League — Cascade Athletic Club',
        gameMode: '4v4', courtType: 'full', ageRange: 'open',
        notes: '"Suburban/Masters". Thursday league play. Requires member sponsor for guests.',
        durationMinutes: 120, maxPlayers: 10,
        schedule: [{ days: [DAY.Thu], hour: 18, minute: 0 }],
    },

    // PSU
    {
        courtId: PDX.psu,
        title: 'Campus Run — PSU',
        gameMode: '5v5', courtType: 'full', ageRange: 'open',
        notes: '"Campus Run". High volume, student-heavy. Community access requires sponsor + $9. Mon/Wed 6-10p.',
        durationMinutes: 240, maxPlayers: 20,
        schedule: [{ days: [DAY.Mon, DAY.Wed], hour: 18, minute: 0 }],
    },

    // Southwest CC
    {
        courtId: PDX.southwestCC,
        title: 'Sunday 30+ Team Play — Southwest CC',
        gameMode: '5v5', courtType: 'full', ageRange: '30+',
        notes: '"Family/30+". Dedicated 30+ slot reduces conflict with younger/faster players. Sunday morning.',
        durationMinutes: 150, maxPlayers: 14,
        schedule: [{ days: [DAY.Sun], hour: 9, minute: 0 }],
    },
];

// ── FIXED: Use setUTCHours so stored time matches intended display time ──
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

async function deleteAllBrettRuns() {
    console.log('=== STEP 1: Deleting all existing Brett-created runs ===');
    // Fetch all runs (multiple pages if needed)
    const res = await fetch(`${BASE}/runs/nearby?lat=0&lng=0&radius=99999`, {
        headers: { 'x-user-id': BRETT_ID },
    });
    const runs = await res.json();
    const brettRuns = runs.filter(r => r.createdBy === BRETT_ID);
    console.log(`Found ${brettRuns.length} Brett-created runs to delete (of ${runs.length} total)`);

    let deleted = 0;
    for (const run of brettRuns) {
        try {
            const dr = await fetch(`${BASE}/runs/${run.id}`, {
                method: 'DELETE',
                headers: { 'x-user-id': BRETT_ID },
            });
            const result = await dr.json();
            if (result.success) deleted++;
        } catch (e) {
            console.error('  Delete error:', run.id, e.message);
        }
    }
    console.log(`Deleted ${deleted} runs\n`);
}

async function seedAllRuns() {
    console.log('=== STEP 2: Re-seeding with correct UTC times ===');
    let created = 0;
    let errors = 0;

    for (const run of ALL_RUNS) {
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
}

// Verify a sample
async function verify() {
    console.log('\n=== STEP 3: Verification ===');
    const res = await fetch(`${BASE}/runs/nearby?lat=37.78&lng=-122.42`, {
        headers: { 'x-user-id': BRETT_ID },
    });
    const runs = await res.json();
    console.log('Upcoming runs (first 10):');
    runs.slice(0, 10).forEach(r => {
        const dt = new Date(r.scheduledAt);
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const day = dayNames[dt.getUTCDay()];
        const h = dt.getUTCHours();
        const m = dt.getUTCMinutes().toString().padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        console.log(`  ${day} ${h12}:${m} ${ampm} — ${r.title || r.courtName}`);
    });
}

(async () => {
    await deleteAllBrettRuns();
    await seedAllRuns();
    await verify();
})();
