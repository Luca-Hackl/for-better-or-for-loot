import { notFound, redirect } from "next/navigation";
import { getLiveMatch, getCurrentUserAndPlayer, getMapImage } from "@/lib/data";
import { LiveMatch } from "@/components/live-match";

export const metadata = { title: "Live match — RedSec Ranked" };

export default async function LiveMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [match, me, mapImage] = await Promise.all([
    getLiveMatch(id),
    getCurrentUserAndPlayer(),
    getMapImage(),
  ]);
  if (!match) notFound();
  if (match.status === "final") redirect(`/matches/${id}`);

  const meId = me.player?.id ?? null;
  const isMember = !!meId && match.match_players.some((mp) => mp.player_id === meId);
  if (!isMember) redirect("/play"); // not invited to this match

  return (
    <LiveMatch
      initial={match}
      meId={meId}
      isHost={match.host_player_id === meId}
      mapImage={mapImage}
    />
  );
}
