export class HoopRankService {
  private readonly SCALE_FACTOR = 1.0;
  private readonly MIN_RATING = 1.0;
  private readonly MAX_RATING = 5.0;

  /**
   * Dynamic K-Factor to incentivize new players.
   * High K means ratings change fast (fun/addictive initially).
   * Lower K means ratings stabilize (accurate utility).
   */
  getKFactor(matchesPlayed: number): number {
    if (matchesPlayed < 10) {
      return 0.20; // Placement matches: Huge swings
    } else if (matchesPlayed < 30) {
      return 0.10; // Early career: Moderate swings
    } else {
      return 0.05; // Established: Stable ratings
    }
  }

  /**
   * Calculates probability of A beating B.
   * Returns float between 0.0 and 1.0.
   */
  calculateExpectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / this.SCALE_FACTOR));
  }

  /**
   * Updates ratings for both players based on match outcome.
   * Returns the new rating for the player.
   */
  updateRating(currentRating: number, opponentRating: number, matchesPlayed: number, actualScore: number): number {
    // 1. Calculate Win Probability
    const expectedScore = this.calculateExpectedScore(currentRating, opponentRating);

    // 2. Get Dynamic K-Factor
    const k = this.getKFactor(matchesPlayed);

    // 3. Calculate Delta
    const delta = k * (actualScore - expectedScore);

    // 4. Update Rating
    let newRating = currentRating + delta;

    // 5. Clamp to limits
    newRating = Math.max(this.MIN_RATING, Math.min(this.MAX_RATING, newRating));

    // 6. Round to 2 decimal places
    return Math.round(newRating * 100) / 100;
  }
}
