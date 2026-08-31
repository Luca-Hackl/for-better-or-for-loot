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
  LocationFeedback,
  MapImage,
} from "@/lib/types";

export type MatchWithDetails = MatchRow & {
  match_players: (MatchPlayer & { players: Player | null })[];
  match_jumps: (MatchJump & { locations: LocationRow | null })[];
};

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
  const { data } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as MatchWithDetails | null) ?? null;
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

export async function getRpTimeline(): Promise<RpTimelinePoint[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rp_timeline")
    .select("*")
    .order("played_at", { ascending: true });
  return (data as RpTimelinePoint[]) ?? [];
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
