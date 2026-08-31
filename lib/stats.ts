import type { MatchWithDetails } from "@/lib/data";

export interface Kpis {
  games: number;
  wins: number;
  winRate: number; // 0..1
  rankedGames: number;
  avgRpWin: number | null;
  avgRpLoss: number | null;
  rpPerMatch: number | null;
  netRp: number;
  currentStreak: number; // + = win streak, - = loss streak (placement==1 based)
  bestPlacement: number | null;
  bestRp: MatchWithDetails | null;
  worstRp: MatchWithDetails | null;
}

/** matches expected in DESC chronological order (newest first). RP is read from
 *  the given player's own line (per-player); win/placement stay match-level. */
export function computeKpis(matches: MatchWithDetails[], playerId?: string | null): Kpis {
  const games = matches.length;
  const wins = matches.filter((m) => m.won).length;
  const ranked = matches.filter((m) => m.is_ranked);
  const rankedGames = ranked.length;

  const myDelta = (m: MatchWithDetails): number | null => {
    if (!playerId) return null;
    return m.match_players.find((mp) => mp.player_id === playerId)?.rp_delta ?? null;
  };

  const rpAll = ranked.map(myDelta).filter((v): v is number => v != null);
  const rpWins = rpAll.filter((v) => v > 0);
  const rpLosses = rpAll.filter((v) => v < 0);

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  // current streak from newest match
  let streak = 0;
  if (matches.length) {
    const firstWin = matches[0].won;
    for (const m of matches) {
      if (m.won === firstWin) streak++;
      else break;
    }
    streak = firstWin ? streak : -streak;
  }

  const placements = matches.map((m) => m.placement).filter((p): p is number => p != null);

  let bestRp: MatchWithDetails | null = null;
  let worstRp: MatchWithDetails | null = null;
  let bestVal = -Infinity;
  let worstVal = Infinity;
  for (const m of ranked) {
    const d = myDelta(m);
    if (d == null) continue;
    if (d > bestVal) { bestVal = d; bestRp = m; }
    if (d < worstVal) { worstVal = d; worstRp = m; }
  }

  return {
    games,
    wins,
    winRate: games ? wins / games : 0,
    rankedGames,
    avgRpWin: avg(rpWins),
    avgRpLoss: avg(rpLosses),
    rpPerMatch: avg(rpAll),
    netRp: rpAll.reduce((a, b) => a + b, 0),
    currentStreak: streak,
    bestPlacement: placements.length ? Math.min(...placements) : null,
    bestRp,
    worstRp,
  };
}
