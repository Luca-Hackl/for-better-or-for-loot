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

/** matches expected in DESC chronological order (newest first). */
export function computeKpis(matches: MatchWithDetails[]): Kpis {
  const games = matches.length;
  const wins = matches.filter((m) => m.won).length;
  const ranked = matches.filter((m) => m.is_ranked);
  const rankedGames = ranked.length;

  const rpWins = ranked.filter((m) => (m.rp_delta ?? 0) > 0).map((m) => m.rp_delta as number);
  const rpLosses = ranked.filter((m) => (m.rp_delta ?? 0) < 0).map((m) => m.rp_delta as number);
  const rpAll = ranked.filter((m) => m.rp_delta != null).map((m) => m.rp_delta as number);

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

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
  for (const m of ranked) {
    if (m.rp_delta == null) continue;
    if (!bestRp || (m.rp_delta as number) > (bestRp.rp_delta as number)) bestRp = m;
    if (!worstRp || (m.rp_delta as number) < (worstRp.rp_delta as number)) worstRp = m;
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
