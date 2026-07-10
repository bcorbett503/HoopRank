import { CalendarService } from "./calendar.service";

describe("CalendarService", () => {
  let service: CalendarService;
  let dataSource: { query: jest.Mock };
  let previousDatabaseUrl: string | undefined;

  beforeEach(() => {
    previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://calendar-test";
    dataSource = { query: jest.fn() };
    service = new CalendarService(dataSource as any);
  });

  afterEach(() => {
    if (previousDatabaseUrl == null) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  it("returns owned runs and participant-only scheduled challenges for My Calendar", async () => {
    dataSource.query
      .mockResolvedValueOnce([
        {
          runId: "run-1",
          courtId: "court-1",
          courtName: "Rossi Playground",
          courtCity: "San Francisco",
          courtLat: 37.78,
          courtLng: -122.45,
          createdBy: "user-1",
          creatorName: "Brett",
          title: "Thursday Run",
          gameMode: "5v5",
          scheduledAt: "2026-07-10T18:00:00.000Z",
          durationMinutes: 90,
          maxPlayers: 10,
          attendeeCount: 2,
          isAttending: true,
          isRecurring: false,
          isFollowedCourt: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          runId: "run-1",
          id: "user-2",
          name: "Alex",
          photoUrl: "https://example.com/alex.jpg",
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "challenge-1",
          fromUserId: "user-1",
          toUserId: "user-2",
          courtId: "court-1",
          courtName: "Rossi Playground",
          scheduledAt: "2026-07-11T19:00:00.000Z",
          status: "accepted",
          matchId: "match-1",
          message: "First to 11",
          fromUserName: "Brett",
          toUserName: "Alex",
        },
      ]);

    const events = await service.getEvents({
      userId: "user-1",
      scope: "mine",
      start: new Date("2026-07-10T00:00:00.000Z"),
      end: new Date("2026-07-12T23:59:59.000Z"),
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      type: "run",
      isOwnedByMe: true,
      isConfirmedByMe: true,
      run: {
        runId: "run-1",
        attendeePreview: [{ id: "user-2", name: "Alex" }],
      },
    });
    expect(events[1]).toMatchObject({
      type: "scheduled_match",
      isOwnedByMe: true,
      isConfirmedByMe: true,
      scheduledMatch: {
        challengeId: "challenge-1",
        viewerRole: "creator",
        visibility: "participants_only",
      },
    });
  });

  it("expands weekly templates and prefers concrete occurrences", async () => {
    dataSource.query
      .mockResolvedValueOnce([
        {
          runId: "concrete-1",
          courtId: "court-1",
          courtName: "Rossi Playground",
          createdBy: "user-1",
          creatorName: "Brett",
          title: "Monday Run",
          gameMode: "3v3",
          scheduledAt: "2026-07-13T18:00:00.000Z",
          isRecurring: false,
          isFollowedCourt: false,
        },
        {
          runId: "template-1",
          courtId: "court-1",
          courtName: "Rossi Playground",
          createdBy: "user-1",
          creatorName: "Brett",
          title: "Monday Run",
          gameMode: "3v3",
          scheduledAt: "2026-07-06T18:00:00.000Z",
          isRecurring: true,
          recurrenceRule: "weekly",
          isFollowedCourt: false,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const events = await service.getEvents({
      userId: "viewer",
      scope: "for_you",
      start: new Date("2026-07-08T00:00:00.000Z"),
      end: new Date("2026-07-22T00:00:00.000Z"),
    });

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.scheduledAt)).toEqual([
      "2026-07-13T18:00:00.000Z",
      "2026-07-20T18:00:00.000Z",
    ]);
    expect(events[0].run.runId).toBe("concrete-1");
    expect(events[1].run.runId).toBe("template-1");
  });

  it("honors a weekly series anchor and inclusive recurrence end", async () => {
    dataSource.query
      .mockResolvedValueOnce([
        {
          runId: "template-1",
          courtId: "court-1",
          courtName: "Rossi Playground",
          createdBy: "user-1",
          creatorName: "Brett",
          title: "Monday Run",
          gameMode: "3v3",
          scheduledAt: "2026-07-13T18:00:00.000Z",
          isRecurring: true,
          recurrenceRule: "weekly;until=2026-07-20T23:59:59.999Z",
          isFollowedCourt: true,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const events = await service.getEvents({
      userId: "viewer",
      scope: "for_you",
      start: new Date("2026-07-01T00:00:00.000Z"),
      end: new Date("2026-07-27T23:59:59.000Z"),
    });

    expect(events.map((event) => event.scheduledAt)).toEqual([
      "2026-07-13T18:00:00.000Z",
      "2026-07-20T18:00:00.000Z",
    ]);
  });

  it("does not expand a bounded weekly series after it expires", async () => {
    dataSource.query
      .mockResolvedValueOnce([
        {
          runId: "template-1",
          courtId: "court-1",
          courtName: "Rossi Playground",
          createdBy: "user-1",
          title: "Expired Run",
          scheduledAt: "2026-06-01T18:00:00.000Z",
          isRecurring: true,
          recurrenceRule: "FREQ=WEEKLY;UNTIL=20260701T235959Z",
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const events = await service.getEvents({
      userId: "viewer",
      scope: "for_you",
      start: new Date("2026-07-08T00:00:00.000Z"),
      end: new Date("2026-07-22T00:00:00.000Z"),
    });

    expect(events).toEqual([]);
  });

  it("loads public and viewer-associated runs for For You", async () => {
    dataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.getEvents({
      userId: "viewer-1",
      scope: "for_you",
      start: new Date("2026-07-08T00:00:00.000Z"),
      end: new Date("2026-07-22T00:00:00.000Z"),
    });

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining(
        "LOWER(BTRIM(COALESCE(sr.visibility, 'public'))) = 'public'",
      ),
      ["2026-07-08T00:00:00.000Z", "2026-07-22T00:00:00.000Z", "viewer-1"],
    );
    const sql = dataSource.query.mock.calls[0][0];
    expect(sql).toContain("OR sr.created_by = $3");
    expect(sql).toContain("viewer_ra.user_id = $3");
    expect(sql).toContain("sr.invited_player_ids");
    expect(sql).toContain('"isAttending" DESC');
    expect(sql).toContain('"isFollowedCourt" DESC');
    expect(sql).toContain("LIKE 'weekly%'");
    expect(sql).toContain("LIKE 'FREQ=WEEKLY%'");
    expect(sql.indexOf('"isAttending" DESC')).toBeLessThan(
      sql.indexOf("LIMIT 1000"),
    );
  });

  it("prioritizes relevant and concrete rows before the SQLite query limit", async () => {
    delete process.env.DATABASE_URL;
    dataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.getEvents({
      userId: "viewer-1",
      scope: "for_you",
      start: new Date("2026-07-08T00:00:00.000Z"),
      end: new Date("2026-07-22T00:00:00.000Z"),
    });

    const sql = dataSource.query.mock.calls[0][0];
    expect(sql).toContain('"isAttending" DESC');
    expect(sql).toContain('"isFollowedCourt" DESC');
    expect(sql).toContain("COALESCE(sr.is_recurring, 0) ASC");
    expect(sql.indexOf('"isAttending" DESC')).toBeLessThan(
      sql.indexOf("LIMIT 1000"),
    );
  });

  it("maps published one-off court events into the calendar contract", async () => {
    dataSource.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          eventId: "event-1",
          courtId: "court-1",
          courtName: "Alameda Point Gymnasium",
          courtCity: "Alameda, CA",
          createdBy: "admin",
          eventType: "camp",
          title: "Intro to Basketball Camp",
          startsAt: "2026-07-13T16:00:00.000Z",
          endsAt: "2026-07-13T19:00:00.000Z",
          timezone: "America/Los_Angeles",
          isRecurring: false,
          organizerName: "City of Alameda",
          sourceUrl: "https://example.com/camp",
          ageRange: "5-12",
          confidence: "high",
          status: "published",
          isFollowedCourt: true,
        },
      ]);

    const events = await service.getEvents({
      userId: "viewer",
      scope: "for_you",
      start: new Date("2026-07-13T00:00:00.000Z"),
      end: new Date("2026-07-14T00:00:00.000Z"),
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "court_event",
      scheduledAt: "2026-07-13T16:00:00.000Z",
      court: { id: "court-1", name: "Alameda Point Gymnasium" },
      courtEvent: {
        eventId: "event-1",
        eventType: "camp",
        endsAt: "2026-07-13T19:00:00.000Z",
        ageRange: "5-12",
        sourceUrl: "https://example.com/camp",
      },
    });
    expect(dataSource.query.mock.calls[1][0]).toContain("FROM court_events ce");
  });

  it("expands recurring court events within their season and skips exceptions", async () => {
    dataSource.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          eventId: "event-1",
          courtId: "court-1",
          courtName: "Seasonal Gym",
          createdBy: "admin",
          eventType: "clinic",
          title: "Monday Clinic",
          startsAt: "2026-07-06T16:00:00.000Z",
          endsAt: "2026-07-06T19:00:00.000Z",
          timezone: "America/Los_Angeles",
          isRecurring: true,
          recurrenceRule: "weekly",
          seriesStartsOn: "2026-07-06",
          seriesEndsOn: "2026-07-27",
          exceptionDates: '["2026-07-20"]',
          status: "published",
        },
      ]);

    const events = await service.getEvents({
      userId: "viewer",
      scope: "for_you",
      start: new Date("2026-07-01T00:00:00.000Z"),
      end: new Date("2026-08-03T23:59:59.000Z"),
    });

    expect(events.map((event) => event.scheduledAt)).toEqual([
      "2026-07-06T16:00:00.000Z",
      "2026-07-13T16:00:00.000Z",
      "2026-07-27T16:00:00.000Z",
    ]);
    expect(events.every((event) => event.courtEvent.endsAt.endsWith("19:00:00.000Z"))).toBe(true);
  });
});
