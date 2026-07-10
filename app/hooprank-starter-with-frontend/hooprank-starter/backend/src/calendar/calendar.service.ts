import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { getRecurrenceUntil } from "../common/weekly-recurrence";

const { DateTime } = require("luxon");

export type CalendarScope = "for_you" | "mine";

export interface CalendarQuery {
  userId: string;
  scope: CalendarScope;
  start: Date;
  end: Date;
  lat?: number;
  lng?: number;
}

interface CalendarCandidate {
  event: Record<string, any>;
  followedCourt: boolean;
}

@Injectable()
export class CalendarService {
  private static readonly MAX_EVENTS = 500;
  private static readonly DISCOVERY_RADIUS_MILES = 50;

  constructor(private readonly dataSource: DataSource) {}

  async getEvents(query: CalendarQuery): Promise<Record<string, any>[]> {
    const runRows = await this.loadRunRows(query);
    const attendees = await this.loadAttendees(
      runRows.map((row) => String(row.runId ?? row.id ?? "")).filter(Boolean),
    );
    const candidates = this.expandRuns(runRows, attendees, query);
    const courtEventRows = await this.loadCourtEventRows(query);
    candidates.push(...this.expandCourtEvents(courtEventRows, query));

    if (query.scope === "mine") {
      const challengeRows = await this.loadScheduledChallenges(query);
      candidates.push(
        ...challengeRows.map((row) => ({
          event: this.mapScheduledChallenge(row, query.userId),
          followedCourt: false,
        })),
      );
    }

    const visible = candidates.filter((candidate) => {
      if (query.scope === "mine" || query.lat == null || query.lng == null) {
        return true;
      }
      const event = candidate.event;
      return (
        candidate.followedCourt ||
        event.isOwnedByMe === true ||
        event.isConfirmedByMe === true ||
        event.distanceMiles == null ||
        event.distanceMiles <= CalendarService.DISCOVERY_RADIUS_MILES
      );
    });

    visible.sort((a, b) => {
      const aPriority = this.priority(a);
      const bPriority = this.priority(b);
      if (aPriority !== bPriority) return bPriority - aPriority;

      const aDate = new Date(a.event.scheduledAt).getTime();
      const bDate = new Date(b.event.scheduledAt).getTime();
      if (aDate !== bDate) return aDate - bDate;

      const aDistance = a.event.distanceMiles ?? Number.POSITIVE_INFINITY;
      const bDistance = b.event.distanceMiles ?? Number.POSITIVE_INFINITY;
      return aDistance - bDistance;
    });

    return visible
      .slice(0, CalendarService.MAX_EVENTS)
      .map((candidate) => candidate.event);
  }

  private priority(candidate: CalendarCandidate): number {
    if (candidate.event.isOwnedByMe) return 3;
    if (candidate.event.isConfirmedByMe) return 2;
    if (candidate.followedCourt) return 1;
    return 0;
  }

  private async loadRunRows(query: CalendarQuery): Promise<any[]> {
    if (this.isPostgres) {
      const scopePredicate =
        query.scope === "mine"
          ? `(
              sr.created_by = $3
              OR EXISTS (
                SELECT 1 FROM run_attendees mine_ra
                WHERE mine_ra.run_id = sr.id AND mine_ra.user_id = $3
              )
              OR COALESCE(sr.tagged_player_ids, '') LIKE ('%' || $3 || '%')
              OR COALESCE(sr.invited_player_ids, '') LIKE ('%' || $3 || '%')
            )`
          : `(
              LOWER(BTRIM(COALESCE(sr.visibility, 'public'))) = 'public'
              OR sr.created_by = $3
              OR EXISTS (
                SELECT 1 FROM run_attendees viewer_ra
                WHERE viewer_ra.run_id = sr.id AND viewer_ra.user_id = $3
              )
              OR COALESCE(sr.tagged_player_ids, '') LIKE ('%' || $3 || '%')
              OR COALESCE(sr.invited_player_ids, '') LIKE ('%' || $3 || '%')
            )`;

      return this.dataSource.query(
        `
          SELECT
            sr.id::text AS "runId",
            sr.status_id AS "statusId",
            sr.court_id::text AS "courtId",
            c.name AS "courtName",
            c.city AS "courtCity",
            c.address AS "courtAddress",
            ST_Y(c.geog::geometry) AS "courtLat",
            ST_X(c.geog::geometry) AS "courtLng",
            sr.created_by AS "createdBy",
            COALESCE(u.name, 'Unknown') AS "creatorName",
            u.avatar_url AS "creatorPhotoUrl",
            sr.title,
            COALESCE(sr.game_mode, '5v5') AS "gameMode",
            sr.court_type AS "courtType",
            sr.age_range AS "ageRange",
            sr.scheduled_at AS "scheduledAt",
            COALESCE(sr.duration_minutes, 120)::integer AS "durationMinutes",
            COALESCE(sr.max_players, 10)::integer AS "maxPlayers",
            sr.notes,
            COALESCE(sr.is_recurring, false) AS "isRecurring",
            sr.recurrence_rule AS "recurrenceRule",
            COALESCE((
              SELECT COUNT(*) FROM run_attendees count_ra
              WHERE count_ra.run_id = sr.id
            ), 0)::integer AS "attendeeCount",
            EXISTS (
              SELECT 1 FROM run_attendees viewer_ra
              WHERE viewer_ra.run_id = sr.id AND viewer_ra.user_id = $3
            ) AS "isAttending",
            EXISTS (
              SELECT 1 FROM user_followed_courts ufc
              WHERE ufc.user_id = $3 AND ufc.court_id::text = sr.court_id::text
            ) AS "isFollowedCourt"
          FROM scheduled_runs sr
          LEFT JOIN courts c ON c.id::text = sr.court_id::text
          LEFT JOIN users u ON u.id::text = sr.created_by::text
          WHERE (
            (COALESCE(sr.is_recurring, false) = false AND sr.scheduled_at BETWEEN $1 AND $2)
            OR (
              COALESCE(sr.is_recurring, false) = true
              AND (
                LOWER(COALESCE(sr.recurrence_rule, 'weekly')) LIKE 'weekly%'
                OR UPPER(COALESCE(sr.recurrence_rule, 'weekly')) LIKE 'FREQ=WEEKLY%'
                OR UPPER(COALESCE(sr.recurrence_rule, 'weekly')) LIKE 'RRULE:FREQ=WEEKLY%'
              )
            )
          )
          AND ${scopePredicate}
          ORDER BY
            "isAttending" DESC,
            "isFollowedCourt" DESC,
            COALESCE(sr.is_recurring, false) ASC,
            sr.scheduled_at ASC
          LIMIT 1000
        `,
        [query.start.toISOString(), query.end.toISOString(), query.userId],
      );
    }

    const scopePredicate =
      query.scope === "mine"
        ? `(
            sr.created_by = ?
            OR EXISTS (
              SELECT 1 FROM run_attendees mine_ra
              WHERE mine_ra.run_id = sr.id AND mine_ra.user_id = ?
            )
            OR COALESCE(sr.tagged_player_ids, '') LIKE ('%' || ? || '%')
            OR COALESCE(sr.invited_player_ids, '') LIKE ('%' || ? || '%')
          )`
        : `(
            LOWER(TRIM(COALESCE(sr.visibility, 'public'))) = 'public'
            OR sr.created_by = ?
            OR EXISTS (
              SELECT 1 FROM run_attendees viewer_ra
              WHERE viewer_ra.run_id = sr.id AND viewer_ra.user_id = ?
            )
            OR COALESCE(sr.tagged_player_ids, '') LIKE ('%' || ? || '%')
            OR COALESCE(sr.invited_player_ids, '') LIKE ('%' || ? || '%')
          )`;
    const scopeParams = [
      query.userId,
      query.userId,
      query.userId,
      query.userId,
    ];

    return this.dataSource.query(
      `
        SELECT
          sr.id AS "runId",
          sr.status_id AS "statusId",
          sr.court_id AS "courtId",
          c.name AS "courtName",
          c.city AS "courtCity",
          c.address AS "courtAddress",
          NULL AS "courtLat",
          NULL AS "courtLng",
          sr.created_by AS "createdBy",
          COALESCE(u.name, 'Unknown') AS "creatorName",
          u.avatar_url AS "creatorPhotoUrl",
          sr.title,
          COALESCE(sr.game_mode, '5v5') AS "gameMode",
          sr.court_type AS "courtType",
          sr.age_range AS "ageRange",
          sr.scheduled_at AS "scheduledAt",
          COALESCE(sr.duration_minutes, 120) AS "durationMinutes",
          COALESCE(sr.max_players, 10) AS "maxPlayers",
          sr.notes,
          COALESCE(sr.is_recurring, 0) AS "isRecurring",
          sr.recurrence_rule AS "recurrenceRule",
          (SELECT COUNT(*) FROM run_attendees count_ra WHERE count_ra.run_id = sr.id) AS "attendeeCount",
          EXISTS (
            SELECT 1 FROM run_attendees viewer_ra
            WHERE viewer_ra.run_id = sr.id AND viewer_ra.user_id = ?
          ) AS "isAttending",
          EXISTS (
            SELECT 1 FROM user_followed_courts ufc
            WHERE ufc.user_id = ? AND ufc.court_id = sr.court_id
          ) AS "isFollowedCourt"
        FROM scheduled_runs sr
        LEFT JOIN courts c ON c.id = sr.court_id
        LEFT JOIN users u ON u.id = sr.created_by
        WHERE (
          (COALESCE(sr.is_recurring, 0) = 0 AND sr.scheduled_at BETWEEN ? AND ?)
          OR (
            COALESCE(sr.is_recurring, 0) = 1
            AND (
              LOWER(COALESCE(sr.recurrence_rule, 'weekly')) LIKE 'weekly%'
              OR UPPER(COALESCE(sr.recurrence_rule, 'weekly')) LIKE 'FREQ=WEEKLY%'
              OR UPPER(COALESCE(sr.recurrence_rule, 'weekly')) LIKE 'RRULE:FREQ=WEEKLY%'
            )
          )
        )
        AND ${scopePredicate}
        ORDER BY
          "isAttending" DESC,
          "isFollowedCourt" DESC,
          COALESCE(sr.is_recurring, 0) ASC,
          sr.scheduled_at ASC
        LIMIT 1000
      `,
      [
        query.userId,
        query.userId,
        query.start.toISOString(),
        query.end.toISOString(),
        ...scopeParams,
      ],
    );
  }

  private async loadAttendees(runIds: string[]): Promise<Map<string, any[]>> {
    const byRun = new Map<string, any[]>();
    if (runIds.length === 0) return byRun;

    const uniqueIds = [...new Set(runIds)];
    const rows = this.isPostgres
      ? await this.dataSource.query(
          `
            SELECT
              ra.run_id::text AS "runId",
              ra.user_id AS id,
              COALESCE(u.name, 'Unknown') AS name,
              u.avatar_url AS "photoUrl"
            FROM run_attendees ra
            LEFT JOIN users u ON u.id::text = ra.user_id::text
            WHERE ra.run_id::text = ANY($1::text[])
            ORDER BY ra.created_at ASC
          `,
          [uniqueIds],
        )
      : await this.dataSource.query(
          `
            SELECT
              ra.run_id AS "runId",
              ra.user_id AS id,
              COALESCE(u.name, 'Unknown') AS name,
              u.avatar_url AS "photoUrl"
            FROM run_attendees ra
            LEFT JOIN users u ON u.id = ra.user_id
            WHERE ra.run_id IN (${uniqueIds.map(() => "?").join(",")})
            ORDER BY ra.created_at ASC
          `,
          uniqueIds,
        );

    for (const row of rows) {
      const runId = String(row.runId ?? "");
      if (!runId) continue;
      const list = byRun.get(runId) ?? [];
      if (list.length < 8) {
        list.push({
          id: String(row.id ?? ""),
          name: row.name,
          photoUrl: row.photoUrl,
        });
      }
      byRun.set(runId, list);
    }
    return byRun;
  }

  private expandRuns(
    rows: any[],
    attendees: Map<string, any[]>,
    query: CalendarQuery,
  ): CalendarCandidate[] {
    const concrete = rows.filter((row) => !this.asBoolean(row.isRecurring));
    const recurring = rows.filter((row) => this.asBoolean(row.isRecurring));
    const candidates = new Map<string, CalendarCandidate>();

    for (const row of concrete) {
      const scheduledAt = new Date(row.scheduledAt);
      if (!this.isWithinWindow(scheduledAt, query)) continue;
      const key = this.runOccurrenceKey(row, scheduledAt);
      candidates.set(key, this.mapRun(row, scheduledAt, attendees, query));
    }

    for (const row of recurring) {
      for (const scheduledAt of this.weeklyOccurrences(
        row.scheduledAt,
        row.recurrenceRule,
        query,
      )) {
        const key = this.runOccurrenceKey(row, scheduledAt);
        if (!candidates.has(key)) {
          candidates.set(key, this.mapRun(row, scheduledAt, attendees, query));
        }
      }
    }

    return [...candidates.values()];
  }

  private mapRun(
    row: any,
    scheduledAt: Date,
    attendees: Map<string, any[]>,
    query: CalendarQuery,
  ): CalendarCandidate {
    const runId = String(row.runId ?? row.id ?? "");
    const courtName = String(row.courtName ?? "").trim();
    const gameMode = String(row.gameMode ?? "5v5");
    const isOwned = String(row.createdBy ?? "") === query.userId;
    const isAttending = this.asBoolean(row.isAttending);
    const courtLat = this.asOptionalNumber(row.courtLat);
    const courtLng = this.asOptionalNumber(row.courtLng);
    const occurrenceKey = scheduledAt.toISOString();

    return {
      followedCourt: this.asBoolean(row.isFollowedCourt),
      event: {
        id: `run:${runId}:${occurrenceKey}`,
        type: "run",
        scheduledAt: occurrenceKey,
        title:
          String(row.title ?? "").trim() ||
          `${gameMode} at ${courtName || "Court"}`,
        distanceMiles: this.distanceMiles(
          query.lat,
          query.lng,
          courtLat,
          courtLng,
        ),
        isConfirmedByMe: isOwned || isAttending,
        isOwnedByMe: isOwned,
        court: {
          id: row.courtId == null ? null : String(row.courtId),
          name: courtName || null,
          city: row.courtCity ?? null,
          address: row.courtAddress ?? row.courtCity ?? null,
          lat: courtLat,
          lng: courtLng,
        },
        run: {
          runId,
          statusId: row.statusId ?? null,
          gameMode,
          courtType: row.courtType ?? null,
          ageRange: row.ageRange ?? null,
          durationMinutes: this.asInteger(row.durationMinutes, 120),
          maxPlayers: this.asInteger(row.maxPlayers, 10),
          attendeeCount: this.asInteger(row.attendeeCount, 0),
          isRecurring: this.asBoolean(row.isRecurring),
          recurrenceRule: row.recurrenceRule ?? null,
          notes: row.notes ?? null,
          creator: {
            id: String(row.createdBy ?? ""),
            name: row.creatorName ?? "Unknown",
            photoUrl: row.creatorPhotoUrl ?? null,
          },
          attendeePreview: attendees.get(runId) ?? [],
          occurrenceKey,
        },
      },
    };
  }

  private async loadCourtEventRows(query: CalendarQuery): Promise<any[]> {
    try {
      if (this.isPostgres) {
        const scopePredicate =
          query.scope === "mine"
            ? `(
                ce.created_by = $3
                OR EXISTS (
                  SELECT 1 FROM user_followed_courts mine_ufc
                  WHERE mine_ufc.user_id = $3
                    AND mine_ufc.court_id::text = ce.court_id::text
                )
              )`
            : "TRUE";

        return this.dataSource.query(
          `
            SELECT
              ce.id::text AS "eventId",
              ce.court_id::text AS "courtId",
              c.name AS "courtName",
              c.city AS "courtCity",
              c.address AS "courtAddress",
              ST_Y(c.geog::geometry) AS "courtLat",
              ST_X(c.geog::geometry) AS "courtLng",
              ce.created_by AS "createdBy",
              ce.event_type AS "eventType",
              ce.title,
              ce.starts_at AS "startsAt",
              ce.ends_at AS "endsAt",
              ce.timezone,
              COALESCE(ce.is_recurring, false) AS "isRecurring",
              ce.recurrence_rule AS "recurrenceRule",
              ce.series_starts_on AS "seriesStartsOn",
              ce.series_ends_on AS "seriesEndsOn",
              ce.exception_dates AS "exceptionDates",
              ce.organizer_name AS "organizerName",
              ce.registration_url AS "registrationUrl",
              ce.source_url AS "sourceUrl",
              ce.source_title AS "sourceTitle",
              ce.cost_text AS "costText",
              ce.audience,
              ce.age_range AS "ageRange",
              ce.skill_level AS "skillLevel",
              ce.format,
              ce.evidence_type AS "evidenceType",
              ce.confidence,
              ce.status,
              ce.notes,
              EXISTS (
                SELECT 1 FROM user_followed_courts event_ufc
                WHERE event_ufc.user_id = $3
                  AND event_ufc.court_id::text = ce.court_id::text
              ) AS "isFollowedCourt"
            FROM court_events ce
            LEFT JOIN courts c ON c.id::text = ce.court_id::text
            WHERE LOWER(COALESCE(ce.status, 'published')) = 'published'
              AND (
                (
                  COALESCE(ce.is_recurring, false) = false
                  AND ce.starts_at <= $2
                  AND COALESCE(ce.ends_at, ce.starts_at) >= $1
                )
                OR (
                  COALESCE(ce.is_recurring, false) = true
                  AND ce.starts_at <= $2
                  AND (ce.series_starts_on IS NULL OR ce.series_starts_on <= $2::date)
                  AND (ce.series_ends_on IS NULL OR ce.series_ends_on >= $1::date)
                )
              )
              AND ${scopePredicate}
            ORDER BY "isFollowedCourt" DESC, ce.starts_at ASC
            LIMIT 1000
          `,
          [query.start.toISOString(), query.end.toISOString(), query.userId],
        );
      }

      const scopePredicate =
        query.scope === "mine"
          ? `(
              ce.created_by = ?
              OR EXISTS (
                SELECT 1 FROM user_followed_courts mine_ufc
                WHERE mine_ufc.user_id = ? AND mine_ufc.court_id = ce.court_id
              )
            )`
          : "1 = 1";
      const scopeParams =
        query.scope === "mine" ? [query.userId, query.userId] : [];

      return this.dataSource.query(
        `
          SELECT
            ce.id AS "eventId",
            ce.court_id AS "courtId",
            c.name AS "courtName",
            c.city AS "courtCity",
            c.address AS "courtAddress",
            NULL AS "courtLat",
            NULL AS "courtLng",
            ce.created_by AS "createdBy",
            ce.event_type AS "eventType",
            ce.title,
            ce.starts_at AS "startsAt",
            ce.ends_at AS "endsAt",
            ce.timezone,
            COALESCE(ce.is_recurring, 0) AS "isRecurring",
            ce.recurrence_rule AS "recurrenceRule",
            ce.series_starts_on AS "seriesStartsOn",
            ce.series_ends_on AS "seriesEndsOn",
            ce.exception_dates AS "exceptionDates",
            ce.organizer_name AS "organizerName",
            ce.registration_url AS "registrationUrl",
            ce.source_url AS "sourceUrl",
            ce.source_title AS "sourceTitle",
            ce.cost_text AS "costText",
            ce.audience,
            ce.age_range AS "ageRange",
            ce.skill_level AS "skillLevel",
            ce.format,
            ce.evidence_type AS "evidenceType",
            ce.confidence,
            ce.status,
            ce.notes,
            EXISTS (
              SELECT 1 FROM user_followed_courts event_ufc
              WHERE event_ufc.user_id = ? AND event_ufc.court_id = ce.court_id
            ) AS "isFollowedCourt"
          FROM court_events ce
          LEFT JOIN courts c ON c.id = ce.court_id
          WHERE LOWER(COALESCE(ce.status, 'published')) = 'published'
            AND (
              (
                COALESCE(ce.is_recurring, 0) = 0
                AND ce.starts_at <= ?
                AND COALESCE(ce.ends_at, ce.starts_at) >= ?
              )
              OR (
                COALESCE(ce.is_recurring, 0) = 1
                AND ce.starts_at <= ?
                AND (ce.series_starts_on IS NULL OR ce.series_starts_on <= date(?))
                AND (ce.series_ends_on IS NULL OR ce.series_ends_on >= date(?))
              )
            )
            AND ${scopePredicate}
          ORDER BY "isFollowedCourt" DESC, ce.starts_at ASC
          LIMIT 1000
        `,
        [
          query.userId,
          query.end.toISOString(),
          query.start.toISOString(),
          query.end.toISOString(),
          query.end.toISOString(),
          query.start.toISOString(),
          ...scopeParams,
        ],
      );
    } catch (error: any) {
      if (
        error?.code === "42P01" ||
        String(error?.message ?? "").includes("no such table: court_events")
      ) {
        return [];
      }
      throw error;
    }
  }

  private expandCourtEvents(
    rows: any[],
    query: CalendarQuery,
  ): CalendarCandidate[] {
    const candidates: CalendarCandidate[] = [];

    for (const row of rows) {
      const templateStart = new Date(row.startsAt);
      if (Number.isNaN(templateStart.getTime())) continue;

      const starts = this.asBoolean(row.isRecurring)
        ? this.weeklyOccurrences(
            templateStart,
            this.courtEventRecurrenceRule(row),
            query,
          )
        : [templateStart];

      for (const scheduledAt of starts) {
        if (!this.isWithinWindow(scheduledAt, query)) continue;
        if (this.isCourtEventException(row, scheduledAt)) continue;
        candidates.push(this.mapCourtEvent(row, scheduledAt, query));
      }
    }

    return candidates;
  }

  private mapCourtEvent(
    row: any,
    scheduledAt: Date,
    query: CalendarQuery,
  ): CalendarCandidate {
    const eventId = String(row.eventId ?? row.id ?? "");
    const occurrenceKey = scheduledAt.toISOString();
    const templateStart = new Date(row.startsAt);
    const templateEnd = row.endsAt == null ? null : new Date(row.endsAt);
    const durationMs =
      templateEnd && !Number.isNaN(templateEnd.getTime())
        ? Math.max(0, templateEnd.getTime() - templateStart.getTime())
        : 0;
    const endsAt = new Date(scheduledAt.getTime() + durationMs).toISOString();
    const courtLat = this.asOptionalNumber(row.courtLat);
    const courtLng = this.asOptionalNumber(row.courtLng);
    const isOwned = String(row.createdBy ?? "") === query.userId;

    return {
      followedCourt: this.asBoolean(row.isFollowedCourt),
      event: {
        id: `court_event:${eventId}:${occurrenceKey}`,
        type: "court_event",
        scheduledAt: occurrenceKey,
        title: String(row.title ?? "Basketball Event"),
        distanceMiles: this.distanceMiles(
          query.lat,
          query.lng,
          courtLat,
          courtLng,
        ),
        isConfirmedByMe: isOwned,
        isOwnedByMe: isOwned,
        court: {
          id: row.courtId == null ? null : String(row.courtId),
          name: row.courtName ?? null,
          city: row.courtCity ?? null,
          address: row.courtAddress ?? row.courtCity ?? null,
          lat: courtLat,
          lng: courtLng,
        },
        courtEvent: {
          eventId,
          eventType: row.eventType ?? "event",
          startsAt: occurrenceKey,
          endsAt,
          timezone: row.timezone ?? null,
          isRecurring: this.asBoolean(row.isRecurring),
          recurrenceRule: row.recurrenceRule ?? null,
          seriesStartsOn: this.asDateOnly(row.seriesStartsOn),
          seriesEndsOn: this.asDateOnly(row.seriesEndsOn),
          organizerName: row.organizerName ?? null,
          registrationUrl: row.registrationUrl ?? null,
          sourceUrl: row.sourceUrl ?? null,
          sourceTitle: row.sourceTitle ?? null,
          costText: row.costText ?? null,
          audience: row.audience ?? null,
          ageRange: row.ageRange ?? null,
          skillLevel: row.skillLevel ?? null,
          format: row.format ?? null,
          evidenceType: row.evidenceType ?? null,
          confidence: row.confidence ?? null,
          status: row.status ?? null,
          notes: row.notes ?? null,
          occurrenceKey,
        },
      },
    };
  }

  private courtEventRecurrenceRule(row: any): string {
    const existing = String(row.recurrenceRule ?? "weekly");
    if (getRecurrenceUntil(existing) || row.seriesEndsOn == null) {
      return existing;
    }

    const dateOnly = this.asDateOnly(row.seriesEndsOn);
    if (!dateOnly) return existing;
    const timezone = String(row.timezone ?? "UTC");
    const localEnd = DateTime.fromISO(dateOnly, { zone: timezone }).endOf("day");
    if (!localEnd.isValid) return existing;
    return `weekly;until=${localEnd.toUTC().toISO()}`;
  }

  private isCourtEventException(row: any, scheduledAt: Date): boolean {
    const raw = row.exceptionDates;
    if (raw == null || raw === "") return false;

    let values: unknown[];
    if (Array.isArray(raw)) {
      values = raw;
    } else {
      try {
        const parsed = JSON.parse(String(raw));
        values = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        values = String(raw).split(",");
      }
    }

    const timezone = String(row.timezone ?? "UTC");
    const occurrenceDate = DateTime.fromJSDate(scheduledAt, {
      zone: timezone,
    }).toISODate();
    return values.some((value) => this.asDateOnly(value) === occurrenceDate);
  }

  private async loadScheduledChallenges(query: CalendarQuery): Promise<any[]> {
    if (this.isPostgres) {
      return this.dataSource.query(
        `
          SELECT
            ch.id::text,
            ch.from_user_id AS "fromUserId",
            ch.to_user_id AS "toUserId",
            ch.court_id::text AS "courtId",
            ch.message,
            ch.status,
            ch.match_id::text AS "matchId",
            ch.scheduled_at AS "scheduledAt",
            fu.name AS "fromUserName",
            fu.avatar_url AS "fromUserPhotoUrl",
            tu.name AS "toUserName",
            tu.avatar_url AS "toUserPhotoUrl",
            c.name AS "courtName",
            c.city AS "courtCity",
            c.address AS "courtAddress",
            ST_Y(c.geog::geometry) AS "courtLat",
            ST_X(c.geog::geometry) AS "courtLng"
          FROM challenges ch
          LEFT JOIN users fu ON fu.id::text = ch.from_user_id::text
          LEFT JOIN users tu ON tu.id::text = ch.to_user_id::text
          LEFT JOIN courts c ON c.id::text = ch.court_id::text
          WHERE (ch.from_user_id = $1 OR ch.to_user_id = $1)
            AND ch.status IN ('pending', 'accepted')
            AND ch.scheduled_at BETWEEN $2 AND $3
          ORDER BY ch.scheduled_at ASC
        `,
        [query.userId, query.start.toISOString(), query.end.toISOString()],
      );
    }

    return this.dataSource.query(
      `
        SELECT
          ch.id,
          ch.from_user_id AS "fromUserId",
          ch.to_user_id AS "toUserId",
          ch.court_id AS "courtId",
          ch.message,
          ch.status,
          ch.match_id AS "matchId",
          ch.scheduled_at AS "scheduledAt",
          fu.name AS "fromUserName",
          fu.avatar_url AS "fromUserPhotoUrl",
          tu.name AS "toUserName",
          tu.avatar_url AS "toUserPhotoUrl",
          c.name AS "courtName",
          c.city AS "courtCity",
          c.address AS "courtAddress",
          NULL AS "courtLat",
          NULL AS "courtLng"
        FROM challenges ch
        LEFT JOIN users fu ON fu.id = ch.from_user_id
        LEFT JOIN users tu ON tu.id = ch.to_user_id
        LEFT JOIN courts c ON c.id = ch.court_id
        WHERE (ch.from_user_id = ? OR ch.to_user_id = ?)
          AND ch.status IN ('pending', 'accepted')
          AND ch.scheduled_at BETWEEN ? AND ?
        ORDER BY ch.scheduled_at ASC
      `,
      [
        query.userId,
        query.userId,
        query.start.toISOString(),
        query.end.toISOString(),
      ],
    );
  }

  private mapScheduledChallenge(row: any, userId: string): Record<string, any> {
    const isCreator = String(row.fromUserId ?? "") === userId;
    const scheduledAt = new Date(row.scheduledAt).toISOString();
    const creatorName = String(row.fromUserName ?? "Unknown");
    const opponentName = String(row.toUserName ?? "Unknown");
    return {
      id: `scheduled_match:${row.id}`,
      type: "scheduled_match",
      scheduledAt,
      title: `${creatorName} vs ${opponentName}`,
      isConfirmedByMe: String(row.status ?? "").toLowerCase() === "accepted",
      isOwnedByMe: isCreator,
      court: {
        id: row.courtId == null ? null : String(row.courtId),
        name: row.courtName ?? null,
        city: row.courtCity ?? null,
        address: row.courtAddress ?? row.courtCity ?? null,
        lat: this.asOptionalNumber(row.courtLat),
        lng: this.asOptionalNumber(row.courtLng),
      },
      scheduledMatch: {
        matchId: row.matchId == null ? "" : String(row.matchId),
        challengeId: String(row.id ?? ""),
        viewerRole: isCreator ? "creator" : "opponent",
        visibility: "participants_only",
        message: row.message ?? null,
        creator: {
          id: String(row.fromUserId ?? ""),
          name: creatorName,
          photoUrl: row.fromUserPhotoUrl ?? null,
        },
        opponent: {
          id: String(row.toUserId ?? ""),
          name: opponentName,
          photoUrl: row.toUserPhotoUrl ?? null,
        },
      },
    };
  }

  private weeklyOccurrences(
    rawStart: any,
    recurrenceRule: unknown,
    query: CalendarQuery,
  ): Date[] {
    const template = new Date(rawStart);
    if (Number.isNaN(template.getTime())) return [];

    const until = getRecurrenceUntil(recurrenceRule);
    const rangeEnd = until && until < query.end ? until : query.end;
    if (template > rangeEnd) return [];

    const rangeStart = template > query.start ? template : query.start;
    const occurrence = new Date(rangeStart);
    occurrence.setUTCHours(
      template.getUTCHours(),
      template.getUTCMinutes(),
      template.getUTCSeconds(),
      template.getUTCMilliseconds(),
    );
    const dayDelta = (template.getUTCDay() - occurrence.getUTCDay() + 7) % 7;
    occurrence.setUTCDate(occurrence.getUTCDate() + dayDelta);
    if (occurrence < rangeStart)
      occurrence.setUTCDate(occurrence.getUTCDate() + 7);

    const results: Date[] = [];
    while (occurrence <= rangeEnd && results.length < 14) {
      results.push(new Date(occurrence));
      occurrence.setUTCDate(occurrence.getUTCDate() + 7);
    }
    return results;
  }

  private runOccurrenceKey(row: any, scheduledAt: Date): string {
    return [
      String(row.courtId ?? ""),
      String(row.createdBy ?? ""),
      String(row.title ?? "")
        .trim()
        .toLowerCase(),
      scheduledAt.toISOString(),
    ].join("|");
  }

  private isWithinWindow(date: Date, query: CalendarQuery): boolean {
    return (
      !Number.isNaN(date.getTime()) && date >= query.start && date <= query.end
    );
  }

  private asBoolean(value: any): boolean {
    return value === true || value === 1 || value === "1" || value === "true";
  }

  private asInteger(value: any, fallback: number): number {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private asOptionalNumber(value: any): number | null {
    if (value == null || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private asDateOnly(value: any): string | null {
    if (value == null || value === "") return null;
    const text = String(value);
    const match = text.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? null
      : parsed.toISOString().slice(0, 10);
  }

  private distanceMiles(
    fromLat?: number,
    fromLng?: number,
    toLat?: number | null,
    toLng?: number | null,
  ): number | null {
    if (fromLat == null || fromLng == null || toLat == null || toLng == null) {
      return null;
    }
    const radians = (degrees: number) => (degrees * Math.PI) / 180;
    const dLat = radians(toLat - fromLat);
    const dLng = radians(toLng - fromLng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(radians(fromLat)) *
        Math.cos(radians(toLat)) *
        Math.sin(dLng / 2) ** 2;
    return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private get isPostgres(): boolean {
    return Boolean(process.env.DATABASE_URL);
  }
}
