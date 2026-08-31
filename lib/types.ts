/**
 * Hand-written Supabase schema types (kept in sync with supabase/migrations).
 * Enough shape for the typed client; regenerate with `supabase gen types` later
 * if the schema grows.
 */

export type Platform = "pc" | "xbl" | "psn";
export type MatchMode = "ranked_quads" | "quads" | "duos" | "gauntlet";
export type JumpKind = "initial_drop" | "second_chance" | "respawn";
export type OcrSource = "manual" | "ocr";

export type Player = {
  id: string;
  display_name: string;
  ea_id: string | null;
  platform: Platform | null;
  color: string | null;
  avatar_url: string | null;
  auth_user_id: string | null;
  created_at: string;
};

export type LocationRow = {
  id: string;
  name: string;
  description: string | null;
  map: string;
  pos_x: number | null;
  pos_y: number | null;
  is_hot_drop: boolean;
  created_at: string;
};

export type LocationFeedback = {
  id: string;
  location_id: string;
  author_player_id: string | null;
  rating: number | null;
  loot_quality: number | null;
  note: string | null;
  created_at: string;
};

export type MatchStatus = "live" | "final";
export type LiveEventKind = "start" | "kill" | "death" | "respawn" | "join" | "stop";

export type MatchRow = {
  id: string;
  played_at: string;
  season: string | null;
  mode: MatchMode;
  is_ranked: boolean;
  map: string;
  placement: number | null;
  total_squads: number | null;
  won: boolean | null;
  rp_start: number | null;
  rp_end: number | null;
  rp_delta: number | null;
  rank_tier: string | null;
  rank_division: number | null;
  screenshot_url: string | null;
  ocr_source: OcrSource;
  ocr_confidence: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  status: MatchStatus;
  host_player_id: string | null;
  started_at: string | null;
  ended_at: string | null;
};

export type MatchPlayer = {
  id: string;
  match_id: string;
  player_id: string;
  kills: number;
  assists: number;
  deaths: number;
  revives: number | null;
  damage: number | null;
  was_mvp: boolean;
  rp_before: number | null;
  rp_after: number | null;
  rp_delta: number | null;
  rank_tier: string | null;
  rank_division: number | null;
  death_times: number[];
  time_seconds: number | null;
  joined_at: string | null;
  invited_by: string | null;
};

export type MatchEvent = {
  id: string;
  match_id: string;
  player_id: string | null;
  kind: LiveEventKind;
  at_seconds: number;
  pos_x: number | null;
  pos_y: number | null;
  death_event_id: string | null;
  client_event_id: string;
  meta: Record<string, unknown>;
  created_at: string;
};

export type MatchJump = {
  id: string;
  match_id: string;
  location_id: string | null;
  pos_x: number | null;
  pos_y: number | null;
  jump_order: number;
  kind: JumpKind;
  player_id: string | null;
  note: string | null;
};

/* ---- read-only view rows ---- */

export type LocationStat = {
  location_id: string;
  name: string;
  games: number;
  wins: number;
  win_rate: number;
  avg_placement: number | null;
  avg_rp_delta: number | null;
  avg_kills: number | null;
};

export type PlayerStat = {
  player_id: string;
  display_name: string;
  color: string | null;
  games: number;
  kills: number;
  assists: number;
  deaths: number;
  revives: number;
  kd: number;
  avg_kills: number;
  avg_assists: number;
  avg_deaths: number;
  mvps: number;
};

export type RpTimelinePoint = {
  player_id: string;
  match_id: string;
  played_at: string;
  season: string | null;
  rp_delta: number | null;
  rp_end: number | null;
  running_rp: number;
  rank_tier: string | null;
  rank_division: number | null;
};

export type SeasonSummary = {
  season: string | null;
  games: number;
  wins: number;
  win_rate: number;
  net_rp: number;
  avg_rp_delta: number | null;
  best_placement: number | null;
};

/** app_settings KV row + the shape stored under key 'map_image'. */
export type AppSettingRow = {
  key: string;
  value: unknown;
  updated_at: string;
};

export type MapImage = {
  url: string;
  width: number;
  height: number;
};

type Tbl<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type ViewT<Row> = {
  Row: Row;
  Relationships: [];
};

type Empty = { [_ in never]: never };

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      players: Tbl<Player>;
      locations: Tbl<LocationRow>;
      location_feedback: Tbl<LocationFeedback>;
      matches: Tbl<MatchRow>;
      match_players: Tbl<MatchPlayer>;
      match_jumps: Tbl<MatchJump>;
      match_events: Tbl<MatchEvent>;
      allowed_emails: Tbl<{ email: string }>;
      app_settings: Tbl<AppSettingRow>;
    };
    Views: {
      location_stats: ViewT<LocationStat>;
      player_stats: ViewT<PlayerStat>;
      rp_timeline: ViewT<RpTimelinePoint>;
      season_summary: ViewT<SeasonSummary>;
    };
    Functions: {
      finish_live_match: {
        Args: { m_id: string; p_placement: number | null; p_total: number | null; p_notes: string | null };
        Returns: undefined;
      };
    };
    Enums: Empty;
    CompositeTypes: Empty;
  };
};
