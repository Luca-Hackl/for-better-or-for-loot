"use client";

import { createClient } from "@/lib/supabase/client";
import type { MatchEvent, MatchPlayer, MatchRow } from "@/lib/types";

type PresenceState = Record<string, unknown>;

/**
 * Subscribe to one live match: stat-line changes, new game-log events, the
 * status flip (host finishes), and who's-online presence. Returns a cleanup fn.
 * postgres_changes replays committed rows through RLS, so the DB stays the
 * single source of truth. (Realtime is browser-only; call from useEffect.)
 */
export function subscribeToMatch(
  matchId: string,
  handlers: {
    onPlayer?: (row: MatchPlayer) => void;
    onEvent?: (row: MatchEvent) => void;
    onMatch?: (row: MatchRow) => void;
    onPresence?: (state: PresenceState) => void;
    presenceKey?: string;
  },
) {
  const supabase = createClient();
  const channel = supabase.channel(`match:${matchId}`, {
    config: handlers.presenceKey ? { presence: { key: handlers.presenceKey } } : {},
  });

  channel.on(
    "postgres_changes",
    { event: "*", schema: "public", table: "match_players", filter: `match_id=eq.${matchId}` },
    (payload) => handlers.onPlayer?.(payload.new as MatchPlayer),
  );
  channel.on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` },
    (payload) => handlers.onEvent?.(payload.new as MatchEvent),
  );
  channel.on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
    (payload) => handlers.onMatch?.(payload.new as MatchRow),
  );
  if (handlers.onPresence) {
    channel.on("presence", { event: "sync" }, () => handlers.onPresence?.(channel.presenceState()));
  }

  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED" && handlers.presenceKey) {
      await channel.track({ online_at: new Date().toISOString() });
    }
  });

  return () => {
    supabase.removeChannel(channel);
  };
}

/** Watch for live-match invites/updates addressed to this player. */
export function subscribeToInvites(playerId: string, onChange: () => void) {
  const supabase = createClient();
  const channel = supabase
    .channel(`invites:${playerId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "match_players", filter: `player_id=eq.${playerId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
