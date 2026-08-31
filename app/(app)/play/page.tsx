import { getPlayers, getLocations, getMatches, getMapImage, getCurrentUserAndPlayer } from "@/lib/data";
import { PlayMode } from "@/components/play-mode";

export const metadata = { title: "Play mode — RedSec Ranked" };

export default async function PlayPage() {
  const [players, locations, recent, mapImage, me] = await Promise.all([
    getPlayers(),
    getLocations(),
    getMatches({ limit: 20 }),
    getMapImage(),
    getCurrentUserAndPlayer(),
  ]);
  const lastSeason = recent.find((m) => m.season)?.season ?? "S4";

  return (
    <PlayMode
      players={players}
      locations={locations}
      defaultSeason={lastSeason}
      mapImage={mapImage}
      currentUserId={me.user?.id ?? null}
    />
  );
}
