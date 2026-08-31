import Link from "next/link";
import { getLocations, getLocationStats, getMapImage } from "@/lib/data";
import type { LocationStat } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddLocation } from "@/components/add-location";
import { LocationsMap } from "@/components/locations-map";
import { fmtNum } from "@/lib/utils";
import { MapPin, Flame, ChevronRight } from "lucide-react";

export const metadata = { title: "Drop Zones — RedSec Ranked" };

export default async function LocationsPage() {
  const [locations, stats, mapImage] = await Promise.all([
    getLocations(),
    getLocationStats(),
    getMapImage(),
  ]);
  const statsById = new Map<string, LocationStat>(stats.map((s) => [s.location_id, s]));

  // Best drop = most wins-weighted; played spots first, sorted by win rate then avg RP.
  const ranked = [...locations].sort((a, b) => {
    const sa = statsById.get(a.id);
    const sb = statsById.get(b.id);
    const ga = sa?.games ?? 0;
    const gb = sb?.games ?? 0;
    if ((ga > 0) !== (gb > 0)) return ga > 0 ? -1 : 1;
    if ((sb?.win_rate ?? 0) !== (sa?.win_rate ?? 0)) return (sb?.win_rate ?? 0) - (sa?.win_rate ?? 0);
    return (sb?.avg_rp_delta ?? -999) - (sa?.avg_rp_delta ?? -999);
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Drop Zones</h1>
          <p className="text-sm text-muted">Where you land, and how it goes. Best spots first.</p>
        </div>
        <AddLocation />
      </div>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Tactical map</CardTitle>
        </CardHeader>
        <CardContent>
          <LocationsMap locations={locations} mapImage={mapImage} />
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ranked.map((loc, i) => {
          const s = statsById.get(loc.id);
          const games = s?.games ?? 0;
          return (
            <Link key={loc.id} href={`/locations/${loc.id}`}>
              <Card className="h-full p-4 transition-colors hover:bg-card-hover">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{loc.name}</span>
                  </div>
                  {loc.is_hot_drop ? (
                    <Badge className="border-primary/40 bg-primary/10 text-primary">
                      <Flame className="h-3 w-3" /> Hot
                    </Badge>
                  ) : null}
                </div>

                {games > 0 ? (
                  <>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <Metric label="Win rate" value={`${fmtNum((s!.win_rate ?? 0) * 100)}%`} accent="#34d399" />
                      <Metric
                        label="Avg RP"
                        value={s!.avg_rp_delta != null ? fmtNum(Math.round(s!.avg_rp_delta)) : "—"}
                      />
                      <Metric
                        label="Avg place"
                        value={s!.avg_placement != null ? `#${fmtNum(s!.avg_placement, 1)}` : "—"}
                      />
                    </div>
                    <p className="mt-3 text-[11px] text-muted">
                      {games} {games === 1 ? "drop" : "drops"} · {s!.wins} wins · avg{" "}
                      {fmtNum(s!.avg_kills ?? 0, 1)} squad kills
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-xs text-muted">
                    No drops logged here yet.
                    {loc.description ? ` ${loc.description}` : ""}
                  </p>
                )}
                {i === 0 && games > 0 ? (
                  <span className="mt-3 inline-flex items-center gap-1 rounded bg-win/15 px-2 py-0.5 text-[11px] font-semibold text-win">
                    ★ Best drop
                  </span>
                ) : null}
                <span className="mt-3 flex items-center gap-1 text-xs text-accent">
                  Details <ChevronRight className="h-3 w-3" />
                </span>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="tnum text-lg font-bold" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}
