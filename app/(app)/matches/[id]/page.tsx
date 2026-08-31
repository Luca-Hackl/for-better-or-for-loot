import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { getMatch, getCurrentUserAndPlayer, getMapImage, getLatestRp } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlacementBadge } from "@/components/placement-badge";
import { RpPill } from "@/components/rp-pill";
import { RankBadge } from "@/components/rank-badge";
import { DeleteMatchButton } from "@/components/delete-match-button";
import { MyStatsPanel } from "@/components/my-stats-panel";
import { TacticalMap } from "@/components/tactical-map";
import { kd, fmtDelta } from "@/lib/utils";
import { ArrowLeft, Crown } from "lucide-react";

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

function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [match, me, mapImage] = await Promise.all([
    getMatch(id),
    getCurrentUserAndPlayer(),
    getMapImage(),
  ]);
  if (!match) notFound();

  const jumps = [...match.match_jumps].sort((a, b) => a.jump_order - b.jump_order);
  const myLine = me.player
    ? match.match_players.find((mp) => mp.player_id === me.player!.id) ?? null
    : null;
  const latestRp = me.player ? await getLatestRp(me.player.id, { excludeMatchId: id }) : null;

  // marker-less jump points for the read-only map
  const jumpPoints = jumps
    .filter((j) => j.pos_x != null && j.pos_y != null)
    .map((j) => ({
      id: j.id,
      x: j.pos_x as number,
      y: j.pos_y as number,
      color: j.kind === "initial_drop" ? "#ff3b4e" : "#35d0e0",
      label: String(j.jump_order),
    }));

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

      {/* Result banner — RP/rank shown are the viewer's own */}
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
          {match.is_ranked && myLine ? (
            <div className="flex items-center gap-3">
              {myLine.rank_tier ? (
                <RankBadge tier={myLine.rank_tier} division={myLine.rank_division} size="lg" />
              ) : null}
              {myLine.rp_delta != null ? <RpPill delta={myLine.rp_delta} size="lg" /> : null}
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
                  <th className="px-3 py-2 text-center font-medium">Dmg</th>
                  {match.is_ranked ? <th className="px-3 py-2 text-center font-medium">RP</th> : null}
                </tr>
              </thead>
              <tbody>
                {match.match_players.map((mp) => (
                  <tr key={mp.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3">
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: mp.players?.color ?? "#8b95a7" }} />
                        {mp.players?.display_name ?? "Player"}
                        {mp.was_mvp ? (
                          <span className="inline-flex items-center gap-1 rounded bg-warn/15 px-1.5 py-0.5 text-[10px] font-bold text-warn">
                            <Crown className="h-3 w-3" /> MVP
                          </span>
                        ) : null}
                        {match.is_ranked && mp.rank_tier ? (
                          <RankBadge tier={mp.rank_tier} division={mp.rank_division} size="sm" />
                        ) : null}
                        {mp.time_seconds != null ? (
                          <span className="text-[10px] text-muted-foreground">{mmss(mp.time_seconds)}</span>
                        ) : null}
                      </span>
                    </td>
                    <td className="tnum px-3 py-3 text-center font-semibold">{mp.kills}</td>
                    <td className="tnum px-3 py-3 text-center">{mp.assists}</td>
                    <td className="tnum px-3 py-3 text-center">
                      {mp.deaths}
                      {mp.death_times && mp.death_times.length > 0 ? (
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          @{mp.death_times.map((t) => mmss(t)).join(", ")}
                        </span>
                      ) : null}
                    </td>
                    <td className="tnum px-3 py-3 text-center text-muted">{kd(mp.kills, mp.deaths).toFixed(2)}</td>
                    <td className="tnum px-3 py-3 text-center text-muted">{mp.damage ?? "—"}</td>
                    {match.is_ranked ? (
                      <td className="tnum px-3 py-3 text-center">
                        {mp.rp_delta != null ? (
                          <span className={mp.rp_delta > 0 ? "text-win" : mp.rp_delta < 0 ? "text-loss" : "text-muted"}>
                            {fmtDelta(mp.rp_delta)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Enter my own stats + RP */}
      {me.player ? (
        <MyStatsPanel
          matchId={match.id}
          me={me.player}
          existing={myLine}
          isRanked={match.is_ranked}
          latestRp={latestRp}
          placement={match.placement}
        />
      ) : null}

      {/* Drop & respawn path (marker-less) */}
      {jumps.length > 0 ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Drop &amp; respawn path</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {jumpPoints.length > 0 ? (
              <TacticalMap
                locations={[]}
                mode="select"
                points={jumpPoints}
                backgroundUrl={mapImage?.url ?? null}
                aspectRatio={mapImage ? mapImage.width / mapImage.height : undefined}
              />
            ) : null}
            <ol className="flex flex-col gap-1.5">
              {jumps.map((j) => (
                <li key={j.id} className="flex items-center gap-2 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-xs font-bold text-muted">
                    {j.jump_order}
                  </span>
                  <span className="rounded bg-card-hover px-2 py-0.5 text-[11px] text-muted">
                    {KIND_LABEL[j.kind] ?? j.kind}
                  </span>
                  {j.locations?.name ? <span className="font-medium">{j.locations.name}</span> : null}
                  {j.player_id ? (
                    <span className="text-xs text-muted">
                      {match.match_players.find((mp) => mp.player_id === j.player_id)?.players?.display_name ?? ""}
                    </span>
                  ) : null}
                  {j.note ? <span className="text-xs text-muted">· {j.note}</span> : null}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      {/* Notes + screenshot */}
      {(match.notes || match.screenshot_url) && (
        <Card className="mt-4">
          <CardContent className="flex flex-col gap-4 pt-6">
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
