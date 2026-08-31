"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PLAYER_COLORS } from "@/lib/ranks";
import type { Platform } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/* -------------------------------------------------------------------------- */
/* Matches                                                                    */
/* -------------------------------------------------------------------------- */

const playerLineSchema = z.object({
  player_id: z.string().uuid(),
  kills: z.coerce.number().int().min(0).default(0),
  assists: z.coerce.number().int().min(0).default(0),
  deaths: z.coerce.number().int().min(0).default(0),
  revives: z.coerce.number().int().min(0).nullable().optional(),
  damage: z.coerce.number().int().min(0).nullable().optional(),
  was_mvp: z.boolean().default(false),
});

const jumpSchema = z.object({
  location_id: z.string().uuid(),
  jump_order: z.coerce.number().int().min(1).default(1),
  kind: z.enum(["initial_drop", "second_chance", "respawn"]).default("initial_drop"),
  player_id: z.string().uuid().nullable().optional(),
  note: z.string().max(300).nullable().optional(),
});

const matchSchema = z.object({
  played_at: z.string(),
  season: z.string().nullable().optional(),
  mode: z.enum(["ranked_quads", "quads", "duos", "gauntlet"]),
  is_ranked: z.boolean(),
  map: z.string().default("Fort Lyndon"),
  placement: z.coerce.number().int().min(1).nullable().optional(),
  total_squads: z.coerce.number().int().min(1).nullable().optional(),
  rp_start: z.coerce.number().int().nullable().optional(),
  rp_end: z.coerce.number().int().nullable().optional(),
  rp_delta: z.coerce.number().int().nullable().optional(),
  rank_tier: z.string().nullable().optional(),
  rank_division: z.coerce.number().int().min(1).max(5).nullable().optional(),
  screenshot_url: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  players: z.array(playerLineSchema).min(1),
  jumps: z.array(jumpSchema).default([]),
});

export type MatchInput = z.input<typeof matchSchema>;

export async function createMatch(input: MatchInput) {
  const parsed = matchSchema.parse(input);
  const supabase = await createClient();

  // Resolve the acting player (for created_by) from the session, best-effort.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let createdBy: string | null = null;
  if (user) {
    const { data: me } = await supabase
      .from("players")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    createdBy = me?.id ?? null;
  }

  // Derive rp_delta if omitted but start/end known.
  let rpDelta = parsed.rp_delta ?? null;
  if (rpDelta == null && parsed.rp_start != null && parsed.rp_end != null) {
    rpDelta = parsed.rp_end - parsed.rp_start;
  }

  const { data: match, error } = await supabase
    .from("matches")
    .insert({
      played_at: parsed.played_at,
      season: parsed.season ?? null,
      mode: parsed.mode,
      is_ranked: parsed.is_ranked,
      map: parsed.map,
      placement: parsed.placement ?? null,
      total_squads: parsed.total_squads ?? null,
      rp_start: parsed.rp_start ?? null,
      rp_end: parsed.rp_end ?? null,
      rp_delta: rpDelta,
      rank_tier: parsed.rank_tier ?? null,
      rank_division: parsed.rank_division ?? null,
      screenshot_url: parsed.screenshot_url ?? null,
      ocr_source: "manual",
      notes: parsed.notes ?? null,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (error || !match) throw new Error(error?.message ?? "Failed to create match");

  const matchId = match.id;

  const playerRows = parsed.players.map((p) => ({
    match_id: matchId,
    player_id: p.player_id,
    kills: p.kills,
    assists: p.assists,
    deaths: p.deaths,
    revives: p.revives ?? null,
    damage: p.damage ?? null,
    was_mvp: p.was_mvp,
  }));
  const { error: mpErr } = await supabase.from("match_players").insert(playerRows);
  if (mpErr) throw new Error(mpErr.message);

  if (parsed.jumps.length > 0) {
    const jumpRows = parsed.jumps.map((j) => ({
      match_id: matchId,
      location_id: j.location_id,
      jump_order: j.jump_order,
      kind: j.kind,
      player_id: j.player_id ?? null,
      note: j.note ?? null,
    }));
    const { error: jErr } = await supabase.from("match_jumps").insert(jumpRows);
    if (jErr) throw new Error(jErr.message);
  }

  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath("/locations");
  revalidatePath("/head-to-head");
  return matchId;
}

export async function deleteMatch(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath("/locations");
  revalidatePath("/head-to-head");
}

/* -------------------------------------------------------------------------- */
/* Players (settings)                                                         */
/* -------------------------------------------------------------------------- */

const playerUpdateSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().min(1).max(40),
  ea_id: z.string().max(80).nullable().optional(),
  platform: z.enum(["pc", "xbl", "psn"]).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
});

export async function updatePlayer(input: z.input<typeof playerUpdateSchema>) {
  const parsed = playerUpdateSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase
    .from("players")
    .update({
      display_name: parsed.display_name,
      ea_id: parsed.ea_id || null,
      platform: (parsed.platform as Platform) ?? null,
      color: parsed.color || null,
    })
    .eq("id", parsed.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/head-to-head");
}

/** Link the currently signed-in auth user to a player row (self-identify). */
export async function claimPlayer(playerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  // Refuse to claim a profile already owned by someone else.
  const { data: target } = await supabase
    .from("players")
    .select("auth_user_id")
    .eq("id", playerId)
    .maybeSingle();
  if (target?.auth_user_id && target.auth_user_id !== user.id) {
    throw new Error("That player is already claimed by someone else.");
  }

  // clear any previous link for this user, then claim
  await supabase.from("players").update({ auth_user_id: null }).eq("auth_user_id", user.id);
  const { error } = await supabase
    .from("players")
    .update({ auth_user_id: user.id })
    .eq("id", playerId);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

const createPlayerSchema = z.object({
  display_name: z.string().min(1).max(40),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

/** Add a squadmate to the roster (RedSec Quads = 4 players max). */
export async function createPlayer(input: z.input<typeof createPlayerSchema>) {
  const parsed = createPlayerSchema.parse(input);
  const supabase = await createClient();
  const { count } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true });
  const n = count ?? 0;
  if (n >= 4) throw new Error("Roster is full (max 4 players).");
  const color = parsed.color ?? PLAYER_COLORS[n % PLAYER_COLORS.length];
  const { error } = await supabase
    .from("players")
    .insert({ display_name: parsed.display_name, color });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/head-to-head");
  revalidatePath("/matches/new");
}

/** Remove a player. Their per-match lines cascade-delete with them. */
export async function deletePlayer(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/head-to-head");
  revalidatePath("/matches/new");
}

const posSchema = z.object({
  id: z.string().uuid(),
  pos_x: z.number(),
  pos_y: z.number(),
});

/** Persist a drop-zone pin's map position (0..1 coords). */
export async function updateLocationPosition(input: z.input<typeof posSchema>) {
  const { id, pos_x, pos_y } = posSchema.parse(input);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const supabase = await createClient();
  const { error } = await supabase
    .from("locations")
    .update({ pos_x: clamp(pos_x), pos_y: clamp(pos_y) })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/locations");
  revalidatePath("/matches/new");
}

/* -------------------------------------------------------------------------- */
/* Map image (shared)                                                         */
/* -------------------------------------------------------------------------- */

const mapImageSchema = z.object({
  url: z.string().url(),
  width: z.coerce.number().int().positive(),
  height: z.coerce.number().int().positive(),
});

export async function setMapImage(input: z.input<typeof mapImageSchema>) {
  const parsed = mapImageSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").upsert(
    { key: "map_image", value: parsed, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/locations");
  revalidatePath("/matches/new");
}

export async function clearMapImage() {
  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").delete().eq("key", "map_image");
  if (error) throw new Error(error.message);
  revalidatePath("/locations");
  revalidatePath("/matches/new");
}

/* -------------------------------------------------------------------------- */
/* Locations & feedback                                                       */
/* -------------------------------------------------------------------------- */

const locationSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(300).nullable().optional(),
  is_hot_drop: z.boolean().default(false),
  pos_x: z.number().min(0).max(1).nullable().optional(),
  pos_y: z.number().min(0).max(1).nullable().optional(),
});

export async function createLocation(input: z.input<typeof locationSchema>) {
  const parsed = locationSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .insert({
      name: parsed.name,
      description: parsed.description ?? null,
      is_hot_drop: parsed.is_hot_drop,
      // When placed via a map click we store the exact spot; otherwise leave
      // NULL so the map lays the new pin out on a non-overlapping grid.
      pos_x: parsed.pos_x ?? null,
      pos_y: parsed.pos_y ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/locations");
  return data.id;
}

const feedbackSchema = z.object({
  location_id: z.string().uuid(),
  author_player_id: z.string().uuid().nullable().optional(),
  rating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  loot_quality: z.coerce.number().int().min(1).max(5).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export async function addLocationFeedback(input: z.input<typeof feedbackSchema>) {
  const parsed = feedbackSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("location_feedback").insert({
    location_id: parsed.location_id,
    author_player_id: parsed.author_player_id ?? null,
    rating: parsed.rating ?? null,
    loot_quality: parsed.loot_quality ?? null,
    note: parsed.note ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/locations");
  revalidatePath(`/locations/${parsed.location_id}`);
}
