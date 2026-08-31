import Link from "next/link";
import { Suspense } from "react";
import { getMatches, getRpTimeline, getPlayers, getCurrentUserAndPlayer } from "@/lib/data";
import { computeKpis } from "@/lib/stats";
import { fmtDelta, fmtNum } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/stat-tile";
import { RankBadge } from "@/components/rank-badge";
import { MatchCard } from "@/components/match-card";
import { RpChart, type RpPoint } from "@/components/charts/rp-chart";
import { CareerPanel, CareerSkeleton } from "@/components/career-panel";
import { Plus, Flame, Snowflake } from "lucide-react";

export const metadata = { title: "Overview — RedSec Ranked" };

export default async function OverviewPage() {
  const me = await getCurrentUserAndPlayer();
  const myId = me.player?.id ?? null;
  const [matches, timeline, players] = await Promise.all([
    getMatches({ limit: 500 }),
    myId ? getRpTimeline(myId) : Promise.resolve([]),
    getPlayers(),
  ]);

  const kpis = computeKpis(matches, myId);
  const rpData: RpPoint[] = timeline.map((p) => ({
    t: p.played_at,
    rp: p.running_rp,
    delta: p.rp_delta,
  }));

  // current rank = my most recent ranked line that carries a tier
  let myRankTier: string | null = null;
  let myRankDivision: number | null = null;
  for (const m of matches) {
    const line = myId ? m.match_players.find((mp) => mp.player_id === myId) : undefined;
    if (line?.rank_tier) {
      myRankTier = line.rank_tier;
      myRankDivision = line.rank_division;
      break;
    }
  }
  const streakPositive = kpis.currentStreak > 0;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Squad HQ</h1>
          <p className="text-sm text-muted">Your RedSec Ranked climb, at a glance.</p>
        </div>
        <div className="flex items-center gap-3">
          {myRankTier ? (
            <RankBadge tier={myRankTier} division={myRankDivision} size="lg" />
          ) : null}
          <Link href="/matches/new">
            <Button>
              <Plus className="h-4 w-4" /> Log a match
            </Button>
          </Link>
        </div>
      </div>

      {/* Hero RP chart */}
      <Card>
        <CardHeader>
          <CardTitle>Rank Points over time</CardTitle>
        </CardHeader>
        <CardContent>
          <RpChart data={rpData} />
        </CardContent>
      </Card>

      {/* KPI tiles */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatTile
          label="Win rate"
          value={`${fmtNum(kpis.winRate * 100, 0)}%`}
          sub={`${kpis.wins}/${kpis.games} games`}
          accent="#34d399"
        />
        <StatTile
          label="RP / match"
          value={kpis.rpPerMatch != null ? fmtDelta(Math.round(kpis.rpPerMatch)) : "—"}
          sub={`${kpis.rankedGames} ranked`}
          accent={kpis.rpPerMatch != null && kpis.rpPerMatch >= 0 ? "#34d399" : "#f87171"}
        />
        <StatTile
          label="Avg RP win"
          value={kpis.avgRpWin != null ? fmtDelta(Math.round(kpis.avgRpWin)) : "—"}
          accent="#34d399"
        />
        <StatTile
          label="Avg RP loss"
          value={kpis.avgRpLoss != null ? fmtDelta(Math.round(kpis.avgRpLoss)) : "—"}
          accent="#f87171"
        />
        <StatTile
          label="Net RP"
          value={fmtDelta(kpis.netRp)}
          accent={kpis.netRp >= 0 ? "#34d399" : "#f87171"}
        />
        <StatTile
          label="Streak"
          value={
            <span className="flex items-center gap-1.5">
              {kpis.currentStreak !== 0 ? (
                streakPositive ? (
                  <Flame className="h-5 w-5 text-warn" />
                ) : (
                  <Snowflake className="h-5 w-5 text-accent" />
                )
              ) : null}
              {Math.abs(kpis.currentStreak) || "—"}
            </span>
          }
          sub={kpis.currentStreak === 0 ? "—" : streakPositive ? "wins" : "losses"}
        />
      </div>

      {/* Career (auto-pulled, Suspense so it never blocks) */}
      <div className="mt-4">
        <Suspense fallback={<CareerSkeleton />}>
          <CareerPanel players={players} />
        </Suspense>
      </div>

      {/* Recent matches */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Recent matches
          </h2>
          <Link href="/matches" className="text-xs text-accent hover:underline">
            View all
          </Link>
        </div>
        {matches.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted">
            No matches yet.{" "}
            <Link href="/matches/new" className="text-accent hover:underline">
              Log your first drop.
            </Link>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {matches.slice(0, 5).map((m) => (
              <MatchCard key={m.id} match={m} myPlayerId={myId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
