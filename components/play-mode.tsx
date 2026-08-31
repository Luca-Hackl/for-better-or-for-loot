"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createMatch, type MatchInput } from "@/lib/actions";
import { compressImage } from "@/lib/image";
import type { LocationRow, Player, MapImage } from "@/lib/types";
import { TIERS, TIER_MAP, ROMAN } from "@/lib/ranks";
import { MapPicker } from "@/components/map-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { cn, fmtDelta } from "@/lib/utils";
import {
  Users,
  MapPin,
  Trophy,
  Crown,
  ImageUp,
  Plus,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Play,
  RotateCcw,
  Lock,
} from "lucide-react";

type LineState = {
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
  who: string[];
};

const MODES = [
  { value: "ranked_quads", label: "Ranked Quads", squads: 25 },
  { value: "quads", label: "Casual Quads", squads: 25 },
  { value: "duos", label: "Duos", squads: 50 },
  { value: "gauntlet", label: "Gauntlet", squads: 8 },
] as const;
const JUMP_KINDS = [
  { value: "second_chance", label: "Second Chance" },
  { value: "respawn", label: "Respawn" },
] as const;
const STEPS = ["Setup", "Drop", "Respawns", "Result", "Scoreboard", "Finish"];
const DRAFT_KEY = "redsec:play-draft-v1";

const emptyLine = (): LineState => ({
  kills: "",
  assists: "",
  deaths: "",
  revives: "",
  damage: "",
  was_mvp: false,
});
function numOrNull(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
let seq = 0;
const newKey = () => `j${seq++}`;

export function PlayMode({
  players,
  locations,
  defaultSeason,
  mapImage,
  currentUserId,
}: {
  players: Player[];
  locations: LocationRow[];
  defaultSeason: string;
  mapImage: MapImage | null;
  currentUserId?: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("ranked_quads");
  const [season, setSeason] = useState(defaultSeason);
  const [squad, setSquad] = useState<string[]>(players.map((p) => p.id));
  const [stats, setStats] = useState<Record<string, LineState>>(
    Object.fromEntries(players.map((p) => [p.id, emptyLine()])),
  );
  const [jumps, setJumps] = useState<JumpState[]>([
    { key: newKey(), location_id: "", kind: "initial_drop", who: [] },
  ]);
  const [activeJump, setActiveJump] = useState<string>(jumps[0].key);
  const [placement, setPlacement] = useState("");
  const [totalSquads, setTotalSquads] = useState("");
  const [rpStart, setRpStart] = useState("");
  const [rpEnd, setRpEnd] = useState("");
  const [rpDelta, setRpDelta] = useState("");
  const [deltaTouched, setDeltaTouched] = useState(false);
  const [rankTier, setRankTier] = useState("");
  const [rankDivision, setRankDivision] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [restored, setRestored] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRanked = mode === "ranked_quads";
  const modeSquads = MODES.find((m) => m.value === mode)?.squads;
  const nameOf = (id: string) => players.find((p) => p.id === id)?.display_name ?? "Player";
  const colorOf = (id: string) => players.find((p) => p.id === id)?.color ?? "#8b95a7";
  const locName = (id: string) => locations.find((l) => l.id === id)?.name;
  const lockedByOther = (id: string) => {
    const p = players.find((x) => x.id === id);
    return !!p?.auth_user_id && p.auth_user_id !== currentUserId;
  };
  const initialJump = jumps[0];
  const respawns = jumps.slice(1);

  const autoDelta = useMemo(() => {
    const s = numOrNull(rpStart);
    const e = numOrNull(rpEnd);
    return s != null && e != null ? e - s : null;
  }, [rpStart, rpEnd]);
  const effectiveDelta = deltaTouched ? numOrNull(rpDelta) : (autoDelta ?? numOrNull(rpDelta));

  /* ---- draft persistence (survives an accidental refresh mid-game) ---- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        const valid = new Set(players.map((p) => p.id));
        if (d.mode) setMode(d.mode);
        if (typeof d.season === "string") setSeason(d.season);
        if (Array.isArray(d.squad)) setSquad(d.squad.filter((id: string) => valid.has(id)));
        if (d.stats && typeof d.stats === "object") {
          setStats((prev) => {
            const merged = { ...prev };
            for (const id of Object.keys(d.stats)) if (valid.has(id)) merged[id] = { ...emptyLine(), ...d.stats[id] };
            return merged;
          });
        }
        if (Array.isArray(d.jumps) && d.jumps.length) {
          setJumps(d.jumps);
          setActiveJump(d.jumps[0].key);
        }
        setPlacement(d.placement ?? "");
        setTotalSquads(d.totalSquads ?? "");
        setRpStart(d.rpStart ?? "");
        setRpEnd(d.rpEnd ?? "");
        setRpDelta(d.rpDelta ?? "");
        setDeltaTouched(!!d.deltaTouched);
        setRankTier(d.rankTier ?? "");
        setRankDivision(d.rankDivision ?? "");
        setNotes(d.notes ?? "");
        setRestored(true);
      }
    } catch {
      /* ignore corrupt draft */
    }
    // players list is stable within a session; run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const d = {
      mode,
      season,
      squad,
      stats,
      jumps,
      placement,
      totalSquads,
      rpStart,
      rpEnd,
      rpDelta,
      deltaTouched,
      rankTier,
      rankDivision,
      notes,
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {
      /* quota / private mode — ignore */
    }
  }, [mode, season, squad, stats, jumps, placement, totalSquads, rpStart, rpEnd, rpDelta, deltaTouched, rankTier, rankDivision, notes]);

  // keep the map bound to the right step
  useEffect(() => {
    if (step === 1) setActiveJump(initialJump.key);
    else if (step === 2 && respawns.length) setActiveJump(respawns[respawns.length - 1].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function discard() {
    localStorage.removeItem(DRAFT_KEY);
    setMode("ranked_quads");
    setSeason(defaultSeason);
    setSquad(players.map((p) => p.id));
    setStats(Object.fromEntries(players.map((p) => [p.id, emptyLine()])));
    const k = newKey();
    setJumps([{ key: k, location_id: "", kind: "initial_drop", who: [] }]);
    setActiveJump(k);
    setPlacement("");
    setTotalSquads("");
    setRpStart("");
    setRpEnd("");
    setRpDelta("");
    setDeltaTouched(false);
    setRankTier("");
    setRankDivision("");
    setNotes("");
    setFile(null);
    setRestored(false);
    setStep(0);
  }

  /* ---- mutators ---- */
  const toggleSquad = (id: string) =>
    setSquad((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const setLine = (id: string, patch: Partial<LineState>) =>
    setStats((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const toggleMvp = (id: string) =>
    setStats((prev) =>
      Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, was_mvp: k === id ? !v.was_mvp : false }])),
    );
  const pickLocation = (locationId: string) =>
    setJumps((prev) => prev.map((j) => (j.key === activeJump ? { ...j, location_id: locationId } : j)));
  const addRespawn = () => {
    const key = newKey();
    setJumps((prev) => [...prev, { key, location_id: "", kind: "respawn", who: [] }]);
    setActiveJump(key);
  };
  const removeJump = (key: string) =>
    setJumps((prev) => {
      const next = prev.filter((j) => j.key !== key);
      if (activeJump === key && next.length) setActiveJump(next[next.length - 1].key);
      return next.length ? next : prev;
    });
  const setJumpKind = (key: string, kind: JumpState["kind"]) =>
    setJumps((prev) => prev.map((j) => (j.key === key ? { ...j, kind } : j)));
  const toggleWho = (key: string, pid: string) =>
    setJumps((prev) =>
      prev.map((j) =>
        j.key === key
          ? { ...j, who: j.who.includes(pid) ? j.who.filter((x) => x !== pid) : [...j.who, pid] }
          : j,
      ),
    );
  const setWholeSquad = (key: string) =>
    setJumps((prev) => prev.map((j) => (j.key === key ? { ...j, who: [] } : j)));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (squad.length === 0) throw new Error("Pick at least one player for the squad.");
      let screenshotUrl: string | null = null;
      if (file) {
        const { file: img } = await compressImage(file, { maxDim: 1600, quality: 0.8 });
        const ext = img.name.split(".").pop() || "webp";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("screenshots")
          .upload(path, img, { upsert: false, contentType: img.type });
        if (upErr) throw new Error(`Screenshot upload failed: ${upErr.message}`);
        screenshotUrl = supabase.storage.from("screenshots").getPublicUrl(path).data.publicUrl;
      }
      const jumpRows: NonNullable<MatchInput["jumps"]> = [];
      jumps
        .filter((j) => j.location_id)
        .forEach((j, idx) => {
          const targets = j.who.filter((id) => squad.includes(id));
          if (targets.length === 0) {
            jumpRows.push({ location_id: j.location_id, jump_order: idx + 1, kind: j.kind, player_id: null });
          } else {
            targets.forEach((pid) =>
              jumpRows.push({ location_id: j.location_id, jump_order: idx + 1, kind: j.kind, player_id: pid }),
            );
          }
        });
      const payload: MatchInput = {
        played_at: new Date().toISOString(),
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
        players: squad.map((id) => ({
          player_id: id,
          kills: numOrNull(stats[id].kills) ?? 0,
          assists: numOrNull(stats[id].assists) ?? 0,
          deaths: numOrNull(stats[id].deaths) ?? 0,
          revives: numOrNull(stats[id].revives),
          damage: numOrNull(stats[id].damage),
          was_mvp: stats[id].was_mvp,
        })),
        jumps: jumpRows,
      };
      const id = await createMatch(payload);
      localStorage.removeItem(DRAFT_KEY);
      router.push(`/matches/${id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSaving(false);
    }
  }

  const activeObj = jumps.find((j) => j.key === activeJump) ?? jumps[0];
  const bg = { backgroundUrl: mapImage?.url ?? null, aspectRatio: mapImage ? mapImage.width / mapImage.height : undefined };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Play className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Play mode</h1>
            <p className="text-xs text-muted">Log it live, step by step. Progress auto-saves.</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={discard} title="Start over">
          <RotateCcw className="h-4 w-4" /> Reset
        </Button>
      </div>

      {restored ? (
        <p className="mb-3 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
          Picked up your in-progress match. Use “Reset” to start fresh.
        </p>
      ) : null}

      {/* Stepper */}
      <div className="mb-5 flex items-center gap-1">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(i)}
            className="flex flex-1 flex-col items-center gap-1"
          >
            <span
              className={cn(
                "h-1.5 w-full rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-border",
              )}
            />
            <span className={cn("text-[10px]", i === step ? "text-foreground" : "text-muted")}>{s}</span>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* STEP 0 — Setup */}
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
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
                  <Input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="S4" />
                </Field>
              </div>
              <div>
                <Label>Who’s in the squad?</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {players.map((p) => {
                    const on = squad.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleSquad(p.id)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                          on ? "text-foreground" : "border-border text-muted-foreground hover:bg-card-hover",
                        )}
                        style={on ? { borderColor: p.color ?? "#8b95a7", backgroundColor: `${p.color ?? "#8b95a7"}1e` } : undefined}
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color ?? "#8b95a7" }} />
                        {p.display_name}
                        {on ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 1 — Drop */}
          {step === 1 && (
            <div className="flex flex-col gap-3">
              <SectionTitle icon={<MapPin className="h-4 w-4 text-primary" />}>Where did you drop?</SectionTitle>
              <MapPicker
                locations={locations}
                selectedId={initialJump.location_id || null}
                onSelect={pickLocation}
                label={initialJump.location_id ? locName(initialJump.location_id) ?? null : "Tap or click to drop"}
                {...bg}
              />
              <WhoRow squad={squad} who={initialJump.who} nameOf={nameOf} colorOf={colorOf} onWhole={() => setWholeSquad(initialJump.key)} onToggle={(id) => toggleWho(initialJump.key, id)} />
            </div>
          )}

          {/* STEP 2 — Respawns */}
          {step === 2 && (
            <div className="flex flex-col gap-3">
              <SectionTitle icon={<RotateCcw className="h-4 w-4 text-accent" />}>Redeploys &amp; respawns (optional)</SectionTitle>
              {respawns.length > 0 ? (
                <MapPicker
                  locations={locations}
                  selectedId={activeObj?.location_id || null}
                  onSelect={pickLocation}
                  label="Placing respawn — tap or click the map"
                  {...bg}
                />
              ) : (
                <p className="text-sm text-muted">No respawns yet. Add one when a squadmate redeployed.</p>
              )}
              <div className="flex flex-col gap-2">
                {respawns.map((j) => {
                  const active = j.key === activeJump;
                  return (
                    <div
                      key={j.key}
                      className={cn("rounded-lg border p-2", active ? "border-primary/60" : "border-border")}
                      onClick={() => setActiveJump(j.key)}
                    >
                      <div className="flex items-center gap-2">
                        <Select
                          value={j.kind}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setJumpKind(j.key, e.target.value as JumpState["kind"])}
                          className="h-8 w-40"
                        >
                          {JUMP_KINDS.map((k) => (
                            <option key={k.value} value={k.value}>
                              {k.label}
                            </option>
                          ))}
                        </Select>
                        <span className={cn("inline-flex items-center gap-1 rounded px-2 py-1 text-sm", j.location_id ? "bg-primary/15 text-primary" : "bg-card-hover text-muted")}>
                          <MapPin className="h-3.5 w-3.5" />
                          {j.location_id ? locName(j.location_id) : active ? "Tap the map" : "No spot"}
                        </span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); removeJump(j.key); }} className="ml-auto text-muted hover:text-loss">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <WhoRow squad={squad} who={j.who} nameOf={nameOf} colorOf={colorOf} onWhole={() => setWholeSquad(j.key)} onToggle={(id) => toggleWho(j.key, id)} />
                    </div>
                  );
                })}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addRespawn} className="self-start">
                <Plus className="h-4 w-4" /> Add respawn / redeploy
              </Button>
            </div>
          )}

          {/* STEP 3 — Result */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <SectionTitle icon={<Trophy className="h-4 w-4 text-warn" />}>How did it end?</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Placement">
                  <Input type="number" min={1} value={placement} onChange={(e) => setPlacement(e.target.value)} placeholder="1" />
                </Field>
                <Field label="of squads">
                  <Input type="number" min={1} value={totalSquads} onChange={(e) => setTotalSquads(e.target.value)} placeholder={modeSquads ? String(modeSquads) : "25"} />
                </Field>
              </div>
              {isRanked && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="RP before">
                    <Input type="number" value={rpStart} onChange={(e) => setRpStart(e.target.value)} placeholder="3800" />
                  </Field>
                  <Field label="RP after">
                    <Input type="number" value={rpEnd} onChange={(e) => setRpEnd(e.target.value)} placeholder="3842" />
                  </Field>
                  <Field label="RP change">
                    <Input
                      type="number"
                      value={deltaTouched ? rpDelta : autoDelta != null ? String(autoDelta) : rpDelta}
                      onChange={(e) => { setDeltaTouched(true); setRpDelta(e.target.value); }}
                      placeholder={autoDelta != null ? fmtDelta(autoDelta) : "+42"}
                      className={effectiveDelta != null ? (effectiveDelta > 0 ? "text-win" : effectiveDelta < 0 ? "text-loss" : "") : ""}
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
                </div>
              )}
            </div>
          )}

          {/* STEP 4 — Scoreboard */}
          {step === 4 && (
            <div className="flex flex-col gap-3">
              <SectionTitle icon={<Users className="h-4 w-4" />}>Scoreboard</SectionTitle>
              {squad.map((id) => {
                const locked = lockedByOther(id);
                return (
                <div key={id} className="rounded-lg border border-border bg-surface/50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorOf(id) }} />
                      {nameOf(id)}
                    </span>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => toggleMvp(id)}
                      className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold disabled:opacity-40", stats[id].was_mvp ? "border-warn/40 bg-warn/20 text-warn" : "border-transparent text-muted hover:bg-card-hover")}
                    >
                      <Crown className="h-3.5 w-3.5" /> MVP
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    <NumField label="Kills" value={stats[id].kills} onChange={(v) => setLine(id, { kills: v })} disabled={locked} />
                    <NumField label="Assists" value={stats[id].assists} onChange={(v) => setLine(id, { assists: v })} disabled={locked} />
                    <NumField label="Deaths" value={stats[id].deaths} onChange={(v) => setLine(id, { deaths: v })} disabled={locked} />
                    <NumField label="Revives" value={stats[id].revives} onChange={(v) => setLine(id, { revives: v })} disabled={locked} />
                    <NumField label="Damage" value={stats[id].damage} onChange={(v) => setLine(id, { damage: v })} disabled={locked} />
                  </div>
                  {locked ? (
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-muted">
                      <Lock className="h-3 w-3" /> Only {nameOf(id)} can enter their stats — they add them from the match afterward.
                    </p>
                  ) : null}
                </div>
                );
              })}
              {squad.length === 0 ? <p className="text-sm text-muted">Pick your squad back in step 1.</p> : null}
            </div>
          )}

          {/* STEP 5 — Finish */}
          {step === 5 && (
            <div className="flex flex-col gap-4">
              <SectionTitle icon={<Check className="h-4 w-4 text-win" />}>Review &amp; save</SectionTitle>
              <div className="rounded-lg border border-border bg-surface/50 p-3 text-sm">
                <p className="text-muted">
                  {MODES.find((m) => m.value === mode)?.label} · {season} ·{" "}
                  {placement ? `#${placement}` : "no placement"}
                  {isRanked && effectiveDelta != null ? ` · ${fmtDelta(effectiveDelta)} RP` : ""}
                </p>
                <p className="mt-1 text-muted">
                  Drop: {initialJump.location_id ? locName(initialJump.location_id) : "—"}
                  {respawns.length ? ` · +${respawns.length} respawn(s)` : ""}
                </p>
                <p className="mt-1 text-muted">
                  Squad: {squad.map(nameOf).join(", ") || "—"}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>End-of-round screenshot (optional)</Label>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border-strong bg-surface px-3 py-2 text-sm text-muted hover:bg-card-hover">
                  <ImageUp className="h-4 w-4" />
                  {file ? file.name : "Attach a screenshot — compressed automatically"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              <Field label="Notes">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Clutch moments, what to do differently…" />
              </Field>
              {error ? <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p> : null}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nav */}
      <div className="mt-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || saving}>
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={save} disabled={saving || squad.length === 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Saving…" : "Save match"}
          </Button>
        )}
      </div>
    </div>
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
function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold">
      {icon}
      {children}
    </h2>
  );
}
function NumField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px]">{label}</Label>
      <Input type="number" min={0} inputMode="numeric" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder="0" className="h-9 px-2 text-center disabled:opacity-40" />
    </div>
  );
}
function WhoRow({
  squad,
  who,
  nameOf,
  colorOf,
  onWhole,
  onToggle,
}: {
  squad: string[];
  who: string[];
  nameOf: (id: string) => string;
  colorOf: (id: string) => string;
  onWhole: () => void;
  onToggle: (id: string) => void;
}) {
  if (squad.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted">Who:</span>
      <Chip label="Whole squad" active={who.length === 0} onClick={onWhole} />
      {squad.map((id) => (
        <Chip key={id} label={nameOf(id)} color={colorOf(id)} active={who.includes(id)} onClick={() => onToggle(id)} />
      ))}
    </div>
  );
}
function Chip({ label, color, active, onClick }: { label: string; color?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
        active ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted hover:bg-card-hover",
      )}
    >
      {color ? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /> : null}
      {label}
    </button>
  );
}
