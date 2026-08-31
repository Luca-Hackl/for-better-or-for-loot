import { TIER_MAP, type TierKey } from "@/lib/ranks";

/**
 * RedSec Ranked RP math, from the in-game "How to Play: Ranked Battle Royale"
 * tables. Per round:
 *   total = placementRP + killRP + assistRP − entryCost
 * where kill/assist RP use a per-placement base for the first 8, a reduced
 * value after 8 (the "cap reduction"). Confirmed-assist RP equals kill RP.
 */

type PlacementRow = { placementRP: number; base: number; reduced: number };

// placement (1..25) -> { placementRP, per-kill base (first 8), reduced (after 8) }
function placementRow(placement: number): PlacementRow {
  const p = placement;
  if (p <= 1) return { placementRP: 100, base: 24, reduced: 3 };
  if (p === 2) return { placementRP: 60, base: 20, reduced: 3 };
  if (p <= 4) return { placementRP: 50, base: 18, reduced: 2 };
  if (p <= 6) return { placementRP: 40, base: 16, reduced: 2 };
  if (p <= 10) return { placementRP: 30, base: 14, reduced: 2 };
  if (p <= 14) return { placementRP: 20, base: 12, reduced: 2 };
  if (p <= 20) return { placementRP: 10, base: 12, reduced: 2 };
  if (p <= 22) return { placementRP: 10, base: 10, reduced: 2 };
  return { placementRP: 0, base: 10, reduced: 2 }; // 23–25
}

const CAP = 8;
function scoreRp(count: number, row: PlacementRow): number {
  const n = Math.max(0, count);
  return Math.min(n, CAP) * row.base + Math.max(0, n - CAP) * row.reduced;
}

export interface RpEstimate {
  placementRP: number;
  killRP: number;
  assistRP: number;
  entryCost: number;
  total: number;
}

/** Estimate the RP change for a round. tierKey drives the entry cost. */
export function estimateRoundRp(input: {
  placement: number | null;
  kills: number;
  assists: number;
  tierKey: TierKey | null;
}): RpEstimate | null {
  if (input.placement == null) return null;
  const row = placementRow(input.placement);
  const killRP = scoreRp(input.kills, row);
  const assistRP = scoreRp(input.assists, row);
  const entryCost = input.tierKey ? TIER_MAP[input.tierKey]?.entryCost ?? 0 : 0;
  return {
    placementRP: row.placementRP,
    killRP,
    assistRP,
    entryCost,
    total: row.placementRP + killRP + assistRP - entryCost,
  };
}
