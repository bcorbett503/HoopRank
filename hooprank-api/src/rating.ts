import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Load rating config safely in ESM (BOM tolerant; shows parse errors) */
function loadCfg(): any {
  const candidates = [
    path.resolve(__dirname, "../config/rating-config.json"),
    path.resolve(process.cwd(), "config", "rating-config.json"),
    "/app/config/rating-config.json"
  ];
  const errors: string[] = [];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      let txt = fs.readFileSync(p);
      let s = txt.toString("utf8");
      if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
      return JSON.parse(s);
    } catch (e: any) {
      errors.push(`${p}: ${e?.message || String(e)}`);
    }
  }
  const detail = errors.length ? ` Tried: ${errors.join(" | ")}` : "";
  throw new Error("rating-config.json not found or invalid." + detail);
}
const cfg: any = loadCfg();

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const round2 = (x: number) => Math.round(x * 100) / 100;

/** Count games between two players in the last 7 days */
async function countGamesThisWeek(pool: any, a: string, b: string) {
  const q = `
    SELECT count(*) as cnt
    FROM matches
    WHERE result IS NOT NULL 
      AND coalesce((result->>'finalized')::boolean, false) = true
      AND ((creator_id=$1 AND opponent_id=$2) OR (creator_id=$2 AND opponent_id=$1))
      AND updated_at > now() - interval '7 days'
  `;
  const { rows: [r] } = await pool.query(q, [a, b]);
  return Number(r?.cnt || 0);
}

/** Check if these two players have ever played before */
async function hasNeverPlayed(pool: any, a: string, b: string) {
  const q = `
    SELECT 1 FROM matches
    WHERE result IS NOT NULL
      AND ((creator_id=$1 AND opponent_id=$2) OR (creator_id=$2 AND opponent_id=$1))
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [a, b]);
  return rows.length === 0;
}

/** Check if this is the user's first game today */
async function isFirstGameToday(pool: any, uid: string) {
  const q = `
    SELECT 1 FROM matches
    WHERE result IS NOT NULL 
      AND coalesce((result->>'finalized')::boolean, false) = true
      AND (creator_id=$1 OR opponent_id=$1)
      AND date_trunc('day', updated_at) = date_trunc('day', now())
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [uid]);
  return rows.length === 0;
}

/** Get or initialize a user's streak data */
async function getStreakData(pool: any, uid: string) {
  const r = await pool.query("SELECT * FROM user_ratings WHERE user_id=$1", [uid]);
  if (r.rows.length) return r.rows[0];
  await pool.query(
    "INSERT INTO user_ratings (user_id, mmr, streak_days, last_active_day) VALUES ($1, $2, 0, null) ON CONFLICT (user_id) DO NOTHING",
    [uid, 1300] // MMR unused in simple system but kept for compatibility
  );
  return (await pool.query("SELECT * FROM user_ratings WHERE user_id=$1", [uid])).rows[0];
}

/** Get user's current rating from users table */
async function getCurrentRating(pool: any, uid: string): Promise<number> {
  const { rows } = await pool.query("SELECT hoop_rank FROM users WHERE id=$1", [uid]);
  return rows.length > 0 ? Number(rows[0].hoop_rank || cfg.simpleRank.startRating) : cfg.simpleRank.startRating;
}

export async function getUserRating(pool: any, uid: string) {
  const rating = await getCurrentRating(pool, uid);
  const streak = await getStreakData(pool, uid);
  return {
    userId: uid,
    hoopRank: rating,
    streakDays: streak?.streak_days || 0,
    lastActiveDay: streak?.last_active_day
  };
}

export async function getUserRankHistory(pool: any, uid: string, range: string) {
  let where = '';
  if (range === '1w') where = "AND created_at > now() - interval '7 days'";
  else if (range === '1m') where = "AND created_at > now() - interval '30 days'";
  else if (range === '1y') where = "AND created_at > now() - interval '365 days'";
  const q = `SELECT created_at, hoop_rank FROM rank_history WHERE user_id=$1 ${where} ORDER BY created_at ASC LIMIT 500`;
  const { rows } = await pool.query(q, [uid]);
  return rows;
}

/**
 * SIMPLIFIED ENGAGEMENT RANKING ALGORITHM
 * 
 * Core mechanics:
 * 1. Base change: ±0.05 to ±0.15 based on opponent strength
 * 2. New opponent bonus: 1.5x for never played, 1.2x for first this week
 * 3. Diminishing returns: 0.5x → 0.25x → 0.1x for repeat games
 * 4. Activity bonus: +0.02 for first game today, +0.01 per streak day
 */
export async function finalizeAndRateMatch(pool: any, matchId: string, provisional: boolean = false) {
  console.log(`[RATING] Starting simplified rating for match ${matchId}`);

  const { rows: [m] } = await pool.query("SELECT * FROM matches WHERE id=$1", [matchId]);
  if (!provisional && (!m || !m.result || !m.result.finalized)) {
    return { applied: false, reason: "not_finalized" };
  }
  if (!m || !m.result) {
    return { applied: false, reason: "no_result" };
  }

  const a = m.creator_id, b = m.opponent_id;
  if (!a || !b) return { applied: false, reason: "no_opponent" };

  const sa = Number(m.score?.[a] ?? 0);
  const sb = Number(m.score?.[b] ?? 0);
  if (!Number.isFinite(sa) || !Number.isFinite(sb) || sa === sb) {
    return { applied: false, reason: "tie_or_bad_score" };
  }

  const winner = sa > sb ? a : b;
  const loser = winner === a ? b : a;

  // Get current ratings
  const ratingA = await getCurrentRating(pool, a);
  const ratingB = await getCurrentRating(pool, b);
  console.log(`[RATING] Current: ${a.substring(0, 8)}=${ratingA}, ${b.substring(0, 8)}=${ratingB}`);

  // === STEP 1: Base rating change ===
  const ratingDiff = ratingA - ratingB;
  const threshold = cfg.simpleRank.ratingDiffThreshold;
  const baseWin = cfg.simpleRank.baseWin;
  const upsetBonus = cfg.simpleRank.upsetBonus;

  let winnerGain: number, loserLoss: number;

  if (winner === a) {
    // A won
    if (ratingDiff < -threshold) {
      // Upset: A (lower) beat B (higher)
      winnerGain = baseWin + upsetBonus;
      loserLoss = baseWin - upsetBonus;
    } else if (ratingDiff > threshold) {
      // Favorite won: A (higher) beat B (lower)
      winnerGain = baseWin - upsetBonus;
      loserLoss = baseWin + upsetBonus;
    } else {
      // Equal match
      winnerGain = baseWin;
      loserLoss = baseWin;
    }
  } else {
    // B won
    if (ratingDiff > threshold) {
      // Upset: B (lower) beat A (higher)
      winnerGain = baseWin + upsetBonus;
      loserLoss = baseWin - upsetBonus;
    } else if (ratingDiff < -threshold) {
      // Favorite won: B (higher) beat A (lower)
      winnerGain = baseWin - upsetBonus;
      loserLoss = baseWin + upsetBonus;
    } else {
      // Equal match
      winnerGain = baseWin;
      loserLoss = baseWin;
    }
  }

  // === STEP 2: New opponent multiplier ===
  const neverPlayed = await hasNeverPlayed(pool, a, b);
  const gamesThisWeek = await countGamesThisWeek(pool, a, b);

  let diversityMult = 1.0;
  if (neverPlayed) {
    diversityMult = cfg.newOpponent.neverPlayedMult;
  } else if (gamesThisWeek === 0) {
    diversityMult = cfg.newOpponent.firstTimeThisWeekMult;
  } else {
    const schedule = cfg.newOpponent.schedule;
    const idx = Math.min(gamesThisWeek, schedule.length - 1);
    diversityMult = schedule[idx];
  }
  console.log(`[RATING] Diversity: neverPlayed=${neverPlayed}, gamesThisWeek=${gamesThisWeek}, mult=${diversityMult}`);

  // Apply diversity multiplier
  winnerGain *= diversityMult;
  loserLoss *= diversityMult;

  // === STEP 3: Activity bonuses ===
  const winnerFirstToday = await isFirstGameToday(pool, winner);
  const loserFirstToday = await isFirstGameToday(pool, loser);

  let winnerActivityBonus = 0;
  let loserActivityBonus = 0;

  if (winnerFirstToday) {
    winnerActivityBonus += cfg.activity.firstGameTodayBonus;
  }
  // Note: loser doesn't get first-game bonus added to their change, just tracked for streaks

  // === STEP 4: Calculate new ratings ===
  let newWinnerRating = (winner === a ? ratingA : ratingB) + winnerGain + winnerActivityBonus;
  let newLoserRating = (loser === a ? ratingA : ratingB) - loserLoss;

  // Clamp to floor/ceiling
  newWinnerRating = clamp(round2(newWinnerRating), cfg.simpleRank.floor, cfg.simpleRank.ceiling);
  newLoserRating = clamp(round2(newLoserRating), cfg.simpleRank.floor, cfg.simpleRank.ceiling);

  console.log(`[RATING] Changes: winner=${winner.substring(0, 8)} +${(winnerGain + winnerActivityBonus).toFixed(2)} → ${newWinnerRating}`);
  console.log(`[RATING] Changes: loser=${loser.substring(0, 8)} -${loserLoss.toFixed(2)} → ${newLoserRating}`);

  // === STEP 5: Update streak tracking ===
  const updateStreak = async (uid: string, isFirst: boolean) => {
    const existing = await getStreakData(pool, uid);
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const prevDay = existing?.last_active_day ? new Date(existing.last_active_day).toISOString().slice(0, 10) : "";

    let newStreak = 1;
    if (prevDay === yesterday) {
      newStreak = Math.min((existing?.streak_days || 0) + 1, cfg.activity.maxStreakDays);
    } else if (prevDay === today) {
      newStreak = existing?.streak_days || 1;
    }

    await pool.query(`
      INSERT INTO user_ratings (user_id, mmr, streak_days, last_active_day)
      VALUES ($1, 1300, $2, current_date)
      ON CONFLICT (user_id) DO UPDATE SET streak_days = $2, last_active_day = current_date
    `, [uid, newStreak]);

    return newStreak;
  };

  const winnerStreak = await updateStreak(winner, winnerFirstToday);
  const loserStreak = await updateStreak(loser, loserFirstToday);

  // === STEP 6: Update users table ===
  await pool.query("UPDATE users SET hoop_rank = $2 WHERE id = $1", [winner, newWinnerRating]);
  await pool.query("UPDATE users SET hoop_rank = $2 WHERE id = $1", [loser, newLoserRating]);

  // === STEP 7: Record history ===
  await pool.query(
    "INSERT INTO rank_history(user_id, elo, hoop_rank, source, match_id) VALUES ($1, $2, $3, $4, $5)",
    [winner, Math.round(newWinnerRating * 400), newWinnerRating, 'match:' + matchId, matchId]
  );
  await pool.query(
    "INSERT INTO rank_history(user_id, elo, hoop_rank, source, match_id) VALUES ($1, $2, $3, $4, $5)",
    [loser, Math.round(newLoserRating * 400), newLoserRating, 'match:' + matchId, matchId]
  );

  // === STEP 8: Store winner in match result ===
  await pool.query(
    "UPDATE matches SET result = result || $2::jsonb WHERE id = $1",
    [matchId, JSON.stringify({ winner, loser })]
  );

  // === STEP 9: Increment games_played for both players (community rating) ===
  await pool.query(
    "UPDATE users SET games_played = COALESCE(games_played, 0) + 1 WHERE id = $1",
    [winner]
  );
  await pool.query(
    "UPDATE users SET games_played = COALESCE(games_played, 0) + 1 WHERE id = $1",
    [loser]
  );
  console.log(`[RATING] Incremented games_played for ${winner.substring(0, 8)} and ${loser.substring(0, 8)}`);

  console.log(`[RATING] Complete: ${winner.substring(0, 8)}=${newWinnerRating}, ${loser.substring(0, 8)}=${newLoserRating}`);

  return {
    applied: true,
    winner,
    loser,
    hoopRank: {
      [a]: winner === a ? newWinnerRating : newLoserRating,
      [b]: winner === b ? newWinnerRating : newLoserRating
    },
    details: {
      diversityMultiplier: diversityMult,
      neverPlayed,
      gamesThisWeek,
      winnerGain: round2(winnerGain + winnerActivityBonus),
      loserLoss: round2(loserLoss)
    }
  };
}

/** Revert provisional rating when a match is contested */
export async function revertMatchRating(pool: any, matchId: string) {
  const historyResult = await pool.query(
    "SELECT user_id, hoop_rank FROM rank_history WHERE match_id = $1",
    [matchId]
  );

  if (historyResult.rows.length === 0) {
    return { reverted: false, reason: "no_rating_history" };
  }

  const { rows: [m] } = await pool.query("SELECT * FROM matches WHERE id = $1", [matchId]);
  if (!m) return { reverted: false, reason: "match_not_found" };

  const a = m.creator_id, b = m.opponent_id;
  if (!a || !b) return { reverted: false, reason: "no_opponent" };

  // Get previous rating (before this match)
  const getPrevRating = async (uid: string) => {
    const prev = await pool.query(
      `SELECT hoop_rank FROM rank_history 
       WHERE user_id = $1 AND match_id != $2 
       ORDER BY created_at DESC LIMIT 1`,
      [uid, matchId]
    );
    return prev.rows.length > 0 ? prev.rows[0].hoop_rank : cfg.simpleRank.startRating;
  };

  const aPrevRating = await getPrevRating(a);
  const bPrevRating = await getPrevRating(b);

  // Restore ratings
  await pool.query("UPDATE users SET hoop_rank = $2 WHERE id = $1", [a, aPrevRating]);
  await pool.query("UPDATE users SET hoop_rank = $2 WHERE id = $1", [b, bPrevRating]);

  // Delete the rank_history entries for this match
  await pool.query("DELETE FROM rank_history WHERE match_id = $1", [matchId]);

  console.log(`Reverted ratings for match ${matchId}: ${a} -> ${aPrevRating}, ${b} -> ${bPrevRating}`);

  return {
    reverted: true,
    previousRating: { [a]: aPrevRating, [b]: bPrevRating }
  };
}
