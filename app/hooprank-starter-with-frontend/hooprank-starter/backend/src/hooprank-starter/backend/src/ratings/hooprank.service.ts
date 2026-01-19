export class HoopRankService {
  // Maps an internal expectation model into a 1.0–5.0 rating, step = 0.1.
  // Implements R' = R + 0.15 * (result - expected), clamped to [1.0, 5.0].
  expectedScore(player: number, opp: number): number {
    const denom = 1 + Math.pow(10, (opp - player) / 0.6);
    return 1 / denom;
  }

  updateRating(r: number, opp: number, didWin: boolean): number {
    const expected = this.expectedScore(r, opp);
    const result = didWin ? 1 : 0;
    let next = r + 0.15 * (result - expected);
    next = Math.max(1.0, Math.min(5.0, next));
    next = Math.round(next * 10) / 10;
    return next;
  }
}
