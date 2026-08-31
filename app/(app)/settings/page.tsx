import { getPlayers, getCurrentUserAndPlayer } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsPlayers } from "@/components/settings-players";
import { Info } from "lucide-react";

export const metadata = { title: "Settings — RedSec Ranked" };

export default async function SettingsPage() {
  const [players, me] = await Promise.all([getPlayers(), getCurrentUserAndPlayer()]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted">
          Signed in as <span className="text-foreground">{me.user?.email}</span>
        </p>
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Players</h2>
      <SettingsPlayers players={players} currentPlayerId={me.player?.id ?? null} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-4 w-4 text-accent" /> Tips
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted">
          <p>
            • Set each player&apos;s <span className="text-foreground">EA ID</span> to auto-pull
            lifetime career stats on the Overview.
          </p>
          <p>
            • Hit <span className="text-foreground">&ldquo;This is me&rdquo;</span> so matches you
            log are attributed to you.
          </p>
          <p>
            • Accent colors flow through the charts, scoreboards, and the tactical map.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
