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

    // The live BF6 payload exposes `redsec` as an array of SEASONS, each with a
    // nested `modes` array (Duos / Quads / Gauntlet). Sum across all seasons and
    // modes for lifetime totals; aggregate per mode by name.
    const seasons = Array.isArray(obj.redsec) ? (obj.redsec as Record<string, unknown>[]) : [];
    if (seasons.length === 0) {
      return { ...base, error: "No RedSec stats found for this profile" };
    }

    let matches = 0,
      wins = 0,
      kills = 0,
      deaths = 0,
      extractions = 0;
    const byMode = new Map<string, { matches: number; wins: number; kills: number }>();

    for (const s of seasons) {
      const modes = Array.isArray(s.modes) ? (s.modes as Record<string, unknown>[]) : [];
      for (const m of modes) {
        const mMatches = n(m.matches);
        const mWins = n(m.wins);
        const mKills = n(m.kills);
        matches += mMatches;
        wins += mWins;
        kills += mKills;
        deaths += n(m.deaths);
        extractions += n(m.extractions);
        const name = String(m.mode ?? m.modeId ?? "RedSec");
        const cur = byMode.get(name) ?? { matches: 0, wins: 0, kills: 0 };
        cur.matches += mMatches;
        cur.wins += mWins;
        cur.kills += mKills;
        byMode.set(name, cur);
      }
    }

    if (matches === 0 && kills === 0) {
      return { ...base, error: "No RedSec matches on record" };
    }

    const perMode = Array.from(byMode.entries()).map(([mode, v]) => ({ mode, ...v }));

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
