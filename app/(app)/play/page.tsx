import { getPlayers, getLocations, getMatches, getMapImage } from "@/lib/data";
import { PlayMode } from "@/components/play-mode";

export const metadata = { title: "Play mode — RedSec Ranked" };

export default async function PlayPage() {
  const [players, locations, recent, mapImage] = await Promise.all([
    getPlayers(),
    getLocations(),
    getMatches({ limit: 20 }),
    getMapImage(),
  ]);
  const lastSeason = recent.find((m) => m.season)?.season ?? "S4";

  return (
    <PlayMode
      players={players}
      locations={locations}
      defaultSeason={lastSeason}
      mapImage={mapImage}
    />
  );
}
