"use client";

import { useEffect, useMemo, useState } from "react";
import { Input, Label } from "@/components/ui/input";
import { getRankByRp, formatRank, TIERS } from "@/lib/ranks";
import { RankBadge } from "@/components/rank-badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface RpValue {
  rp_before: number | null;
  rp_delta: number | null;
  rp_after: number | null;
  rank_tier: string | null;
  rank_division: number | null;
  direction: "up" | "down" | "same" | null;
}

const num = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const ordinal = (tierKey: string, division: number | null) =>
  TIERS.findIndex((t) => t.key === tierKey) * 10 + (division ?? 1);

/**
 * RP entry: you only know your RP NOW and how much you gained/lost. Tier +
 * division are auto-derived from RP now, and rank up/down is detected vs your
 * previous RP. Entering one of now/gained fills the other from your latest RP.
 */
export function RpFields({
  latestRp,
  initial,
  onChange,
}: {
  latestRp: number | null;
  initial?: Partial<RpValue>;
  onChange: (v: RpValue) => void;
}) {
  const [now, setNow] = useState(initial?.rp_after != null ? String(initial.rp_after) : "");
  const [gain, setGain] = useState(initial?.rp_delta != null ? String(initial.rp_delta) : "");

  function editNow(v: string) {
    setNow(v);
    const n = num(v);
    if (gain.trim() === "" && n != null && latestRp != null) setGain(String(n - latestRp));
  }
  function editGain(v: string) {
    setGain(v);
    const g = num(v);
    if (now.trim() === "" && g != null && latestRp != null) setNow(String(latestRp + g));
  }

  const nowN = num(now);
  const gainN = num(gain);
  const rank = nowN != null ? getRankByRp(nowN) : null;
  const prevRank = latestRp != null ? getRankByRp(latestRp) : null;

  const direction: RpValue["direction"] = useMemo(() => {
    if (!rank || !prevRank) return null;
    const a = ordinal(rank.tier.key, rank.division);
    const b = ordinal(prevRank.tier.key, prevRank.division);
    return a > b ? "up" : a < b ? "down" : "same";
  }, [rank, prevRank]);

  const value = useMemo<RpValue>(
    () => ({
      rp_after: nowN,
      rp_delta: gainN,
      rp_before: nowN != null && gainN != null ? nowN - gainN : null,
      rank_tier: rank?.tier.key ?? null,
      rank_division: rank?.division ?? null,
      direction,
    }),
    [nowN, gainN, rank, direction],
  );

  useEffect(() => {
    onChange(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.rp_after, value.rp_delta, value.rank_tier, value.rank_division, value.direction]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>RP now</Label>
          <Input type="number" value={now} onChange={(e) => editNow(e.target.value)} placeholder="e.g. 4600" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Gained / lost</Label>
          <Input
            type="number"
            value={gain}
            onChange={(e) => editGain(e.target.value)}
            placeholder="+4 / -30"
            className={gainN != null ? (gainN > 0 ? "text-win" : gainN < 0 ? "text-loss" : "") : ""}
          />
        </div>
      </div>
      {rank ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Rank:</span>
          <RankBadge tier={rank.tier.key} division={rank.division} size="sm" />
          {direction === "up" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-win/40 bg-win/15 px-2 py-0.5 text-xs font-bold text-win">
              <TrendingUp className="h-3 w-3" /> Rank up
            </span>
          ) : direction === "down" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-loss/40 bg-loss/15 px-2 py-0.5 text-xs font-bold text-loss">
              <TrendingDown className="h-3 w-3" /> Rank down
            </span>
          ) : direction === "same" ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Minus className="h-3 w-3" /> holding {formatRank(rank.tier.key, rank.division)}
            </span>
          ) : null}
          <span className="text-[11px] text-muted-foreground">(auto from RP)</span>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Enter RP now — tier &amp; division are derived automatically.</p>
      )}
    </div>
  );
}
