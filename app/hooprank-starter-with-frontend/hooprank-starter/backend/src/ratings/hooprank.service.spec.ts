import { HoopRankService } from './hooprank.service';

describe('HoopRankService', () => {
    let service: HoopRankService;

    beforeEach(() => {
        service = new HoopRankService();
    });

    describe('getKFactor', () => {
        it('should return 0.20 for new players (< 10 games)', () => {
            expect(service.getKFactor(0)).toBe(0.20);
            expect(service.getKFactor(5)).toBe(0.20);
            expect(service.getKFactor(9)).toBe(0.20);
        });

        it('should return 0.10 for early career (10-29 games)', () => {
            expect(service.getKFactor(10)).toBe(0.10);
            expect(service.getKFactor(20)).toBe(0.10);
            expect(service.getKFactor(29)).toBe(0.10);
        });

        it('should return 0.05 for established players (30+ games)', () => {
            expect(service.getKFactor(30)).toBe(0.05);
            expect(service.getKFactor(100)).toBe(0.05);
        });
    });

    describe('calculateExpectedScore', () => {
        it('should return 0.5 for equal ratings', () => {
            const expected = service.calculateExpectedScore(3.0, 3.0);
            expect(expected).toBeCloseTo(0.5, 2);
        });

        it('should return > 0.5 when player A is higher rated', () => {
            const expected = service.calculateExpectedScore(4.0, 3.0);
            expect(expected).toBeGreaterThan(0.5);
        });

        it('should return < 0.5 when player A is lower rated', () => {
            const expected = service.calculateExpectedScore(2.0, 3.0);
            expect(expected).toBeLessThan(0.5);
        });
    });

    describe('updateRating', () => {
        it('should increase rating when winning', () => {
            const newRating = service.updateRating(3.0, 3.0, 0, 1); // Win
            expect(newRating).toBeGreaterThan(3.0);
        });

        it('should decrease rating when losing', () => {
            const newRating = service.updateRating(3.0, 3.0, 0, 0); // Loss
            expect(newRating).toBeLessThan(3.0);
        });

        it('should increase more for upset wins (underdog beats favorite)', () => {
            const underdogWin = service.updateRating(2.0, 4.0, 0, 1);
            const favoriteWin = service.updateRating(4.0, 2.0, 0, 1);

            // Underdog beating favorite should gain more than favorite beating underdog
            const underdogGain = underdogWin - 2.0;
            const favoriteGain = favoriteWin - 4.0;
            expect(underdogGain).toBeGreaterThan(favoriteGain);
        });

        it('should never go below MIN_RATING (1.0)', () => {
            const newRating = service.updateRating(1.0, 5.0, 0, 0);
            expect(newRating).toBeGreaterThanOrEqual(1.0);
        });

        it('should never go above MAX_RATING (5.0)', () => {
            const newRating = service.updateRating(5.0, 1.0, 0, 1);
            expect(newRating).toBeLessThanOrEqual(5.0);
        });

        it('should round to 2 decimal places', () => {
            const newRating = service.updateRating(3.0, 3.0, 0, 1);
            const decimalPlaces = (newRating.toString().split('.')[1] || '').length;
            expect(decimalPlaces).toBeLessThanOrEqual(2);
        });

        it('should change less for established players (high games played)', () => {
            const newPlayerChange = Math.abs(service.updateRating(3.0, 3.0, 0, 1) - 3.0);
            const veteranChange = Math.abs(service.updateRating(3.0, 3.0, 50, 1) - 3.0);
            expect(newPlayerChange).toBeGreaterThan(veteranChange);
        });
    });
});
