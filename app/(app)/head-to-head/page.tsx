import { getPlayerStats } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { H2HRadar, H2HTotals } from "@/components/charts/h2h-charts";
import { cn } from "@/lib/utils";
import { Crown, Users } from "lucide-react";

export const metadata = { title: "Head-to-Head — RedSec Ranked" };

const COLORS = ["#ff3b4e", "#35d0e0", "#ffcc33", "#c46bff"];

export default async function HeadToHeadPage() {
  const players = (await getPlayerStats()).filter((p) => p.games > 0);

  if (players.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-4 text-2xl font-bold tracking-tight">Head-to-Head</h1>
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Users className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted">Log a few matches to unlock the head-to-head.</p>
        </Card>
      </div>
    );
  }

  // Leaderboard winners per stat (for the crown markers)
  const leader = (getter: (p: (typeof players)[number]) => number) =>
    players.reduce((best, p) => (getter(p) > getter(best) ? p : best)).player_id;
  const leaders = {
    kills: leader((p) => p.kills),
    kd: leader((p) => p.kd),
    avg_kills: leader((p) => p.avg_kills),
    mvps: leader((p) => p.mvps),
    assists: leader((p) => p.assists),
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Head-to-Head</h1>
        <p className="text-sm text-muted">27 years of competition, quantified.</p>
      </div>

      {/* Player summary cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {players.map((p, i) => {
          const c = p.color ?? COLORS[i % COLORS.length];
          return (
            <Card key={p.player_id} className="p-5" style={{ borderColor: `${c}44` }}>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c }} />
                <span className="text-lg font-bold">{p.display_name}</span>
                <span className="ml-auto text-xs text-muted">{p.games} games</span>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                <Stat label="K/D" value={p.kd.toFixed(2)} crown={leaders.kd === p.player_id} accent={c} />
                <Stat
                  label="Kills/g"
                  value={p.avg_kills.toFixed(1)}
                  crown={leaders.avg_kills === p.player_id}
                />
                <Stat label="Kills" value={p.kills} crown={leaders.kills === p.player_id} />
                <Stat label="MVPs" value={p.mvps} crown={leaders.mvps === p.player_id} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-muted">
                <span>
                  <span className="tnum block text-sm text-foreground">{p.assists}</span>assists
                </span>
                <span>
                  <span className="tnum block text-sm text-foreground">{p.deaths}</span>deaths
                </span>
                <span>
                  <span className="tnum block text-sm text-foreground">{p.revives}</span>revives
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Play-style radar</CardTitle>
          </CardHeader>
          <CardContent>
            <H2HRadar players={players} />
            <p className="mt-2 text-[11px] text-muted-foreground">
              Each axis normalized to the leader (100).
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Career totals</CardTitle>
          </CardHeader>
          <CardContent>
            <H2HTotals players={players} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  crown,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  crown?: boolean;
  accent?: string;
}) {
  return (
    <div>
      <div
        className={cn("tnum flex items-center justify-center gap-1 text-xl font-bold")}
        style={accent && crown ? { color: accent } : undefined}
      >
        {value}
        {crown ? <Crown className="h-3.5 w-3.5 text-warn" /> : null}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}
