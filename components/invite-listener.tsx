"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { subscribeToInvites } from "@/lib/supabase/realtime";
import { acceptInvite, declineInvite } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Radio, Loader2 } from "lucide-react";

type Invite = { match_id: string; host: string | null };

/** Always-on listener for live-match invites addressed to the signed-in player. */
export function InviteListener({ playerId }: { playerId: string }) {
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("match_players")
      .select("match_id, matches!inner(status, host_player_id, players:host_player_id(display_name))")
      .eq("player_id", playerId)
      .is("joined_at", null)
      .eq("matches.status", "live");
    const rows = (data as unknown as { match_id: string; matches: { players: { display_name: string } | null } }[]) ?? [];
    setInvites(rows.map((r) => ({ match_id: r.match_id, host: r.matches?.players?.display_name ?? null })));
  }, [playerId]);

  useEffect(() => {
    load();
    const cleanup = subscribeToInvites(playerId, load);
    return cleanup;
  }, [playerId, load]);

  if (invites.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[90] w-[min(92vw,26rem)] -translate-x-1/2">
      {invites.map((inv) => (
        <div
          key={inv.match_id}
          className="mb-2 flex items-center gap-3 rounded-xl border border-primary/40 bg-card/95 p-3 shadow-2xl backdrop-blur glow-primary"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Radio className="h-5 w-5 animate-pulse" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Live match invite</p>
            <p className="truncate text-xs text-muted">
              {inv.host ? `${inv.host} wants you in the squad` : "Join the squad"}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy === inv.match_id}
            onClick={async () => {
              setBusy(inv.match_id);
              try {
                await declineInvite(inv.match_id);
                await load();
              } finally {
                setBusy(null);
              }
            }}
          >
            Dismiss
          </Button>
          <Button
            size="sm"
            disabled={busy === inv.match_id}
            onClick={async () => {
              setBusy(inv.match_id);
              try {
                await acceptInvite(inv.match_id);
                router.push(`/play/live/${inv.match_id}`);
                router.refresh();
              } catch {
                setBusy(null);
              }
            }}
          >
            {busy === inv.match_id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Accept
          </Button>
        </div>
      ))}
    </div>
  );
}
