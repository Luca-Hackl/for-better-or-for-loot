import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  getLocation,
  getLocationStats,
  getLocationFeedback,
  getMatchesAtLocation,
  getPlayers,
  getCurrentUserAndPlayer,
} from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/stat-tile";
import { MatchCard } from "@/components/match-card";
import { LocationFeedbackForm } from "@/components/location-feedback-form";
import { fmtNum } from "@/lib/utils";
import { ArrowLeft, Flame, Star, MapPin } from "lucide-react";

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [location, stats, feedback, matches, players, me] = await Promise.all([
    getLocation(id),
    getLocationStats(),
    getLocationFeedback(id),
    getMatchesAtLocation(id),
    getPlayers(),
    getCurrentUserAndPlayer(),
  ]);
  if (!location) notFound();

  const s = stats.find((x) => x.location_id === id);
  const games = s?.games ?? 0;
  const avgRating =
    feedback.filter((f) => f.rating).length > 0
      ? feedback.reduce((a, f) => a + (f.rating ?? 0), 0) /
        feedback.filter((f) => f.rating).length
      : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <Link href="/locations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" /> Drop Zones
          </Button>
        </Link>
      </div>

      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <MapPin className="h-6 w-6" />
        </div>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            {location.name}
            {location.is_hot_drop ? (
              <Badge className="border-primary/40 bg-primary/10 text-primary">
                <Flame className="h-3 w-3" /> Hot drop
              </Badge>
            ) : null}
          </h1>
          {location.description ? (
            <p className="text-sm text-muted">{location.description}</p>
          ) : null}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Drops" value={games} sub={`${s?.wins ?? 0} wins`} />
        <StatTile
          label="Win rate"
          value={games ? `${fmtNum((s!.win_rate ?? 0) * 100)}%` : "—"}
          accent="#34d399"
        />
        <StatTile
          label="Avg RP"
          value={s?.avg_rp_delta != null ? fmtNum(Math.round(s.avg_rp_delta)) : "—"}
        />
        <StatTile
          label="Rating"
          value={
            avgRating != null ? (
              <span className="flex items-center gap-1">
                {avgRating.toFixed(1)}
                <Star className="h-4 w-4 fill-warn text-warn" />
              </span>
            ) : (
              "—"
            )
          }
        />
      </div>

      {/* Feedback */}
      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Feedback</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <LocationFeedbackForm
            locationId={id}
            players={players}
            currentPlayerId={me.player?.id ?? null}
          />
          {feedback.length > 0 ? (
            <div className="flex flex-col divide-y divide-border border-t border-border">
              {feedback.map((f) => (
                <div key={f.id} className="flex flex-col gap-1 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: f.players?.color ?? "#8b95a7" }}
                    />
                    <span className="font-medium">{f.players?.display_name ?? "Anonymous"}</span>
                    {f.rating ? (
                      <span className="flex items-center gap-0.5 text-warn">
                        {Array.from({ length: f.rating }).map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-warn" />
                        ))}
                      </span>
                    ) : null}
                    {f.loot_quality ? (
                      <span className="text-[11px] text-muted">loot {f.loot_quality}/5</span>
                    ) : null}
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {format(new Date(f.created_at), "MMM d")}
                    </span>
                  </div>
                  {f.note ? <p className="pl-4 text-sm text-foreground/90">{f.note}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No feedback yet — be the first to scout it.</p>
          )}
        </CardContent>
      </Card>

      {/* Matches dropped here */}
      {matches.length > 0 ? (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Matches dropped here
          </h2>
          <div className="flex flex-col gap-3">
            {matches.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
