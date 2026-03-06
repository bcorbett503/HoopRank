# Recurring Scheduled Runs and Court Ingestion

## Purpose

This document defines the target behavior for recurring scheduled runs and the protocol for ingesting new court-run data when the source format is:

- `venue`
- `day`
- `time`
- `notes`

This is the operating spec for how recurring runs should work, even where the current implementation is still catching up.

## Core model

Recurring scheduled runs should be modeled as 3 linked layers:

1. Series

A single recurring series represents the logical run, for example:

- `Friday at 6:00 PM`
- `Venice Beach Basketball Courts`
- `weekly`

This is the canonical item. It should not be duplicated every week.

2. Occurrence

An occurrence is one dated instance of the series, for example:

- `Friday, March 13, 2026 at 6:00 PM PDT`

Occurrences are derived from the series in the venue's local timezone.

3. Feed post

A feed post is a fresh discovery artifact linked to a specific occurrence. It should be created when the occurrence enters the `T-48h` window.

## Product rules

- Weekly recurrence only.
- Venue-local time is authoritative.
- The venue timezone, not UTC clock time, defines the recurring schedule.
- One logical series should exist for one slot.
- A "slot" means `venue + weekday + local start time + title`.
- Do not create duplicate series for the same slot.
- If two source rows describe the same slot, update the existing series instead of creating a second one.
- If two source rows have the same venue, day, and time but are truly different runs, they must have clearly distinct titles derived from notes before ingest.
- Discovery feed exposure for scheduled-run posts is hard-capped at 25 miles.
- Within that 25-mile radius, nearer runs rank ahead of farther runs.
- If there are no scheduled-run posts within 25 miles, discovery should show no farther scheduled-run posts.
- `own`, `following`, and `attending` views may bypass the 25-mile discovery cap if product wants that behavior.

## Source of truth in this repo

Today, the curated scheduled-run dataset lives here:

- `scripts/ops/run_data.js`

The current seeding entrypoint is:

- `scripts/ops/seed_runs.js`

Any new curated court-run data should be normalized into `run_data.js` first, then seeded.

## Current repo constraint

The target model in this document assumes venue-local recurrence is stored explicitly.

Today, the current seeding path still derives timezone indirectly from venue location and state mapping in `scripts/ops/seed_runs.js`.

That means:

- operators should still resolve the true venue timezone during intake
- the venue city and location data must be accurate
- timezone should be treated as required operational metadata even if the current runtime does not persist it cleanly yet

## Input contract

Each raw source row should be treated as one weekly recurring slot:

| Field | Meaning |
| --- | --- |
| `venue` | Raw venue name from source |
| `day` | Weekday in venue-local time |
| `time` | Start time in venue-local time |
| `notes` | Free-text context, rules, access, audience, duration hints, title hints |

If the source contains multiple days in one row, split it into one row per day before ingest.

If the source contains a time range, the start time should populate `time`, and the range should remain in `notes` so duration can be derived.

## Ingestion protocol

### Step 1: Normalize the venue

For each input row:

- Trim and normalize the raw venue name.
- Try to match it to an existing venue in `run_data.js`.
- Match by exact venue name first.
- If exact name fails, match by known alias or obvious spelling variant.
- If the venue already exists, reuse its `venueKey`.
- If the venue does not exist, create a new venue record before creating the run.

Required metadata for a new venue:

- `key`
- `name`
- `city`
- `address`
- `lat`
- `lng`
- `timezone`
- `indoor`
- `access`
- `venue_type`

Do not create a new venue entry until the location is resolved to a real place with a stable address and coordinates.

### Step 2: Normalize the schedule

- Convert `day` into one of `D.Sun`, `D.Mon`, `D.Tue`, `D.Wed`, `D.Thu`, `D.Fri`, `D.Sat`.
- Parse `time` into `hour` and `minute` in 24-hour venue-local time.
- Store the recurring rule as weekly.
- Do not anchor the recurrence by a fixed UTC time.
- The source-of-truth schedule is `weekday + local start time + timezone`.

Accepted examples:

- `Friday` -> `D.Fri`
- `Fri` -> `D.Fri`
- `6pm` -> `hour: 18, minute: 0`
- `6:30 PM` -> `hour: 18, minute: 30`

### Step 3: Normalize notes into structured fields

`notes` should always be preserved as source context, but it should also drive field derivation.

Derive these fields in order:

- `title`
- `gameMode`
- `courtType`
- `ageRange`
- `durationMinutes`
- `maxPlayers`

Default rules:

- `title`: if notes clearly name the run, use that. Otherwise use `Open Run - <Venue Name>`.
- `gameMode`: default `5v5`.
- `courtType`: default `full`.
- `ageRange`: default `open`.
- `durationMinutes`: default `120` unless notes describe a longer window.
- `maxPlayers`: default `14` for indoor runs and `20` for outdoor runs.

Heuristics from notes:

- If notes mention `half court`, use `courtType: 'half'`.
- If notes mention `3v3` or `4v4`, set `gameMode` accordingly.
- If notes mention `adults only`, `18+`, `30+`, `40+`, or `50+`, carry that into `ageRange`.
- If notes mention a specific run window like `6-9pm`, derive `durationMinutes = 180`.
- If notes mention large open gym or park turnover, increase `maxPlayers` if justified.

### Step 4: Build the stable series identity

Every recurring run should have a stable identity:

- `venueKey`
- `weekday`
- `local start time`
- `title`

This identity is the dedupe key for ingestion.

If an incoming row resolves to an existing series identity:

- update the existing series
- merge or refresh notes
- adjust structured fields if the new source is better
- do not create a second recurring series

If the incoming row has the same `venue + day + time` but ambiguous notes:

- do not create a second series by default
- resolve the ambiguity first
- only create a second series if notes clearly indicate a truly different recurring run

### Step 5: Write the venue entry

If the venue is new, add a venue object to `run_data.js`.

Use:

- `courtId` when the court already exists in the database
- `create: true` when the court must be created by the seeder

Example new venue:

```js
{ key: 'veniceBeach', create: true, name: 'Venice Beach Basketball Courts', city: 'Los Angeles, CA', lat: 33.9850, lng: -118.4695, indoor: false, access: 'public', venue_type: 'park', address: '1800 Ocean Front Walk, Venice, CA 90291' }
```

### Step 6: Write the run entry

Add one run definition to `run_data.js` for the recurring series.

Example:

```js
r('veniceBeach', 'Friday Sunset Run - Venice Beach', {
  gameMode: '5v5',
  courtType: 'full',
  ageRange: 'open',
  notes: 'Strong Friday evening outdoor run. Sunset crowd. Public park.',
  durationMinutes: 120,
  maxPlayers: 20,
  schedule: [{ days: [D.Fri], hour: 18, minute: 0 }],
})
```

If the same run happens on multiple days at the same time, keep one run definition and add multiple days:

```js
schedule: [{ days: [D.Tue, D.Thu], hour: 18, minute: 30 }]
```

If the same venue has different runs at different times, create separate run definitions.

### Step 7: Seed safely

Use a dry run first:

```bash
TOKEN=dry node scripts/ops/seed_runs.js --market <market>
```

Then seed for real:

```bash
TOKEN=<token> node scripts/ops/seed_runs.js --market <market>
```

The seeder should create missing courts, then create or update recurring templates from `run_data.js`.

### Step 8: Verify

Before calling ingestion complete, verify:

- the venue exists or was created successfully
- the run appears only once per intended series slot
- the venue timezone is correct
- the rendered local time matches the venue's local wall-clock time
- the next weekly occurrence is correct
- a fresh feed post will be created at `T-48h`
- discovery feed visibility for that occurrence is capped at 25 miles

## Protocol for operators

When a new source row arrives:

1. Resolve the venue.
2. Determine whether the venue already exists.
3. Normalize the weekday and local start time.
4. Preserve raw notes.
5. Derive title and defaults from notes.
6. Check whether the slot already exists.
7. Update if it exists.
8. Create if it does not.
9. Seed in dry-run mode.
10. Seed for real.
11. Verify local-time rendering, weekly recurrence, `T-48h` feed-post creation, and 25-mile discovery behavior.

## Example from raw input

Raw input:

```text
venue: Venice Beach Basketball Courts
day: Friday
time: 6:00 PM
notes: Strong outdoor sunset run. Public park. Good open run.
```

Normalized result:

- venue matched or created as `veniceBeach`
- day normalized to `D.Fri`
- time normalized to `18:00`
- title becomes `Open Run - Venice Beach Basketball Courts` unless a better run name is present
- game mode defaults to `5v5`
- court type defaults to `full`
- age range defaults to `open`
- duration defaults to `120`
- max players defaults to `20` because the venue is outdoor

Run entry:

```js
r('veniceBeach', 'Open Run - Venice Beach Basketball Courts', {
  gameMode: '5v5',
  courtType: 'full',
  ageRange: 'open',
  notes: 'Strong outdoor sunset run. Public park. Good open run.',
  durationMinutes: 120,
  maxPlayers: 20,
  schedule: [{ days: [D.Fri], hour: 18, minute: 0 }],
})
```

## Non-goals

- Do not create one long list of future weekly rows by hand.
- Do not use fixed UTC recurrence as the source of truth.
- Do not create duplicate runs for the same slot because of slightly different notes.
- Do not expand scheduled-run discovery beyond 25 miles for users who are not following or attending.
