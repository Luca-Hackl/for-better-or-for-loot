import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { InviteListener } from "@/components/invite-listener";
import { getCurrentUserAndPlayer } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, player } = await getCurrentUserAndPlayer();
  if (!user) redirect("/login");

  return (
    <AppShell email={user.email ?? null} playerName={player?.display_name ?? null}>
      {children}
      {player ? <InviteListener playerId={player.id} /> : null}
    </AppShell>
  );
}
