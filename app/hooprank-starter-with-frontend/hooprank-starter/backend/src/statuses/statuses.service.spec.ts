import { StatusesService } from "./statuses.service";

/**
 * Unit tests for StatusesService.calculateFeedScore
 *
 * Since calculateFeedScore is a private method, we access it via (service as any)
 * to test the scoring logic in isolation. This is a pure function — no DB calls.
 */
describe("StatusesService", () => {
  let service: StatusesService;

  beforeEach(() => {
    // Create a minimal service instance — calculateFeedScore doesn't use any injected deps
    service = Object.create(StatusesService.prototype);
  });

  describe("calculateFeedScore", () => {
    const now = new Date("2026-02-16T12:00:00Z");
    const userId = "user-1";
    const emptyPlayerSet = new Set<string>();
    const emptyCourtSet = new Set<string>();

    function makeItem(overrides: any = {}) {
      return {
        userId: "other-user",
        courtId: "court-1",
        createdAt: now.toISOString(), // Just created = max recency
        likeCount: 0,
        commentCount: 0,
        attendeeCount: 0,
        type: "status",
        ...overrides,
      };
    }

    function score(
      item: any,
      followedPlayers = emptyPlayerSet,
      followedCourts = emptyCourtSet,
    ) {
      return (service as any).calculateFeedScore(
        item,
        userId,
        followedPlayers,
        followedCourts,
        now,
      );
    }

    it("should give max recency score (100) for brand-new posts", () => {
      const item = makeItem();
      const s = score(item);
      // Brand new post with no engagement, no follows = recency only (100)
      expect(s).toBeCloseTo(100, 0);
    });

    it("should give zero recency for posts older than 7 days", () => {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const item = makeItem({ createdAt: sevenDaysAgo.toISOString() });
      const s = score(item);
      // Recency = 0, no engagement, no follows
      expect(s).toBeCloseTo(0, 0);
    });

    it("should give ~50 recency for posts 3.5 days old", () => {
      const halfWeek = new Date(now.getTime() - 3.5 * 24 * 60 * 60 * 1000);
      const item = makeItem({ createdAt: halfWeek.toISOString() });
      const s = score(item);
      expect(s).toBeCloseTo(50, 0);
    });

    it("should add engagement score for likes, comments, attendees", () => {
      const baseScore = score(makeItem());
      const engagedScore = score(
        makeItem({ likeCount: 5, commentCount: 3, attendeeCount: 2 }),
      );
      // Likes: 5*2=10, Comments: 3*3=9, Attendees: 2*5=10 → +29
      expect(engagedScore - baseScore).toBeCloseTo(29, 0);
    });

    it("should cap engagement scores at their maximums", () => {
      const maxEngagement = score(
        makeItem({ likeCount: 100, commentCount: 100, attendeeCount: 100 }),
      );
      const baseScore = score(makeItem());
      // Max: likes=30, comments=45, attendees=75 → +150
      expect(maxEngagement - baseScore).toBeCloseTo(150, 0);
    });

    it("should boost own posts by 60", () => {
      const ownItem = makeItem({ userId });
      const otherItem = makeItem();
      expect(score(ownItem) - score(otherItem)).toBe(60);
    });

    it("should boost followed player posts by 50", () => {
      const followedPlayers = new Set(["other-user"]);
      const item = makeItem();
      const boostedScore = score(item, followedPlayers);
      const normalScore = score(item);
      expect(boostedScore - normalScore).toBe(50);
    });

    it("should boost followed court posts by 40", () => {
      const followedCourts = new Set(["court-1"]);
      const item = makeItem();
      const boostedScore = score(item, emptyPlayerSet, followedCourts);
      const normalScore = score(item);
      expect(boostedScore - normalScore).toBe(40);
    });

    it("should prioritize player follow over court follow", () => {
      const followedPlayers = new Set(["other-user"]);
      const followedCourts = new Set(["court-1"]);
      const item = makeItem();
      const bothScore = score(item, followedPlayers, followedCourts);
      const normalScore = score(item);
      // Player follow wins (50), not additive with court (40)
      expect(bothScore - normalScore).toBe(50);
    });

    it("should boost upcoming events within 48 hours", () => {
      const in6Hours = new Date(now.getTime() + 6 * 60 * 60 * 1000);
      const item = makeItem({ scheduledAt: in6Hours.toISOString() });
      const s = score(item);
      const normalScore = score(makeItem());
      // Event boost: 40 * (1 - 6/48) = 40 * 0.875 = 35
      expect(s - normalScore).toBeCloseTo(35, 0);
    });

    it("should give smaller boost for events 48-168 hours away", () => {
      const in72Hours = new Date(now.getTime() + 72 * 60 * 60 * 1000);
      const item = makeItem({ scheduledAt: in72Hours.toISOString() });
      const s = score(item);
      const normalScore = score(makeItem());
      expect(s - normalScore).toBe(15);
    });

    it("should not boost past events", () => {
      const pastEvent = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const item = makeItem({ scheduledAt: pastEvent.toISOString() });
      // Past event shouldn't get the event boost (hoursUntilEvent < 0)
      expect(score(item)).toBeCloseTo(score(makeItem()), 0);
    });

    it("should add 10 points for match content type", () => {
      const matchItem = makeItem({ type: "match" });
      const statusItem = makeItem({ type: "status" });
      expect(score(matchItem) - score(statusItem)).toBe(10);
    });

    it("should mark unfollowed content as discovery", () => {
      const item = makeItem();
      score(item); // Side effect: sets _isDiscovery
      expect(item._isDiscovery).toBe(true);
    });

    it("should not mark own posts as discovery", () => {
      const item = makeItem({ userId });
      score(item);
      expect(item._isDiscovery).toBe(false);
    });

    it("should not mark followed player posts as discovery", () => {
      const item = makeItem();
      const followedPlayers = new Set(["other-user"]);
      score(item, followedPlayers);
      expect(item._isDiscovery).toBe(false);
    });
  });

  describe("feed dedupe and radius guards", () => {
    const userId = "user-1";
    const emptyPlayerSet = new Set<string>();
    const emptyCourtSet = new Set<string>();

    function makeScheduledItem(overrides: any = {}) {
      return {
        id: "status-1",
        userId: "other-user",
        courtId: "court-1",
        courtName: "Albert J. Boro Community Center",
        courtLat: 38.0,
        courtLng: -122.0,
        scheduledAt: "2026-03-06T18:30:00.000Z",
        content: "Evening Drop-In — Boro CC (Pickleweed)",
        gameMode: "5v5",
        courtType: "full",
        ageRange: "16+",
        isAttendingByMe: false,
        ...overrides,
      };
    }

    it("filters out non-followed scheduled runs beyond the 50 mile discovery cap", () => {
      const farRun = makeScheduledItem({
        courtLat: 37.0,
        courtLng: -122.0,
      });

      const filtered = (service as any).filterScheduledRunsByRadius(
        [farRun],
        userId,
        emptyPlayerSet,
        emptyCourtSet,
        37.7749,
        -122.4194,
      );

      expect(filtered).toEqual([]);
    });

    it("keeps out-of-radius scheduled runs from followed courts", () => {
      const farRun = makeScheduledItem({
        courtLat: 37.0,
        courtLng: -122.0,
      });

      const filtered = (service as any).filterScheduledRunsByRadius(
        [farRun],
        userId,
        emptyPlayerSet,
        new Set(["court-1"]),
        37.7749,
        -122.4194,
      );

      expect(filtered).toHaveLength(1);
    });

    it("drops out-of-radius scheduled runs in strict tier mode even when the court is followed", () => {
      const farRun = makeScheduledItem({
        courtLat: 37.0,
        courtLng: -122.0,
      });

      const filtered = (service as any).filterScheduledRunsByRadius(
        [farRun],
        userId,
        emptyPlayerSet,
        new Set(["court-1"]),
        37.7749,
        -122.4194,
        10,
        false,
      );

      expect(filtered).toEqual([]);
    });

    it("hides recurring template statuses until a visible occurrence exists", () => {
      const filtered = (service as any).filterVisibleScheduledRunItems(
        [
          makeScheduledItem({
            hasLinkedScheduledRun: true,
            hasVisibleScheduledOccurrence: false,
          }),
        ],
        userId,
        emptyPlayerSet,
        emptyCourtSet,
        new Date("2026-03-06T06:30:00.000Z"),
      );

      expect(filtered).toEqual([]);
    });

    it("hides linked scheduled run statuses without a visible occurrence even when scheduledAt is missing", () => {
      const filtered = (service as any).filterVisibleScheduledRunItems(
        [
          makeScheduledItem({
            scheduledAt: null,
            hasLinkedScheduledRun: true,
            hasVisibleScheduledOccurrence: false,
          }),
        ],
        userId,
        emptyPlayerSet,
        emptyCourtSet,
        new Date("2026-03-06T06:30:00.000Z"),
      );

      expect(filtered).toEqual([]);
    });

    it("keeps scheduled run posts when a concrete occurrence is visible in the 48 hour window", () => {
      const filtered = (service as any).filterVisibleScheduledRunItems(
        [
          makeScheduledItem({
            hasLinkedScheduledRun: true,
            hasVisibleScheduledOccurrence: true,
          }),
        ],
        userId,
        emptyPlayerSet,
        emptyCourtSet,
        new Date("2026-03-06T06:30:00.000Z"),
      );

      expect(filtered).toHaveLength(1);
    });

    it("dedupes scheduled runs by venue and scheduled minute even when ids and content differ", () => {
      const items = [
        makeScheduledItem({ id: "status-1" }),
        makeScheduledItem({
          id: "status-2",
          content: "Different title, same slot",
          gameMode: "3v3",
          ageRange: "open",
        }),
      ];

      const deduped = (service as any).dedupeFeedItems(items);

      expect(deduped).toHaveLength(1);
      expect(deduped[0].id).toBe("status-1");
    });

    it("keeps distinct feed items when different types share the same raw id", () => {
      const items = [
        { id: "42", type: "status", createdAt: "2026-03-06T10:00:00.000Z" },
        { id: "42", type: "checkin", createdAt: "2026-03-06T10:05:00.000Z" },
      ];

      const deduped = (service as any).dedupeFeedItems(items);

      expect(deduped).toHaveLength(2);
    });

    it("selects the first radius tier that has local activity", () => {
      const localItems = [
        {
          id: "status-1",
          type: "status",
          activityLat: 37.95,
          activityLng: -122.29,
        },
      ];

      const selectedRadius = (service as any).selectForYouRadiusMiles(
        localItems,
        37.7749,
        -122.4194,
      );

      expect(selectedRadius).toBe(25);
    });
  });

  describe("getUnifiedFeed", () => {
    it("projects match names from live users rows (winner/loser) for feed cards", async () => {
      const mockDataSource: any = {
        options: { type: "postgres" },
        query: jest.fn().mockResolvedValue([]),
      };

      const fullService = new StatusesService(
        mockDataSource,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      const result = await fullService.getUnifiedFeed(
        "user-1",
        "following",
        10,
      );
      expect(Array.isArray(result)).toBe(true);

      const executedQueries = mockDataSource.query.mock.calls
        .map((call: any[]) => call[0])
        .filter((q: unknown) => typeof q === "string") as string[];
      const combinedSql = executedQueries.join("\n");

      expect(combinedSql).toContain('winner.name as "winnerName"');
      expect(combinedSql).toContain('loser.name as "loserName"');
      expect(combinedSql).toContain(
        "COALESCE(winner.name, 'Player') || ' vs ' || COALESCE(loser.name, 'Opponent') as content",
      );
    });

    it("queries check-ins as part of the unified feed contract without the legacy suggested-matchup query", async () => {
      const mockDataSource: any = {
        options: { type: "postgres" },
        query: jest.fn().mockImplementation((sql: string) => {
          return Promise.resolve([]);
        }),
      };

      const fullService = new StatusesService(
        mockDataSource,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      await fullService.getUnifiedFeed(
        "user-1",
        "foryou",
        10,
        37.7749,
        -122.4194,
      );

      const executedQueries = mockDataSource.query.mock.calls
        .map((call: any[]) => call[0])
        .filter((q: unknown) => typeof q === "string") as string[];
      const combinedSql = executedQueries.join("\n");

      expect(combinedSql).toContain("FROM check_ins ci");
      expect(combinedSql).not.toContain("WITH my_followed_courts AS");
    });

    it("does not return legacy suggested matchup items even when the feed has other content", async () => {
      const mockDataSource: any = {
        options: { type: "postgres" },
        query: jest.fn().mockImplementation((sql: string) => {
          if (sql.includes("SELECT followed_id FROM user_followed_players")) {
            return Promise.resolve([]);
          }
          if (sql.includes("SELECT court_id FROM user_followed_courts")) {
            return Promise.resolve([]);
          }
          if (
            sql.includes("FROM check_ins ci") &&
            sql.includes("ci.checked_out_at IS NULL")
          ) {
            return Promise.resolve([
              {
                id: "check-1",
                type: "checkin",
                createdAt: "2026-03-01T00:00:00.000Z",
                userId: "user-2",
                userName: "Tight Match",
                userPhotoUrl: null,
                content: "Tight Match checked in at Mission Court",
                courtId: "court-7",
                courtName: "Mission Court",
                courtLat: 37.784,
                courtLng: -122.408,
                activityLat: 37.784,
                activityLng: -122.408,
                gameMode: null,
                courtType: null,
                ageRange: null,
                matchStatus: null,
                matchScore: null,
                winnerName: null,
                loserName: null,
                winnerRating: null,
                loserRating: null,
                winnerOldRating: null,
                loserOldRating: null,
                likeCount: 0,
                commentCount: 0,
                isLikedByMe: false,
                attendeeCount: 0,
                isAttendingByMe: false,
                hasLinkedScheduledRun: false,
                hasVisibleScheduledOccurrence: false,
                scheduledAt: null,
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      };

      const fullService = new StatusesService(
        mockDataSource,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      const result = await fullService.getUnifiedFeed(
        "user-1",
        "foryou",
        10,
        37.7749,
        -122.4194,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "checkin",
        userId: "user-2",
        userName: "Tight Match",
        courtId: "court-7",
        courtName: "Mission Court",
      });
      expect(
        result.some((item: any) => item.type === "suggested_matchup"),
      ).toBe(false);

      const executedQueries = mockDataSource.query.mock.calls
        .map((call: any[]) => call[0])
        .filter((q: unknown) => typeof q === "string") as string[];
      const combinedSql = executedQueries.join("\n");
      expect(combinedSql).not.toContain("WITH my_followed_courts AS");
    });

    it("keeps the selected For You radius from leaking farther scheduled runs back in via followed items", async () => {
      const now = new Date();
      const soon = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
      const createdAt = now.toISOString();

      const mockDataSource: any = {
        options: { type: "postgres" },
        query: jest.fn().mockImplementation((sql: string) => {
          if (sql.includes("SELECT followed_id FROM user_followed_players")) {
            return Promise.resolve([]);
          }
          if (
            sql.includes(
              "SELECT court_id FROM user_followed_courts WHERE user_id::TEXT = $1",
            )
          ) {
            return Promise.resolve([{ court_id: "court-far" }]);
          }
          if (
            sql.includes("SELECT id::TEXT as id, name, hoop_rank as rating")
          ) {
            return Promise.resolve([]);
          }
          if (
            sql.includes("FROM check_ins ci") &&
            sql.includes("ST_DWithin(c.geog")
          ) {
            return Promise.resolve([
              {
                id: "check-1",
                type: "checkin",
                createdAt,
                userId: "user-2",
                userName: "Near Player",
                userPhotoUrl: null,
                content: "Near Player checked in",
                courtId: "court-near",
                courtName: "Near Court",
                activityLat: 37.779,
                activityLng: -122.418,
                courtLat: 37.779,
                courtLng: -122.418,
                likeCount: 0,
                commentCount: 0,
                attendeeCount: 0,
                isLikedByMe: false,
                isAttendingByMe: false,
              },
            ]);
          }
          if (
            sql.includes("FROM player_statuses ps") &&
            sql.includes("ps.user_id = $1")
          ) {
            return Promise.resolve([
              {
                id: "status-far-run",
                type: "status",
                statusId: 101,
                createdAt,
                userId: "user-9",
                userName: "Far Player",
                userPhotoUrl: null,
                content: "Far run",
                courtId: "court-far",
                courtName: "Far Court",
                activityLat: 38.12,
                activityLng: -122.18,
                courtLat: 38.12,
                courtLng: -122.18,
                scheduledAt: soon,
                hasLinkedScheduledRun: true,
                hasVisibleScheduledOccurrence: true,
                likeCount: 0,
                commentCount: 0,
                attendeeCount: 0,
                isLikedByMe: false,
                isAttendingByMe: false,
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      };

      const fullService = new StatusesService(
        mockDataSource,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      const result = await fullService.getUnifiedFeed(
        "user-1",
        "foryou",
        10,
        37.7749,
        -122.4194,
      );

      expect(result.some((item: any) => item.id === "status-far-run")).toBe(
        false,
      );
      expect(result.some((item: any) => item.id === "check-1")).toBe(true);
    });

    it("does not pull followed activity into For You when it falls outside the selected local radius", async () => {
      const now = new Date();
      const createdAt = now.toISOString();

      const mockDataSource: any = {
        options: { type: "postgres" },
        query: jest.fn().mockImplementation((sql: string) => {
          if (sql.includes("SELECT followed_id FROM user_followed_players")) {
            return Promise.resolve([{ followed_id: "user-far" }]);
          }
          if (
            sql.includes(
              "SELECT court_id FROM user_followed_courts WHERE user_id::TEXT = $1",
            )
          ) {
            return Promise.resolve([]);
          }
          if (
            sql.includes("SELECT id::TEXT as id, name, hoop_rank as rating")
          ) {
            return Promise.resolve([]);
          }
          if (
            sql.includes("FROM check_ins ci") &&
            sql.includes("ST_DWithin(c.geog")
          ) {
            return Promise.resolve([
              {
                id: "check-1",
                type: "checkin",
                createdAt,
                userId: "user-near",
                userName: "Near Player",
                userPhotoUrl: null,
                content: "Near Player checked in",
                courtId: "court-near",
                courtName: "Near Court",
                activityLat: 37.779,
                activityLng: -122.418,
                courtLat: 37.779,
                courtLng: -122.418,
                likeCount: 0,
                commentCount: 0,
                attendeeCount: 0,
                isLikedByMe: false,
                isAttendingByMe: false,
              },
            ]);
          }
          if (
            sql.includes("FROM player_statuses ps") &&
            sql.includes("ps.user_id = $1")
          ) {
            return Promise.resolve([
              {
                id: "status-far-followed",
                type: "status",
                statusId: 111,
                createdAt,
                userId: "user-far",
                userName: "Far Followed Player",
                userPhotoUrl: null,
                content: "Far away post",
                courtId: "court-far",
                courtName: "Far Court",
                activityLat: 38.12,
                activityLng: -122.18,
                courtLat: 38.12,
                courtLng: -122.18,
                likeCount: 0,
                commentCount: 0,
                attendeeCount: 0,
                isLikedByMe: false,
                isAttendingByMe: false,
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      };

      const fullService = new StatusesService(
        mockDataSource,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      const result = await fullService.getUnifiedFeed(
        "user-1",
        "foryou",
        10,
        37.7749,
        -122.4194,
      );

      expect(
        result.some((item: any) => item.id === "status-far-followed"),
      ).toBe(false);
      expect(result.some((item: any) => item.id === "check-1")).toBe(true);
    });
  });
});
