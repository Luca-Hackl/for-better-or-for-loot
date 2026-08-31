import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  Player,
  LocationRow,
  LocationStat,
  PlayerStat,
  RpTimelinePoint,
  SeasonSummary,
  MatchRow,
  MatchPlayer,
  MatchJump,
  MatchEvent,
  LocationFeedback,
  MapImage,
} from "@/lib/types";

export type MatchWithDetails = MatchRow & {
  match_players: (MatchPlayer & { players: Player | null })[];
  match_jumps: (MatchJump & { locations: LocationRow | null })[];
};

export type LiveMatch = MatchWithDetails & { match_events: MatchEvent[] };

const MATCH_SELECT =
  "*, match_players(*, players(*)), match_jumps(*, locations(*))";

export async function getCurrentUserAndPlayer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, player: null as Player | null };
  const { data: player } = await supabase
    .from("players")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  return { user, player: (player as Player | null) ?? null };
}

export async function getPlayers(): Promise<Player[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("players")
    .select("*")
    .order("created_at", { ascending: true });
  return (data as Player[]) ?? [];
}

export async function getLocations(): Promise<LocationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("locations")
    .select("*")
    .order("name", { ascending: true });
  return (data as LocationRow[]) ?? [];
}

export async function getLocation(id: string): Promise<LocationRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("locations").select("*").eq("id", id).maybeSingle();
  return (data as LocationRow | null) ?? null;
}

export async function getMatchesAtLocation(locationId: string): Promise<MatchWithDetails[]> {
  const supabase = await createClient();
  const { data: jumps } = await supabase
    .from("match_jumps")
    .select("match_id")
    .eq("location_id", locationId);
  const ids = Array.from(new Set((jumps ?? []).map((j) => j.match_id)));
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .in("id", ids)
    .order("played_at", { ascending: false });
  return (data as unknown as MatchWithDetails[]) ?? [];
}

export async function getMatches(opts?: {
  limit?: number;
  mode?: string;
  season?: string;
  rankedOnly?: boolean;
}): Promise<MatchWithDetails[]> {
  const supabase = await createClient();
  let q = supabase
    .from("matches")
    .select(MATCH_SELECT)
    .eq("status", "final")
    .order("played_at", { ascending: false });
  if (opts?.mode) q = q.eq("mode", opts.mode as MatchRow["mode"]);
  if (opts?.season) q = q.eq("season", opts.season);
  if (opts?.rankedOnly) q = q.eq("is_ranked", true);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data as unknown as MatchWithDetails[]) ?? [];
}

export async function getMatch(id: string): Promise<MatchWithDetails | null> {
  const supabase = await createClient();
  // Fetch the row + children separately so a nested-embed error can never
  // null out a real match (which would render a false 404).
  const { data: m } = await supabase.from("matches").select("*").eq("id", id).maybeSingle();
  if (!m) return null;
  const [{ data: mp }, { data: mj }] = await Promise.all([
    supabase.from("match_players").select("*, players(*)").eq("match_id", id),
    supabase.from("match_jumps").select("*, locations(*)").eq("match_id", id),
  ]);
  return {
    ...(m as MatchRow),
    match_players: (mp as unknown as MatchWithDetails["match_players"]) ?? [],
    match_jumps: (mj as unknown as MatchWithDetails["match_jumps"]) ?? [],
  };
}

/** A live match with its event log, for the realtime session view. */
export async function getLiveMatch(id: string): Promise<LiveMatch | null> {
  const supabase = await createClient();
  const { data: m } = await supabase.from("matches").select("*").eq("id", id).maybeSingle();
  if (!m) return null;
  const [{ data: mp }, { data: mj }, { data: ev }] = await Promise.all([
    supabase.from("match_players").select("*, players(*)").eq("match_id", id),
    supabase.from("match_jumps").select("*, locations(*)").eq("match_id", id),
    supabase.from("match_events").select("*").eq("match_id", id).order("at_seconds", { ascending: true }),
  ]);
  return {
    ...(m as MatchRow),
    match_players: (mp as unknown as MatchWithDetails["match_players"]) ?? [],
    match_jumps: (mj as unknown as MatchWithDetails["match_jumps"]) ?? [],
    match_events: (ev as unknown as MatchEvent[]) ?? [],
  };
}

/** Live matches this player has been invited to but not yet joined. */
export async function getMyPendingInvites(
  playerId: string,
): Promise<{ match_id: string; host_player_id: string | null; started_at: string | null }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("match_players")
    .select("match_id, matches!inner(id, status, host_player_id, started_at)")
    .eq("player_id", playerId)
    .is("joined_at", null)
    .eq("matches.status", "live");
  return (
    (data as unknown as { match_id: string; matches: { host_player_id: string | null; started_at: string | null } }[]) ?? []
  ).map((r) => ({ match_id: r.match_id, host_player_id: r.matches?.host_player_id ?? null, started_at: r.matches?.started_at ?? null }));
}

/** The live match this player is currently in (joined), if any — for resuming. */
export async function getActiveLiveMatchForPlayer(playerId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("match_players")
    .select("match_id, matches!inner(status)")
    .eq("player_id", playerId)
    .not("joined_at", "is", null)
    .eq("matches.status", "live")
    .limit(1)
    .maybeSingle();
  return (data as unknown as { match_id: string } | null)?.match_id ?? null;
}

export async function getLocationStats(): Promise<LocationStat[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("location_stats").select("*");
  return (data as LocationStat[]) ?? [];
}

export async function getPlayerStats(): Promise<PlayerStat[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("player_stats").select("*");
  return (data as PlayerStat[]) ?? [];
}

export async function getRpTimeline(playerId?: string): Promise<RpTimelinePoint[]> {
  const supabase = await createClient();
  let q = supabase.from("rp_timeline").select("*").order("played_at", { ascending: true });
  if (playerId) q = q.eq("player_id", playerId);
  const { data } = await q;
  return (data as RpTimelinePoint[]) ?? [];
}

/** The player's most recent running RP total (their "current RP"). */
export async function getLatestRp(
  playerId: string,
  opts?: { excludeMatchId?: string },
): Promise<number | null> {
  const supabase = await createClient();
  let q = supabase
    .from("rp_timeline")
    .select("running_rp, played_at, match_id")
    .eq("player_id", playerId);
  if (opts?.excludeMatchId) q = q.neq("match_id", opts.excludeMatchId);
  const { data } = await q.order("played_at", { ascending: false }).limit(1).maybeSingle();
  return (data?.running_rp as number | undefined) ?? null;
}

export async function getSeasonSummary(): Promise<SeasonSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("season_summary").select("*");
  return (data as SeasonSummary[]) ?? [];
}

export async function getLocationFeedback(
  locationId: string,
): Promise<(LocationFeedback & { players: Player | null })[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("location_feedback")
    .select("*, players(*)")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false });
  return (data as unknown as (LocationFeedback & { players: Player | null })[]) ?? [];
}

/** The single shared uploaded map image (or null if none set). */
export async function getMapImage(): Promise<MapImage | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "map_image")
    .maybeSingle();
  const v = (data?.value ?? null) as MapImage | null;
  if (v && typeof v.url === "string" && v.width > 0 && v.height > 0) return v;
  return null;
}
