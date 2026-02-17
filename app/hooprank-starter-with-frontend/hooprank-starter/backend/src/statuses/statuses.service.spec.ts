import { StatusesService } from './statuses.service';

/**
 * Unit tests for StatusesService.calculateFeedScore
 *
 * Since calculateFeedScore is a private method, we access it via (service as any)
 * to test the scoring logic in isolation. This is a pure function — no DB calls.
 */
describe('StatusesService', () => {
    let service: StatusesService;

    beforeEach(() => {
        // Create a minimal service instance — calculateFeedScore doesn't use any injected deps
        service = Object.create(StatusesService.prototype);
    });

    describe('calculateFeedScore', () => {
        const now = new Date('2026-02-16T12:00:00Z');
        const userId = 'user-1';
        const emptyPlayerSet = new Set<string>();
        const emptyCourtSet = new Set<string>();

        function makeItem(overrides: any = {}) {
            return {
                userId: 'other-user',
                courtId: 'court-1',
                createdAt: now.toISOString(), // Just created = max recency
                likeCount: 0,
                commentCount: 0,
                attendeeCount: 0,
                type: 'status',
                ...overrides,
            };
        }

        function score(item: any, followedPlayers = emptyPlayerSet, followedCourts = emptyCourtSet) {
            return (service as any).calculateFeedScore(item, userId, followedPlayers, followedCourts, now);
        }

        it('should give max recency score (100) for brand-new posts', () => {
            const item = makeItem();
            const s = score(item);
            // Brand new post with no engagement, no follows = recency only (100)
            expect(s).toBeCloseTo(100, 0);
        });

        it('should give zero recency for posts older than 7 days', () => {
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const item = makeItem({ createdAt: sevenDaysAgo.toISOString() });
            const s = score(item);
            // Recency = 0, no engagement, no follows
            expect(s).toBeCloseTo(0, 0);
        });

        it('should give ~50 recency for posts 3.5 days old', () => {
            const halfWeek = new Date(now.getTime() - 3.5 * 24 * 60 * 60 * 1000);
            const item = makeItem({ createdAt: halfWeek.toISOString() });
            const s = score(item);
            expect(s).toBeCloseTo(50, 0);
        });

        it('should add engagement score for likes, comments, attendees', () => {
            const baseScore = score(makeItem());
            const engagedScore = score(makeItem({ likeCount: 5, commentCount: 3, attendeeCount: 2 }));
            // Likes: 5*2=10, Comments: 3*3=9, Attendees: 2*5=10 → +29
            expect(engagedScore - baseScore).toBeCloseTo(29, 0);
        });

        it('should cap engagement scores at their maximums', () => {
            const maxEngagement = score(makeItem({ likeCount: 100, commentCount: 100, attendeeCount: 100 }));
            const baseScore = score(makeItem());
            // Max: likes=30, comments=45, attendees=75 → +150
            expect(maxEngagement - baseScore).toBeCloseTo(150, 0);
        });

        it('should boost own posts by 60', () => {
            const ownItem = makeItem({ userId });
            const otherItem = makeItem();
            expect(score(ownItem) - score(otherItem)).toBe(60);
        });

        it('should boost followed player posts by 50', () => {
            const followedPlayers = new Set(['other-user']);
            const item = makeItem();
            const boostedScore = score(item, followedPlayers);
            const normalScore = score(item);
            expect(boostedScore - normalScore).toBe(50);
        });

        it('should boost followed court posts by 40', () => {
            const followedCourts = new Set(['court-1']);
            const item = makeItem();
            const boostedScore = score(item, emptyPlayerSet, followedCourts);
            const normalScore = score(item);
            expect(boostedScore - normalScore).toBe(40);
        });

        it('should prioritize player follow over court follow', () => {
            const followedPlayers = new Set(['other-user']);
            const followedCourts = new Set(['court-1']);
            const item = makeItem();
            const bothScore = score(item, followedPlayers, followedCourts);
            const normalScore = score(item);
            // Player follow wins (50), not additive with court (40)
            expect(bothScore - normalScore).toBe(50);
        });

        it('should boost upcoming events within 48 hours', () => {
            const in6Hours = new Date(now.getTime() + 6 * 60 * 60 * 1000);
            const item = makeItem({ scheduledAt: in6Hours.toISOString() });
            const s = score(item);
            const normalScore = score(makeItem());
            // Event boost: 40 * (1 - 6/48) = 40 * 0.875 = 35
            expect(s - normalScore).toBeCloseTo(35, 0);
        });

        it('should give smaller boost for events 48-168 hours away', () => {
            const in72Hours = new Date(now.getTime() + 72 * 60 * 60 * 1000);
            const item = makeItem({ scheduledAt: in72Hours.toISOString() });
            const s = score(item);
            const normalScore = score(makeItem());
            expect(s - normalScore).toBe(15);
        });

        it('should not boost past events', () => {
            const pastEvent = new Date(now.getTime() - 2 * 60 * 60 * 1000);
            const item = makeItem({ scheduledAt: pastEvent.toISOString() });
            // Past event shouldn't get the event boost (hoursUntilEvent < 0)
            expect(score(item)).toBeCloseTo(score(makeItem()), 0);
        });

        it('should add 10 points for match content type', () => {
            const matchItem = makeItem({ type: 'match' });
            const statusItem = makeItem({ type: 'status' });
            expect(score(matchItem) - score(statusItem)).toBe(10);
        });

        it('should mark unfollowed content as discovery', () => {
            const item = makeItem();
            score(item); // Side effect: sets _isDiscovery
            expect(item._isDiscovery).toBe(true);
        });

        it('should not mark own posts as discovery', () => {
            const item = makeItem({ userId });
            score(item);
            expect(item._isDiscovery).toBe(false);
        });

        it('should not mark followed player posts as discovery', () => {
            const item = makeItem();
            const followedPlayers = new Set(['other-user']);
            score(item, followedPlayers);
            expect(item._isDiscovery).toBe(false);
        });
    });
});
