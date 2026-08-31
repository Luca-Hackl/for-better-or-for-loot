import Link from "next/link";
import { format } from "date-fns";
import type { MatchWithDetails } from "@/lib/data";
import { Card } from "@/components/ui/card";
import { PlacementBadge } from "@/components/placement-badge";
import { RpPill } from "@/components/rp-pill";
import { RankBadge } from "@/components/rank-badge";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const MODE_LABEL: Record<string, string> = {
  ranked_quads: "Ranked Quads",
  quads: "Quads",
  duos: "Duos",
  gauntlet: "Gauntlet",
};

export function MatchCard({ match, myPlayerId }: { match: MatchWithDetails; myPlayerId?: string | null }) {
  const initialDrops = match.match_jumps
    .filter((j) => j.kind === "initial_drop")
    .map((j) => j.locations?.name)
    .filter(Boolean);
  const dropLabel = initialDrops[0] ?? match.match_jumps[0]?.locations?.name;
  const myLine = myPlayerId ? match.match_players.find((mp) => mp.player_id === myPlayerId) : undefined;

  return (
    <Link href={`/matches/${match.id}`} className="block">
      <Card
        className={cn(
          "p-4 transition-colors hover:bg-card-hover",
          match.won && "border-win/40",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PlacementBadge placement={match.placement} total={match.total_squads} />
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
              {MODE_LABEL[match.mode] ?? match.mode}
            </span>
          </div>
          {match.is_ranked && myLine?.rp_delta != null ? <RpPill delta={myLine.rp_delta} size="sm" /> : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          {match.match_players.map((mp) => (
            <div key={mp.id} className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: mp.players?.color ?? "#8b95a7" }}
              />
              <span className="text-sm font-medium">{mp.players?.display_name ?? "Player"}</span>
              <span className="tnum text-sm text-muted">
                <span className="text-foreground">{mp.kills}</span>/{mp.assists}/{mp.deaths}
                {mp.was_mvp ? <span className="ml-1 text-warn">★</span> : null}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <span className="flex items-center gap-3">
            {dropLabel ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {dropLabel}
                {match.match_jumps.length > 1 ? ` +${match.match_jumps.length - 1}` : ""}
              </span>
            ) : null}
            {match.is_ranked && myLine?.rank_tier ? (
              <RankBadge tier={myLine.rank_tier} division={myLine.rank_division} size="sm" />
            ) : null}
          </span>
          <span>{format(new Date(match.played_at), "MMM d, HH:mm")}</span>
        </div>
      </Card>
    </Link>
  );
}
