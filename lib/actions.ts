"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
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
  // clear any previous link for this user, then claim
  await supabase.from("players").update({ auth_user_id: null }).eq("auth_user_id", user.id);
  const { error } = await supabase
    .from("players")
    .update({ auth_user_id: user.id })
    .eq("id", playerId);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

/* -------------------------------------------------------------------------- */
/* Locations & feedback                                                       */
/* -------------------------------------------------------------------------- */

const locationSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(300).nullable().optional(),
  is_hot_drop: z.boolean().default(false),
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
