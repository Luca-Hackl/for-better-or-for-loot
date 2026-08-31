"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fireConfetti } from "@/lib/confetti";
import { Button } from "@/components/ui/button";
import { RankBadge } from "@/components/rank-badge";
import { fmtDelta } from "@/lib/utils";
import { Trophy, ArrowUpRight, Skull, Crosshair, Plus, ChevronRight, TrendingUp } from "lucide-react";

export interface CelebrationData {
  matchId: string;
  won: boolean;
  placement: number | null;
  totalSquads: number | null;
  isRanked: boolean;
  rpDelta: number | null;
  rpAfter: number | null;
  rankTier: string | null;
  rankDivision: number | null;
  promoted: boolean;
  kills: number;
  assists: number;
  deaths: number;
  timeSeconds: number | null;
}

function useCountUp(target: number | null, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target == null) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function Celebration({ data, onAnother }: { data: CelebrationData; onAnother: () => void }) {
  const router = useRouter();
  const gain = data.rpDelta != null && data.rpDelta > 0;

  useEffect(() => {
    const big = data.won || data.promoted;
    fireConfetti({
      particleCount: big ? 220 : gain ? 150 : 90,
      colors: data.won
        ? ["#ffcc33", "#ff3b4e", "#ffffff", "#34d399"]
        : gain
          ? ["#34d399", "#35d0e0", "#ffffff"]
          : ["#35d0e0", "#c46bff", "#ffffff"],
    });
    if (data.promoted) setTimeout(() => fireConfetti({ particleCount: 160, colors: ["#c46bff", "#ffcc33", "#ffffff"] }), 500);
  }, [data.won, data.promoted, gain]);

  const rpNow = useCountUp(data.rpAfter);
  const headline = data.won ? "VICTORY!" : data.placement ? `#${data.placement} finish` : "Round logged";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-2xl glow-primary">
        <div
          className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{
            background: data.won ? "rgba(255,204,51,0.15)" : "rgba(255,59,78,0.12)",
            color: data.won ? "#ffcc33" : "#ff3b4e",
          }}
        >
          <Trophy className="h-8 w-8" />
        </div>

        <h2 className="text-2xl font-black tracking-tight">{headline}</h2>
        {data.placement && data.totalSquads ? (
          <p className="text-xs text-muted">out of {data.totalSquads} squads</p>
        ) : null}

        {data.promoted ? (
          <div className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full border border-warn/40 bg-warn/15 px-3 py-1 text-sm font-bold text-warn">
            <TrendingUp className="h-4 w-4" /> PROMOTED!
          </div>
        ) : null}

        {data.isRanked && data.rpDelta != null ? (
          <div className="mt-4 flex flex-col items-center gap-1">
            <span
              className="tnum text-4xl font-black"
              style={{ color: gain ? "#34d399" : data.rpDelta < 0 ? "#f87171" : "#8b95a7" }}
            >
              {fmtDelta(data.rpDelta)} RP
            </span>
            {data.rpAfter != null ? (
              <span className="flex items-center gap-2 text-sm text-muted">
                <ArrowUpRight className="h-4 w-4" /> now at <span className="tnum font-bold text-foreground">{rpNow}</span>
                {data.rankTier ? <RankBadge tier={data.rankTier} division={data.rankDivision} size="sm" /> : null}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-center gap-5 text-sm">
          <span className="flex items-center gap-1.5">
            <Crosshair className="h-4 w-4 text-primary" />
            <span className="tnum font-bold">{data.kills}</span> <span className="text-muted">kills</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Skull className="h-4 w-4 text-loss" />
            <span className="tnum font-bold">{data.deaths}</span> <span className="text-muted">deaths</span>
          </span>
          {data.timeSeconds != null ? (
            <span className="text-muted">
              <span className="tnum font-bold text-foreground">{mmss(data.timeSeconds)}</span> played
            </span>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Button
            onClick={() => {
              onAnother();
            }}
          >
            <Plus className="h-4 w-4" /> Log another round
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              router.push(`/matches/${data.matchId}`);
              router.refresh();
            }}
          >
            View match <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
