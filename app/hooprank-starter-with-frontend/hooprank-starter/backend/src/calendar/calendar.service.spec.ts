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

  it("loads public and viewer-associated runs for For You", async () => {
    dataSource.query.mockResolvedValueOnce([]);

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
      [
        "2026-07-08T00:00:00.000Z",
        "2026-07-22T00:00:00.000Z",
        "viewer-1",
      ],
    );
    const sql = dataSource.query.mock.calls[0][0];
    expect(sql).toContain("OR sr.created_by = $3");
    expect(sql).toContain("viewer_ra.user_id = $3");
    expect(sql).toContain("sr.invited_player_ids");
  });
});
