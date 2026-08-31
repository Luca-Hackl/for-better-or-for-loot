import { fetchCareer } from "@/lib/career";
import type { Player } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtNum } from "@/lib/utils";
import { Gauge, Info } from "lucide-react";

/**
 * Auto-pulled lifetime aggregate RedSec stats (free gametools API).
 * Async server component — wrap in <Suspense> so it never blocks the page.
 */
export async function CareerPanel({ players }: { players: Player[] }) {
  const withIds = players.filter((p) => p.ea_id);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-accent" /> Career (lifetime aggregate)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {withIds.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Info className="h-4 w-4" /> Add each player&apos;s EA ID in Settings to auto-pull
            lifetime stats.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {await Promise.all(
              withIds.map(async (p) => {
                const c = await fetchCareer(p.ea_id!, p.platform ?? "pc");
                return (
                  <div
                    key={p.id}
                    className="rounded-lg border border-border bg-surface/50 p-4"
                    style={{ borderColor: `${p.color ?? "#2b3340"}44` }}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: p.color ?? "#8b95a7" }}
                      />
                      <span className="text-sm font-semibold">{p.display_name}</span>
                      <span className="text-xs text-muted">· {p.ea_id}</span>
                    </div>
                    {c.available ? (
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <Mini label="Matches" value={fmtNum(c.matches)} />
                        <Mini label="Wins" value={fmtNum(c.wins)} />
                        <Mini label="K/D" value={c.kd != null ? c.kd.toFixed(2) : "—"} />
                        <Mini label="Kills" value={fmtNum(c.kills)} />
                      </div>
                    ) : (
                      <p className="text-xs text-muted">
                        Unavailable{c.error ? ` — ${c.error}` : ""}.
                      </p>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Aggregate lifetime totals from the community gametools API — includes bot kills, has no
          RP or per-match detail, and is best-effort. Your logged matches below are the source of
          truth.
        </p>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="tnum text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}

export function CareerSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-accent" /> Career (lifetime aggregate)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-20 animate-pulse rounded-lg bg-surface/60" />
      </CardContent>
    </Card>
  );
}
