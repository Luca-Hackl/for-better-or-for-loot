import "server-only";

/**
 * Best-effort fetch of *aggregate lifetime* RedSec stats from the free,
 * unofficial gametools community API (no key required).
 *
 * Caveats (documented for honesty): aggregate only, includes bot kills, no RP,
 * no per-match detail, and BF6/RedSec field names are not officially documented
 * — so parsing is defensive and this whole panel is treated as optional.
 * If anything looks off, we return { available: false } and the UI degrades.
 */

export interface CareerStats {
  ea_id: string;
  platform: string;
  available: boolean;
  error?: string;
  matches?: number;
  wins?: number;
  winRate?: number; // 0..1
  kills?: number;
  deaths?: number;
  kd?: number;
  extractions?: number;
  perMode?: { mode: string; matches: number; wins: number; kills: number }[];
}

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** Map our stored platform to gametools' expected values (best-effort). */
function mapPlatform(p: string): string {
  switch (p) {
    case "xbl":
      return "xboxone";
    case "psn":
      return "ps4";
    default:
      return "pc";
  }
}

export async function fetchCareer(
  eaId: string,
  platform: string,
): Promise<CareerStats> {
  const base: CareerStats = { ea_id: eaId, platform, available: false };
  if (!eaId) return { ...base, error: "No EA ID set" };

  const url =
    `https://api.gametools.network/bf6/stats/?name=${encodeURIComponent(eaId)}` +
    `&platform=${mapPlatform(platform)}&skip_battlelog=true`;

  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      // cache aggregate stats for an hour — they barely move and this is optional
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return { ...base, error: `gametools ${res.status}` };
    }
    const data: unknown = await res.json();
    const obj = (data ?? {}) as Record<string, unknown>;

    // The BF6 payload exposes a top-level `redsec` array of per-mode aggregates.
    const redsec = Array.isArray(obj.redsec) ? (obj.redsec as Record<string, unknown>[]) : [];
    if (redsec.length === 0) {
      return { ...base, error: "No RedSec stats found for this profile" };
    }

    let matches = 0,
      wins = 0,
      kills = 0,
      deaths = 0,
      extractions = 0;
    const perMode: CareerStats["perMode"] = [];

    for (const m of redsec) {
      const mMatches = n(m.matches ?? m.matchesPlayed);
      const mWins = n(m.wins);
      const mKills = n(m.kills);
      matches += mMatches;
      wins += mWins;
      kills += mKills;
      deaths += n(m.deaths);
      extractions += n(m.extractions);
      perMode.push({
        mode: String(m.mode ?? m.name ?? "RedSec"),
        matches: mMatches,
        wins: mWins,
        kills: mKills,
      });
    }

    return {
      ...base,
      available: true,
      matches,
      wins,
      winRate: matches > 0 ? wins / matches : 0,
      kills,
      deaths,
      kd: deaths > 0 ? kills / deaths : kills,
      extractions,
      perMode,
    };
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : "fetch failed" };
  }
}
