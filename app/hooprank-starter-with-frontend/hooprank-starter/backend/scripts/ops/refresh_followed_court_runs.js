#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { DateTime } = require('luxon');

const args = process.argv.slice(2);
const valueAfter = (flag) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : null;
};

const artifactPath = valueAfter('--artifact');
const apply = args.includes('--apply');

if (!artifactPath || args.includes('--help')) {
    console.log('Usage: DATABASE_URL=... node scripts/ops/refresh_followed_court_runs.js --artifact <file> [--apply]');
    process.exit(artifactPath ? 0 : 1);
}
if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
}

const artifact = JSON.parse(fs.readFileSync(path.resolve(artifactPath), 'utf8'));
const stats = {
    reviewedCourts: 0,
    desiredSlots: 0,
    inserted: 0,
    updated: 0,
    retired: 0,
    futureInstancesUpdated: 0,
    futureInstancesDeleted: 0,
    followsInserted: 0,
};

const WEEKDAYS = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
    Sunday: 7,
};

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function localSlotKey(rawDate, timezone) {
    const local = DateTime.fromJSDate(new Date(rawDate), { zone: timezone });
    assert(local.isValid, `Invalid scheduled date: ${rawDate}`);
    return `${local.weekday}|${local.toFormat('HH:mm')}`;
}

function desiredSlotKey(slot) {
    assert(WEEKDAYS[slot.weekday], `Unsupported weekday: ${slot.weekday}`);
    assert(/^\d{2}:\d{2}$/.test(slot.localStart), `Invalid localStart: ${slot.localStart}`);
    return `${WEEKDAYS[slot.weekday]}|${slot.localStart}`;
}

function firstOccurrence(seriesStartsOn, slot, timezone) {
    const [hour, minute] = slot.localStart.split(':').map(Number);
    let local = DateTime.fromISO(seriesStartsOn, { zone: timezone }).startOf('day');
    assert(local.isValid, `Invalid seriesStartsOn: ${seriesStartsOn}`);
    const daysToAdd = (WEEKDAYS[slot.weekday] - local.weekday + 7) % 7;
    local = local.plus({ days: daysToAdd }).set({ hour, minute });
    assert(local.isValid, `Invalid local occurrence for ${slot.weekday} ${slot.localStart}`);
    return local.toUTC().toISO();
}

function recurrenceRule(seriesEndsOn, timezone) {
    const localEnd = DateTime.fromISO(seriesEndsOn, { zone: timezone }).endOf('day');
    assert(localEnd.isValid, `Invalid seriesEndsOn: ${seriesEndsOn}`);
    return `weekly;until=${localEnd.toUTC().toISO({ suppressMilliseconds: false })}`;
}

function recurrenceUntil(rule) {
    const match = String(rule || '').match(/(?:^|;)until=([^;]+)/i);
    if (!match) return null;
    const parsed = DateTime.fromISO(match[1], { setZone: true });
    return parsed.isValid ? parsed.toUTC() : null;
}

function isActiveTemplate(row, reviewedAt) {
    const until = recurrenceUntil(row.recurrence_rule);
    return !until || until >= reviewedAt;
}

function buildNotes(schedule, slot, sourceUrl, reviewedAt, seriesEndsOn) {
    const parts = [
        'High confidence.',
        `Evidence type: ${schedule.evidenceType}.`,
        `Verified ${reviewedAt.toFormat('MMMM d, yyyy')}.`,
        `Source URL: ${sourceUrl}.`,
        `Source title: ${schedule.sourceTitle}.`,
        `Schedule text: ${slot.scheduleText}.`,
    ];
    if (schedule.access) parts.push(`Access: ${schedule.access}.`);
    if (slot.audience) parts.push(`Audience: ${slot.audience}.`);
    if (schedule.seasonEndBasis) {
        parts.push(`Season bound through ${seriesEndsOn}: ${schedule.seasonEndBasis}.`);
    }
    if (slot.uncertainty) parts.push(`Uncertainty: ${slot.uncertainty}.`);
    return parts.join(' ');
}

async function futureConcreteRows(client, target, timezone) {
    const result = await client.query(
        `SELECT sr.*, COALESCE(COUNT(ra.run_id), 0)::integer AS attendee_count
         FROM scheduled_runs sr
         LEFT JOIN run_attendees ra ON ra.run_id = sr.id
         WHERE sr.created_by = $1
           AND sr.court_id::text = $2
           AND COALESCE(sr.is_recurring, false) = false
           AND sr.scheduled_at >= NOW()
           AND COALESCE(sr.title, '') = COALESCE($3, '')
         GROUP BY sr.id`,
        [artifact.adminUserId, target.court_id, target.title],
    );
    const targetKey = localSlotKey(target.scheduled_at, timezone);
    return result.rows.filter((row) => localSlotKey(row.scheduled_at, timezone) === targetKey);
}

async function updateOrDeleteFutureInstances(client, target, desired, timezone) {
    const concreteRows = await futureConcreteRows(client, target, timezone);
    if (concreteRows.length === 0) return;

    const oldKey = localSlotKey(target.scheduled_at, timezone);
    const newKey = desired ? localSlotKey(desired.scheduledAt, timezone) : null;
    if (desired && oldKey === newKey) {
        for (const row of concreteRows) {
            await client.query(
                `UPDATE scheduled_runs
                 SET title = $1, game_mode = $2, court_type = $3, age_range = $4,
                     duration_minutes = $5, max_players = $6, notes = $7, visibility = 'public'
                 WHERE id = $8 AND created_by = $9`,
                [
                    desired.title,
                    desired.gameMode,
                    desired.courtType,
                    desired.ageRange,
                    desired.durationMinutes,
                    desired.maxPlayers,
                    desired.notes,
                    row.id,
                    artifact.adminUserId,
                ],
            );
            stats.futureInstancesUpdated += 1;
        }
        return;
    }

    for (const row of concreteRows) {
        assert(
            Number(row.attendee_count) === 0,
            `Refusing to delete future run ${row.id}; it has ${row.attendee_count} attendee(s)`,
        );
        await client.query('DELETE FROM scheduled_runs WHERE id = $1 AND created_by = $2', [
            row.id,
            artifact.adminUserId,
        ]);
        stats.futureInstancesDeleted += 1;
    }
}

async function validateRoster(client) {
    assert(artifact.kind === 'followed_court_run_refresh_v1', 'Unsupported artifact kind');
    assert(artifact.city && artifact.timezone && artifact.adminUserId, 'Artifact scope is incomplete');
    assert(Array.isArray(artifact.reviewedCourts), 'reviewedCourts must be an array');
    assert(Array.isArray(artifact.courtSchedules), 'courtSchedules must be an array');

    const followed = await client.query(
        `SELECT c.id::text AS id, c.name
         FROM user_followed_courts f
         JOIN courts c ON c.id::text = f.court_id::text
         WHERE f.user_id = $1 AND c.city = $2
         ORDER BY c.name`,
        [artifact.adminUserId, artifact.city],
    );
    const expectedIds = new Set(followed.rows.map((row) => row.id));
    const reviewedIds = new Set(artifact.reviewedCourts.map((court) => court.courtId));
    assert(reviewedIds.size === artifact.reviewedCourts.length, 'reviewedCourts contains duplicate court IDs');
    assert(expectedIds.size === reviewedIds.size, `Expected ${expectedIds.size} followed courts; artifact reviews ${reviewedIds.size}`);
    for (const id of expectedIds) assert(reviewedIds.has(id), `Artifact is missing followed court ${id}`);
    for (const id of reviewedIds) assert(expectedIds.has(id), `Artifact includes non-followed city court ${id}`);
    stats.reviewedCourts = reviewedIds.size;
}

async function processCourtSchedule(client, schedule, reviewedAt) {
    const reviewedCourt = artifact.reviewedCourts.find((court) => court.courtId === schedule.courtId);
    assert(reviewedCourt, `Schedule court ${schedule.courtId} is not in reviewedCourts`);
    assert(schedule.confidence === 'high', `Only high-confidence schedules can apply: ${schedule.courtName}`);
    assert(schedule.evidenceType && schedule.sourceUrl && schedule.sourceTitle, `Missing source evidence: ${schedule.courtName}`);
    assert(schedule.seriesStartsOn && schedule.seriesEndsOn, `Missing season window: ${schedule.courtName}`);

    const existingResult = await client.query(
        `SELECT * FROM scheduled_runs
         WHERE court_id::text = $1 AND created_by = $2 AND COALESCE(is_recurring, false) = true
         ORDER BY created_at, id`,
        [schedule.courtId, artifact.adminUserId],
    );
    const existing = existingResult.rows;
    const desiredKeys = new Set();
    const accountedIds = new Set();

    for (const slot of schedule.slots) {
        const key = desiredSlotKey(slot);
        assert(!desiredKeys.has(key), `Duplicate desired slot ${key} at ${schedule.courtName}`);
        desiredKeys.add(key);

        const seriesEndsOn = slot.seriesEndsOn || schedule.seriesEndsOn;
        const scheduledAt = firstOccurrence(schedule.seriesStartsOn, slot, artifact.timezone);
        const rule = recurrenceRule(seriesEndsOn, artifact.timezone);
        const notes = buildNotes(schedule, slot, schedule.sourceUrl, reviewedAt, seriesEndsOn);
        const desired = {
            title: slot.title,
            gameMode: slot.gameMode || '5v5',
            courtType: slot.courtType || 'indoor',
            ageRange: slot.ageRange || 'open',
            durationMinutes: slot.durationMinutes,
            maxPlayers: slot.maxPlayers || schedule.maxPlayers || 20,
            notes,
            scheduledAt,
            recurrenceRule: rule,
        };
        assert(desired.title && Number.isInteger(desired.durationMinutes) && desired.durationMinutes > 0, `Invalid slot at ${schedule.courtName}`);

        let matches;
        if (slot.existingRunId) {
            matches = existing.filter((row) => String(row.id) === slot.existingRunId);
            assert(matches.length === 1, `existingRunId ${slot.existingRunId} was not found at ${schedule.courtName}`);
        } else {
            matches = existing.filter((row) => localSlotKey(row.scheduled_at, artifact.timezone) === key);
            assert(matches.length <= 1, `Multiple existing templates match ${key} at ${schedule.courtName}`);
        }

        if (matches.length === 1) {
            const target = matches[0];
            assert(!accountedIds.has(String(target.id)), `Template ${target.id} is mapped to multiple desired slots`);
            await updateOrDeleteFutureInstances(client, target, desired, artifact.timezone);
            await client.query(
                `UPDATE scheduled_runs
                 SET title = $1, game_mode = $2, court_type = $3, age_range = $4,
                     scheduled_at = $5, duration_minutes = $6, max_players = $7,
                     notes = $8, is_recurring = true, recurrence_rule = $9, visibility = 'public'
                 WHERE id = $10 AND created_by = $11`,
                [
                    desired.title,
                    desired.gameMode,
                    desired.courtType,
                    desired.ageRange,
                    desired.scheduledAt,
                    desired.durationMinutes,
                    desired.maxPlayers,
                    desired.notes,
                    desired.recurrenceRule,
                    target.id,
                    artifact.adminUserId,
                ],
            );
            accountedIds.add(String(target.id));
            stats.updated += 1;
        } else {
            const inserted = await client.query(
                `INSERT INTO scheduled_runs (
                    court_id, created_by, title, game_mode, court_type, age_range,
                    scheduled_at, duration_minutes, max_players, notes,
                    is_recurring, recurrence_rule, visibility, created_at
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, 'public', NOW())
                 RETURNING id`,
                [
                    schedule.courtId,
                    artifact.adminUserId,
                    desired.title,
                    desired.gameMode,
                    desired.courtType,
                    desired.ageRange,
                    desired.scheduledAt,
                    desired.durationMinutes,
                    desired.maxPlayers,
                    desired.notes,
                    desired.recurrenceRule,
                ],
            );
            accountedIds.add(String(inserted.rows[0].id));
            stats.inserted += 1;
        }
        stats.desiredSlots += 1;
    }

    const retireIds = new Set(schedule.retireRunIds || []);
    for (const runId of retireIds) {
        const target = existing.find((row) => String(row.id) === runId);
        assert(target, `Retire run ${runId} was not found at ${schedule.courtName}`);
        assert(!accountedIds.has(runId), `Run ${runId} cannot be both desired and retired`);
        await updateOrDeleteFutureInstances(client, target, null, artifact.timezone);
        const retiredUntil = reviewedAt.minus({ days: 1 }).endOf('day').toUTC().toISO({ suppressMilliseconds: false });
        const retirementNote = `${target.notes || ''}\n\nRetired by followed-court refresh on ${reviewedAt.toISODate()}: current official schedule no longer lists this slot.`.trim();
        await client.query(
            `UPDATE scheduled_runs SET recurrence_rule = $1, notes = $2
             WHERE id = $3 AND created_by = $4`,
            [`weekly;until=${retiredUntil}`, retirementNote, runId, artifact.adminUserId],
        );
        accountedIds.add(runId);
        stats.retired += 1;
    }

    if (schedule.replaceActiveSchedule) {
        const unaccounted = existing.filter(
            (row) => isActiveTemplate(row, reviewedAt) && !accountedIds.has(String(row.id)),
        );
        assert(
            unaccounted.length === 0,
            `Unaccounted active templates at ${schedule.courtName}: ${unaccounted.map((row) => row.id).join(', ')}`,
        );
    }

    const followInsert = await client.query(
        `INSERT INTO user_followed_courts (user_id, court_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING court_id`,
        [artifact.adminUserId, schedule.courtId],
    );
    stats.followsInserted += followInsert.rowCount;
}

async function verifyAppliedState(client, reviewedAt) {
    for (const schedule of artifact.courtSchedules) {
        const rows = await client.query(
            `SELECT * FROM scheduled_runs
             WHERE court_id::text = $1 AND created_by = $2 AND COALESCE(is_recurring, false) = true`,
            [schedule.courtId, artifact.adminUserId],
        );
        const active = rows.rows.filter((row) => isActiveTemplate(row, reviewedAt));
        const activeKeys = active.map((row) => localSlotKey(row.scheduled_at, artifact.timezone));
        const desiredKeys = schedule.slots.map(desiredSlotKey);
        assert(activeKeys.length === desiredKeys.length, `Active slot count mismatch at ${schedule.courtName}`);
        for (const key of desiredKeys) {
            assert(activeKeys.filter((candidate) => candidate === key).length === 1, `Missing or duplicate active slot ${key} at ${schedule.courtName}`);
        }
        for (const row of active) {
            assert(Number(row.max_players) > 0, `Invalid max_players on ${row.id}`);
            assert(String(row.notes || '').includes(schedule.sourceUrl), `Missing source URL on ${row.id}`);
        }
    }
}

(async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: false });
    await client.connect();
    const reviewedAt = DateTime.fromISO(artifact.reviewedAt, { zone: artifact.timezone }).startOf('day');
    assert(reviewedAt.isValid, 'Invalid reviewedAt');

    try {
        await client.query('BEGIN');
        await validateRoster(client);
        for (const schedule of artifact.courtSchedules) {
            await processCourtSchedule(client, schedule, reviewedAt);
        }
        await verifyAppliedState(client, reviewedAt);

        if (apply) {
            await client.query('COMMIT');
        } else {
            await client.query('ROLLBACK');
        }

        console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry_run_rolled_back', city: artifact.city, ...stats }, null, 2));
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        await client.end();
    }
})().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
});
