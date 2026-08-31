import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { getMatch } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlacementBadge } from "@/components/placement-badge";
import { RpPill } from "@/components/rp-pill";
import { RankBadge } from "@/components/rank-badge";
import { DeleteMatchButton } from "@/components/delete-match-button";
import { kd } from "@/lib/utils";
import { ArrowLeft, MapPin, Crown, ChevronDown } from "lucide-react";

const MODE_LABEL: Record<string, string> = {
  ranked_quads: "Ranked Quads",
  quads: "Quads",
  duos: "Duos",
  gauntlet: "Gauntlet",
};
const KIND_LABEL: Record<string, string> = {
  initial_drop: "Initial drop",
  second_chance: "Second Chance",
  respawn: "Respawn",
};

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatch(id);
  if (!match) notFound();

  const jumps = [...match.match_jumps].sort((a, b) => a.jump_order - b.jump_order);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/matches">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" /> Matches
          </Button>
        </Link>
        <DeleteMatchButton id={match.id} />
      </div>

      {/* Result banner */}
      <Card className={match.won ? "border-win/40 glow-primary" : ""}>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-4">
            <PlacementBadge placement={match.placement} total={match.total_squads} />
            <div>
              <p className="text-lg font-bold">{MODE_LABEL[match.mode] ?? match.mode}</p>
              <p className="text-xs text-muted">
                {match.map} · {format(new Date(match.played_at), "EEE, MMM d yyyy · HH:mm")}
                {match.season ? ` · ${match.season}` : ""}
              </p>
            </div>
          </div>
          {match.is_ranked ? (
            <div className="flex items-center gap-3">
              {match.rank_tier ? (
                <RankBadge tier={match.rank_tier} division={match.rank_division} size="lg" />
              ) : null}
              <RpPill delta={match.rp_delta} size="lg" />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Scoreboard */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Scoreboard</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-5 py-2 font-medium">Player</th>
                  <th className="px-3 py-2 text-center font-medium">K</th>
                  <th className="px-3 py-2 text-center font-medium">A</th>
                  <th className="px-3 py-2 text-center font-medium">D</th>
                  <th className="px-3 py-2 text-center font-medium">K/D</th>
                  <th className="px-3 py-2 text-center font-medium">Rev</th>
                  <th className="px-3 py-2 text-center font-medium">Dmg</th>
                </tr>
              </thead>
              <tbody>
                {match.match_players.map((mp) => (
                  <tr key={mp.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2 font-medium">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: mp.players?.color ?? "#8b95a7" }}
                        />
                        {mp.players?.display_name ?? "Player"}
                        {mp.was_mvp ? (
                          <span className="inline-flex items-center gap-1 rounded bg-warn/15 px-1.5 py-0.5 text-[10px] font-bold text-warn">
                            <Crown className="h-3 w-3" /> MVP
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="tnum px-3 py-3 text-center font-semibold">{mp.kills}</td>
                    <td className="tnum px-3 py-3 text-center">{mp.assists}</td>
                    <td className="tnum px-3 py-3 text-center">{mp.deaths}</td>
                    <td className="tnum px-3 py-3 text-center text-muted">
                      {kd(mp.kills, mp.deaths).toFixed(2)}
                    </td>
                    <td className="tnum px-3 py-3 text-center text-muted">{mp.revives ?? "—"}</td>
                    <td className="tnum px-3 py-3 text-center text-muted">{mp.damage ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Jump path */}
      {jumps.length > 0 ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Drop &amp; respawn path</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-2">
              {jumps.map((j, i) => (
                <li key={j.id}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-xs font-bold text-muted">
                      {j.jump_order}
                    </span>
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-medium">{j.locations?.name ?? "Unknown"}</span>
                    <span className="rounded bg-card-hover px-2 py-0.5 text-[11px] text-muted">
                      {KIND_LABEL[j.kind] ?? j.kind}
                    </span>
                    {j.player_id ? (
                      <span className="text-xs text-muted">
                        {match.match_players.find((mp) => mp.player_id === j.player_id)?.players
                          ?.display_name ?? ""}
                      </span>
                    ) : null}
                  </div>
                  {j.note ? (
                    <p className="ml-10 mt-0.5 text-xs text-muted">{j.note}</p>
                  ) : null}
                  {i < jumps.length - 1 ? (
                    <ChevronDown className="ml-3 mt-1 h-3.5 w-3.5 text-border-strong" />
                  ) : null}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      {/* RP breakdown + notes + screenshot */}
      {(match.rp_start != null || match.rp_end != null || match.notes || match.screenshot_url) && (
        <Card className="mt-4">
          <CardContent className="flex flex-col gap-4 pt-6">
            {match.is_ranked && (match.rp_start != null || match.rp_end != null) ? (
              <div className="flex items-center gap-6 text-sm">
                <span className="text-muted">
                  RP before: <span className="tnum text-foreground">{match.rp_start ?? "—"}</span>
                </span>
                <span className="text-muted">
                  RP after: <span className="tnum text-foreground">{match.rp_end ?? "—"}</span>
                </span>
              </div>
            ) : null}
            {match.notes ? (
              <p className="whitespace-pre-wrap text-sm text-foreground/90">{match.notes}</p>
            ) : null}
            {match.screenshot_url ? (
              <a href={match.screenshot_url} target="_blank" rel="noreferrer">
                <Image
                  src={match.screenshot_url}
                  alt="End-of-round screenshot"
                  width={1280}
                  height={720}
                  className="rounded-lg border border-border"
                  unoptimized
                />
              </a>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
