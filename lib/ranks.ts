/**
 * Battlefield 6 RedSec Ranked ladder — used for rank badges, colors, and
 * chart axis reference lines. Values reflect the Season 3/4 structure surfaced
 * in-game (Rank Points, 5 divisions per tier, per-tier match entry cost).
 *
 * NOTE: EA tunes these each season and ranks soft-reset, so treat RP thresholds
 * as reference lines. The *authoritative* current rank is what the player enters
 * per match (matches.rank_tier / rank_division); getRankByRp() is a fallback.
 */

export type TierKey =
  | "unranked"
  | "rookie"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "master"
  | "elite";

export interface Tier {
  key: TierKey;
  label: string;
  color: string; // badge accent
  divisions: number; // 5 for standard tiers; 1 for unranked/elite
  floorRP: number; // RP at division I (lower bound of the tier)
  entryCost: number; // RP paid per ranked match at this tier (S3 reference)
}

export const TIERS: Tier[] = [
  { key: "unranked", label: "Unranked", color: "#8b95a7", divisions: 1, floorRP: -1, entryCost: 0 },
  { key: "rookie", label: "Rookie", color: "#b9c2d0", divisions: 5, floorRP: 0, entryCost: 0 },
  { key: "bronze", label: "Bronze", color: "#cd7f32", divisions: 5, floorRP: 600, entryCost: 20 },
  { key: "silver", label: "Silver", color: "#c0c7d1", divisions: 5, floorRP: 1600, entryCost: 30 },
  { key: "gold", label: "Gold", color: "#ffcc33", divisions: 5, floorRP: 2850, entryCost: 40 },
  { key: "platinum", label: "Platinum", color: "#3fe0d0", divisions: 5, floorRP: 5100, entryCost: 50 },
  { key: "diamond", label: "Diamond", color: "#5ea2ff", divisions: 5, floorRP: 8600, entryCost: 60 },
  { key: "master", label: "Master", color: "#c46bff", divisions: 5, floorRP: 13350, entryCost: 90 },
  { key: "elite", label: "Elite", color: "#ff3b4e", divisions: 1, floorRP: 19350, entryCost: 90 },
];

export const TIER_MAP: Record<TierKey, Tier> = Object.fromEntries(
  TIERS.map((t) => [t.key, t]),
) as Record<TierKey, Tier>;

export const ROMAN = ["", "I", "II", "III", "IV", "V"];

/** Human label for a tier + division, e.g. "Gold III" or "Elite". */
export function formatRank(tier?: string | null, division?: number | null): string {
  if (!tier) return "Unranked";
  const t = TIER_MAP[tier as TierKey];
  if (!t) return tier;
  if (t.divisions <= 1 || !division) return t.label;
  return `${t.label} ${ROMAN[division] ?? division}`;
}

export function tierColor(tier?: string | null): string {
  if (!tier) return TIER_MAP.unranked.color;
  return TIER_MAP[tier as TierKey]?.color ?? TIER_MAP.unranked.color;
}

/** Fallback: derive a rank from an RP total (reference thresholds only). */
export function getRankByRp(rp: number): { tier: Tier; division: number } {
  let current = TIERS[0];
  for (const t of TIERS) {
    if (rp >= t.floorRP) current = t;
  }
  // approximate division within the tier by even spacing to the next floor
  const idx = TIERS.findIndex((t) => t.key === current.key);
  const next = TIERS[idx + 1];
  if (current.divisions <= 1 || !next) return { tier: current, division: current.divisions };
  const span = next.floorRP - current.floorRP;
  const into = rp - current.floorRP;
  const division = Math.min(current.divisions, Math.floor((into / span) * current.divisions) + 1);
  return { tier: current, division };
}

/** Default per-player accent colors (players.color can override). */
export const PLAYER_COLORS = ["#ff3b4e", "#35d0e0", "#ffcc33", "#c46bff"];
