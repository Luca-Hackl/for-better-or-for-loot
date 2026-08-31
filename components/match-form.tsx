"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createMatch, type MatchInput } from "@/lib/actions";
import type { LocationRow, Player } from "@/lib/types";
import { TIERS, TIER_MAP, ROMAN } from "@/lib/ranks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { fmtDelta } from "@/lib/utils";
import { Plus, Trash2, Loader2, Trophy, ImageUp, Crown } from "lucide-react";

type LineState = {
  player_id: string;
  kills: string;
  assists: string;
  deaths: string;
  revives: string;
  damage: string;
  was_mvp: boolean;
};

type JumpState = {
  key: string;
  location_id: string;
  kind: "initial_drop" | "second_chance" | "respawn";
  player_id: string;
  note: string;
};

const MODES = [
  { value: "ranked_quads", label: "Ranked Quads", squads: 25 },
  { value: "quads", label: "Casual Quads", squads: 25 },
  { value: "duos", label: "Duos", squads: 50 },
  { value: "gauntlet", label: "Gauntlet", squads: 8 },
] as const;

const JUMP_KINDS = [
  { value: "initial_drop", label: "Initial drop" },
  { value: "second_chance", label: "Second Chance redeploy" },
  { value: "respawn", label: "Respawn point" },
] as const;

function nowLocalInput(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function numOrNull(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

let jumpSeq = 0;

export function MatchForm({
  players,
  locations,
  seasons,
  defaultSeason,
}: {
  players: Player[];
  locations: LocationRow[];
  seasons: string[];
  defaultSeason: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [playedAt, setPlayedAt] = useState(nowLocalInput());
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("ranked_quads");
  const [season, setSeason] = useState(defaultSeason);
  const [placement, setPlacement] = useState("");
  const [totalSquads, setTotalSquads] = useState("");

  const [rpStart, setRpStart] = useState("");
  const [rpEnd, setRpEnd] = useState("");
  const [rpDelta, setRpDelta] = useState("");
  const [rankTier, setRankTier] = useState("");
  const [rankDivision, setRankDivision] = useState("");

  const [lines, setLines] = useState<LineState[]>(
    players.map((p) => ({
      player_id: p.id,
      kills: "",
      assists: "",
      deaths: "",
      revives: "",
      damage: "",
      was_mvp: false,
    })),
  );

  const [jumps, setJumps] = useState<JumpState[]>([
    { key: `j${jumpSeq++}`, location_id: "", kind: "initial_drop", player_id: "", note: "" },
  ]);

  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRanked = mode === "ranked_quads";
  const modeSquads = MODES.find((m) => m.value === mode)?.squads;

  // Auto RP delta from start/end unless the user typed one explicitly.
  const [deltaTouched, setDeltaTouched] = useState(false);
  const autoDelta = useMemo(() => {
    const s = numOrNull(rpStart);
    const e = numOrNull(rpEnd);
    return s != null && e != null ? e - s : null;
  }, [rpStart, rpEnd]);
  const effectiveDelta = deltaTouched ? numOrNull(rpDelta) : (autoDelta ?? numOrNull(rpDelta));

  function setLine(i: number, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function toggleMvp(i: number) {
    setLines((prev) => prev.map((l, idx) => ({ ...l, was_mvp: idx === i ? !l.was_mvp : false })));
  }
  function addJump() {
    setJumps((prev) => [
      ...prev,
      {
        key: `j${jumpSeq++}`,
        location_id: "",
        kind: prev.length === 0 ? "initial_drop" : "respawn",
        player_id: "",
        note: "",
      },
    ]);
  }
  function setJump(key: string, patch: Partial<JumpState>) {
    setJumps((prev) => prev.map((j) => (j.key === key ? { ...j, ...patch } : j)));
  }
  function removeJump(key: string) {
    setJumps((prev) => prev.filter((j) => j.key !== key));
  }

  const playerName = (id: string) => players.find((p) => p.id === id)?.display_name ?? "Player";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      let screenshotUrl: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "png";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("screenshots")
          .upload(path, file, { upsert: false });
        if (upErr) throw new Error(`Screenshot upload failed: ${upErr.message}`);
        screenshotUrl = supabase.storage.from("screenshots").getPublicUrl(path).data.publicUrl;
      }

      const payload: MatchInput = {
        played_at: new Date(playedAt).toISOString(),
        season: season || null,
        mode,
        is_ranked: isRanked,
        map: "Fort Lyndon",
        placement: numOrNull(placement),
        total_squads: numOrNull(totalSquads) ?? modeSquads ?? null,
        rp_start: isRanked ? numOrNull(rpStart) : null,
        rp_end: isRanked ? numOrNull(rpEnd) : null,
        rp_delta: isRanked ? effectiveDelta : null,
        rank_tier: isRanked ? rankTier || null : null,
        rank_division: isRanked ? numOrNull(rankDivision) : null,
        screenshot_url: screenshotUrl,
        notes: notes || null,
        players: lines.map((l) => ({
          player_id: l.player_id,
          kills: numOrNull(l.kills) ?? 0,
          assists: numOrNull(l.assists) ?? 0,
          deaths: numOrNull(l.deaths) ?? 0,
          revives: numOrNull(l.revives),
          damage: numOrNull(l.damage),
          was_mvp: l.was_mvp,
        })),
        jumps: jumps
          .filter((j) => j.location_id)
          .map((j, idx) => ({
            location_id: j.location_id,
            jump_order: idx + 1,
            kind: j.kind,
            player_id: j.player_id || null,
            note: j.note || null,
          })),
      };

      const id = await createMatch(payload);
      router.push(`/matches/${id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Match meta */}
      <Card>
        <CardHeader>
          <CardTitle>Match</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Played at">
            <Input
              type="datetime-local"
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              required
            />
          </Field>
          <Field label="Mode">
            <Select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Season">
            <Input
              list="seasons"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder="S4"
            />
            <datalist id="seasons">
              {seasons.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Placement">
              <Input
                type="number"
                min={1}
                value={placement}
                onChange={(e) => setPlacement(e.target.value)}
                placeholder="1"
              />
            </Field>
            <Field label="of squads">
              <Input
                type="number"
                min={1}
                value={totalSquads}
                onChange={(e) => setTotalSquads(e.target.value)}
                placeholder={modeSquads ? String(modeSquads) : "25"}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Rank & RP */}
      {isRanked && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-warn" /> Rank &amp; RP
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="RP before">
              <Input
                type="number"
                value={rpStart}
                onChange={(e) => setRpStart(e.target.value)}
                placeholder="e.g. 3800"
              />
            </Field>
            <Field label="RP after">
              <Input
                type="number"
                value={rpEnd}
                onChange={(e) => setRpEnd(e.target.value)}
                placeholder="e.g. 3842"
              />
            </Field>
            <Field label="RP change">
              <Input
                type="number"
                value={deltaTouched ? rpDelta : (autoDelta != null ? String(autoDelta) : rpDelta)}
                onChange={(e) => {
                  setDeltaTouched(true);
                  setRpDelta(e.target.value);
                }}
                placeholder={autoDelta != null ? fmtDelta(autoDelta) : "+42 / -30"}
                className={
                  effectiveDelta != null
                    ? effectiveDelta > 0
                      ? "text-win"
                      : effectiveDelta < 0
                        ? "text-loss"
                        : ""
                    : ""
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Tier">
                <Select value={rankTier} onChange={(e) => setRankTier(e.target.value)}>
                  <option value="">—</option>
                  {TIERS.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Div">
                <Select
                  value={rankDivision}
                  onChange={(e) => setRankDivision(e.target.value)}
                  disabled={!rankTier || (TIER_MAP[rankTier as keyof typeof TIER_MAP]?.divisions ?? 1) <= 1}
                >
                  <option value="">—</option>
                  {ROMAN.slice(1).map((r, i) => (
                    <option key={r} value={i + 1}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Squad scoreboard */}
      <Card>
        <CardHeader>
          <CardTitle>Squad</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {lines.map((l, i) => (
            <div key={l.player_id} className="rounded-lg border border-border bg-surface/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">{playerName(l.player_id)}</span>
                <button
                  type="button"
                  onClick={() => toggleMvp(i)}
                  className={
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors " +
                    (l.was_mvp
                      ? "bg-warn/20 text-warn border border-warn/40"
                      : "text-muted hover:bg-card-hover border border-transparent")
                  }
                >
                  <Crown className="h-3.5 w-3.5" /> MVP
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                <NumField label="Kills" value={l.kills} onChange={(v) => setLine(i, { kills: v })} />
                <NumField label="Assists" value={l.assists} onChange={(v) => setLine(i, { assists: v })} />
                <NumField label="Deaths" value={l.deaths} onChange={(v) => setLine(i, { deaths: v })} />
                <NumField label="Revives" value={l.revives} onChange={(v) => setLine(i, { revives: v })} />
                <NumField label="Damage" value={l.damage} onChange={(v) => setLine(i, { damage: v })} />
              </div>
            </div>
          ))}
          {lines.length === 0 && (
            <p className="text-sm text-muted">
              No players yet — add them in Settings first.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Jump / respawn locations */}
      <Card>
        <CardHeader>
          <CardTitle>Drop &amp; respawn locations</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {jumps.map((j) => (
            <div
              key={j.key}
              className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-surface/50 p-3 sm:grid-cols-[1.3fr_1fr_1fr_auto]"
            >
              <Select
                value={j.location_id}
                onChange={(e) => setJump(j.key, { location_id: e.target.value })}
              >
                <option value="">Select drop zone…</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </Select>
              <Select
                value={j.kind}
                onChange={(e) => setJump(j.key, { kind: e.target.value as JumpState["kind"] })}
              >
                {JUMP_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </Select>
              <Select
                value={j.player_id}
                onChange={(e) => setJump(j.key, { player_id: e.target.value })}
              >
                <option value="">Whole squad</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeJump(j.key)}
                title="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addJump} className="self-start">
            <Plus className="h-4 w-4" /> Add drop / respawn
          </Button>
        </CardContent>
      </Card>

      {/* Screenshot + notes */}
      <Card>
        <CardHeader>
          <CardTitle>Evidence &amp; notes</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>End-of-round screenshot (optional)</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border-strong bg-surface px-3 py-2 text-sm text-muted hover:bg-card-hover">
              <ImageUp className="h-4 w-4" />
              {file ? file.name : "Attach a screenshot — OCR can read it later"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <Field label="Notes">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How'd it go? Rotations, clutch moments, what to do differently…"
            />
          </Field>
        </CardContent>
      </Card>

      {error ? (
        <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-lg border border-border bg-card/90 p-3 backdrop-blur">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/matches")}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || lines.length === 0}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting ? "Saving…" : "Save match"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px]">{label}</Label>
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="h-9 px-2 text-center"
      />
    </div>
  );
}
