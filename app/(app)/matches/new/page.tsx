import { getLocations, getPlayers, getMatches, getMapImage, getCurrentUserAndPlayer, getLatestRp } from "@/lib/data";
import { MatchForm } from "@/components/match-form";

export const metadata = { title: "Log a match — RedSec Ranked" };

export default async function NewMatchPage() {
  const [players, locations, recent, mapImage, me] = await Promise.all([
    getPlayers(),
    getLocations(),
    getMatches({ limit: 30 }),
    getMapImage(),
    getCurrentUserAndPlayer(),
  ]);
  const latestRp = me.player ? await getLatestRp(me.player.id) : null;

  const seasons = Array.from(
    new Set(recent.map((m) => m.season).filter(Boolean) as string[]),
  );
  const lastSeason = recent.find((m) => m.season)?.season ?? "S4";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Log a match</h1>
        <p className="text-sm text-muted">
          Enter it straight from the end-of-round screen. You can attach a screenshot now —
          auto-fill (OCR) can read it later.
        </p>
      </div>
      <MatchForm
        players={players}
        locations={locations}
        seasons={seasons}
        defaultSeason={lastSeason}
        mapImage={mapImage}
        currentUserId={me.user?.id ?? null}
        myPlayerId={me.player?.id ?? null}
        latestRp={latestRp}
      />
    </div>
  );
}
