import { MapHubService } from "./map-hub.service";

describe("MapHubService normalization", () => {
  let service: MapHubService;

  beforeEach(() => {
    service = new MapHubService({
      options: { type: "postgres" },
      query: jest.fn(),
    } as any);
  });

  it("keeps New to HoopRank as the default status for new players", () => {
    const player = (service as any).normalizePlayer(
      {
        id: "player-1",
        name: "New Player",
        acceptingChallenges: true,
        gamesPlayed: 0,
        lat: "37.78",
        lng: "-122.42",
      },
      "player-1",
    );

    expect(player.isNewPlayer).toBe(true);
    expect(player.acceptingChallenges).toBe(true);
    expect(player.statusLabel).toBe("New to HoopRank");
    expect(player.isCurrentUser).toBe(true);
  });

  it("marks non-new challenge-ready players as accepting challenges", () => {
    const player = (service as any).normalizePlayer(
      {
        id: "player-2",
        name: "Maya Buckets",
        acceptingChallenges: true,
        gamesPlayed: 12,
        lat: 37.78,
        lng: -122.42,
      },
      "player-1",
    );

    expect(player.isNewPlayer).toBe(false);
    expect(player.acceptingChallenges).toBe(true);
    expect(player.statusLabel).toBe("Accepting challenges");
  });

  it("prioritizes checked-in court status over generic player availability", () => {
    const player = (service as any).normalizePlayer(
      {
        id: "player-3",
        name: "At Court",
        acceptingChallenges: true,
        gamesPlayed: 8,
        checkedInCourtName: "Blacktop Park",
        lat: 37.78,
        lng: -122.42,
      },
      "player-1",
    );

    expect(player.statusLabel).toBe("At Blacktop Park");
  });

  it("normalizes active and scheduled court statuses", () => {
    const activeCourt = (service as any).normalizeCourt({
      id: "court-1",
      name: "Blacktop Park",
      lat: "37.78",
      lng: "-122.42",
      activeCheckInCount: "2",
      followerCount: "9",
    });
    const scheduledCourt = (service as any).normalizeCourt({
      id: "court-2",
      name: "Rec Center",
      lat: 37.79,
      lng: -122.43,
      activeCheckInCount: 0,
      nextRun: { id: "run-1", gameMode: "5v5" },
    });

    expect(activeCourt.statusLabel).toBe("2 players here");
    expect(activeCourt.hasUpcomingActivity).toBe(true);
    expect(scheduledCourt.statusLabel).toBe("5v5 scheduled");
    expect(scheduledCourt.hasUpcomingRun).toBe(true);
    expect(scheduledCourt.hasUpcomingActivity).toBe(true);
  });
});
