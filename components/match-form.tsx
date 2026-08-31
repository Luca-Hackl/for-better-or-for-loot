"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createMatch, type MatchInput } from "@/lib/actions";
import { compressImage } from "@/lib/image";
import type { LocationRow, Player, MapImage } from "@/lib/types";
import { TacticalMap } from "@/components/tactical-map";
import { RpFields, type RpValue } from "@/components/rp-fields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Loader2, Trophy, ImageUp, Crown, Users, MapPin, Check, Lock } from "lucide-react";

type LineState = { kills: string; assists: string; deaths: string; revives: string; damage: string; was_mvp: boolean };
type JumpState = { key: string; kind: "initial_drop" | "second_chance" | "respawn"; x: number | null; y: number | null; who: string[] };

const MODES = [
  { value: "ranked_quads", label: "Ranked Quads", squads: 25 },
  { value: "quads", label: "Casual Quads", squads: 25 },
  { value: "duos", label: "Duos", squads: 50 },
  { value: "gauntlet", label: "Gauntlet", squads: 8 },
] as const;
const JUMP_KINDS = [
  { value: "initial_drop", label: "Initial drop" },
  { value: "second_chance", label: "Second Chance" },
  { value: "respawn", label: "Respawn" },
] as const;

const emptyLine = (): LineState => ({ kills: "", assists: "", deaths: "", revives: "", damage: "", was_mvp: false });
function nowLocalInput(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
const numOrNull = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
let jumpSeq = 0;

export function MatchForm({
  players,
  locations,
  seasons,
  defaultSeason,
  mapImage,
  currentUserId,
  myPlayerId,
  latestRp,
}: {
  players: Player[];
  locations: LocationRow[];
  seasons: string[];
  defaultSeason: string;
  mapImage?: MapImage | null;
  currentUserId?: string | null;
  myPlayerId?: string | null;
  latestRp?: number | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [playedAt, setPlayedAt] = useState(nowLocalInput());
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("ranked_quads");
  const [season, setSeason] = useState(defaultSeason);
  const [placement, setPlacement] = useState("");
  const [totalSquads, setTotalSquads] = useState("");
  const [myRp, setMyRp] = useState<RpValue | null>(null);

  const [squad, setSquad] = useState<string[]>(players.map((p) => p.id));
  const [stats, setStats] = useState<Record<string, LineState>>(Object.fromEntries(players.map((p) => [p.id, emptyLine()])));
  const [jumps, setJumps] = useState<JumpState[]>([{ key: `j${jumpSeq++}`, kind: "initial_drop", x: null, y: null, who: [] }]);
  const [activeJump, setActiveJump] = useState<string>(jumps[0].key);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRanked = mode === "ranked_quads";
  const modeSquads = MODES.find((m) => m.value === mode)?.squads;
  const nameOf = (id: string) => players.find((p) => p.id === id)?.display_name ?? "Player";
  const colorOf = (id: string) => players.find((p) => p.id === id)?.color ?? "#8b95a7";
  const lockedByOther = (id: string) => {
    const p = players.find((x) => x.id === id);
    return !!p?.auth_user_id && p.auth_user_id !== currentUserId;
  };
  const iAmInSquad = !!myPlayerId && squad.includes(myPlayerId);

  function setLine(id: string, patch: Partial<LineState>) {
    setStats((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }
  function toggleMvp(id: string) {
    setStats((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, was_mvp: k === id ? !v.was_mvp : false }])));
  }
  const toggleSquad = (id: string) => setSquad((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const setPoint = (x: number, y: number) => setJumps((p) => p.map((j) => (j.key === activeJump ? { ...j, x, y } : j)));
  const addJump = () => {
    const key = `j${jumpSeq++}`;
    setJumps((p) => [...p, { key, kind: "respawn", x: null, y: null, who: [] }]);
    setActiveJump(key);
  };
  const removeJump = (key: string) =>
    setJumps((p) => {
      const next = p.filter((j) => j.key !== key);
      if (activeJump === key && next.length) setActiveJump(next[next.length - 1].key);
      return next.length ? next : p;
    });
  const setJumpKind = (key: string, kind: JumpState["kind"]) => setJumps((p) => p.map((j) => (j.key === key ? { ...j, kind } : j)));
  const toggleWho = (key: string, pid: string) =>
    setJumps((p) => p.map((j) => (j.key === key ? { ...j, who: j.who.includes(pid) ? j.who.filter((x) => x !== pid) : [...j.who, pid] } : j)));
  const setWholeSquad = (key: string) => setJumps((p) => p.map((j) => (j.key === key ? { ...j, who: [] } : j)));

  const points = jumps
    .filter((j) => j.x != null && j.y != null)
    .map((j, i) => ({
      id: j.key,
      x: j.x as number,
      y: j.y as number,
      selected: j.key === activeJump,
      color: j.kind === "initial_drop" ? "#ff3b4e" : "#35d0e0",
      label: String(jumps.findIndex((x) => x.key === j.key) + 1 || i + 1),
    }));
  const activeObj = jumps.find((j) => j.key === activeJump) ?? jumps[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (squad.length === 0) throw new Error("Pick at least one player for the squad.");
      let screenshotUrl: string | null = null;
      if (file) {
        const { file: img } = await compressImage(file, { maxDim: 1600, quality: 0.8 });
        const ext = img.name.split(".").pop() || "webp";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("screenshots").upload(path, img, { upsert: false, contentType: img.type });
        if (upErr) throw new Error(`Screenshot upload failed: ${upErr.message}`);
        screenshotUrl = supabase.storage.from("screenshots").getPublicUrl(path).data.publicUrl;
      }

      const jumpRows: NonNullable<MatchInput["jumps"]> = [];
      jumps
        .filter((j) => j.x != null && j.y != null)
        .forEach((j, idx) => {
          const targets = j.who.filter((id) => squad.includes(id));
          const base = { pos_x: j.x as number, pos_y: j.y as number, jump_order: idx + 1, kind: j.kind };
          if (targets.length === 0) jumpRows.push({ ...base, player_id: null });
          else targets.forEach((pid) => jumpRows.push({ ...base, player_id: pid }));
        });

      const payload: MatchInput = {
        played_at: new Date(playedAt).toISOString(),
        season: season || null,
        mode,
        is_ranked: isRanked,
        map: "Fort Lyndon",
        placement: numOrNull(placement),
        total_squads: numOrNull(totalSquads) ?? modeSquads ?? null,
        screenshot_url: screenshotUrl,
        notes: notes || null,
        players: squad.map((id) => {
          const base = {
            player_id: id,
            kills: numOrNull(stats[id].kills) ?? 0,
            assists: numOrNull(stats[id].assists) ?? 0,
            deaths: numOrNull(stats[id].deaths) ?? 0,
            revives: numOrNull(stats[id].revives),
            damage: numOrNull(stats[id].damage),
            was_mvp: stats[id].was_mvp,
          };
          if (id === myPlayerId) {
            return {
              ...base,
              rp_before: myRp?.rp_before ?? null,
              rp_after: myRp?.rp_after ?? null,
              rp_delta: myRp?.rp_delta ?? null,
              rank_tier: isRanked ? myRp?.rank_tier ?? null : null,
              rank_division: isRanked ? myRp?.rank_division ?? null : null,
            };
          }
          return base;
        }),
        jumps: jumpRows,
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
      <Card>
        <CardHeader>
          <CardTitle>Match</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Played at">
            <Input type="datetime-local" value={playedAt} onChange={(e) => setPlayedAt(e.target.value)} required />
          </Field>
          <Field label="Mode">
            <Select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Season">
            <Input list="seasons" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="S4" />
            <datalist id="seasons">
              {seasons.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Placement">
              <Input type="number" min={1} value={placement} onChange={(e) => setPlacement(e.target.value)} placeholder="1" />
            </Field>
            <Field label="of squads">
              <Input type="number" min={1} value={totalSquads} onChange={(e) => setTotalSquads(e.target.value)} placeholder={modeSquads ? String(modeSquads) : "25"} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {isRanked && iAmInSquad ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-warn" /> Your RP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RpFields latestRp={latestRp ?? null} initial={myRp ?? undefined} onChange={setMyRp} />
          </CardContent>
        </Card>
      ) : null}

      {/* Squad */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Squad
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {players.map((p) => {
              const on = squad.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleSquad(p.id)}
                  className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium", on ? "text-foreground" : "border-border text-muted-foreground hover:bg-card-hover")}
                  style={on ? { borderColor: p.color ?? "#8b95a7", backgroundColor: `${p.color ?? "#8b95a7"}1e` } : undefined}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color ?? "#8b95a7" }} />
                  {p.display_name}
                  {on ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                </button>
              );
            })}
            {players.length === 0 ? <p className="text-sm text-muted">Add players in Settings first.</p> : null}
          </div>

          {squad.map((id) => {
            const locked = lockedByOther(id);
            return (
              <div key={id} className="rounded-lg border border-border bg-surface/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorOf(id) }} />
                    {nameOf(id)}
                  </span>
                  <button type="button" disabled={locked} onClick={() => toggleMvp(id)} className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold disabled:opacity-40", stats[id].was_mvp ? "border-warn/40 bg-warn/20 text-warn" : "border-transparent text-muted hover:bg-card-hover")}>
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
        </CardContent>
      </Card>

      {/* Drops & respawns — marker-less */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> Drops &amp; respawns
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs text-muted">Select a step, then tap anywhere on the map to mark it.</p>
          <TacticalMap
            locations={[]}
            mode="select"
            points={points}
            onCreateAt={setPoint}
            label={`Placing step ${(jumps.findIndex((j) => j.key === activeJump) + 1) || 1}`}
            backgroundUrl={mapImage?.url ?? null}
            aspectRatio={mapImage ? mapImage.width / mapImage.height : undefined}
          />
          <div className="flex flex-col gap-2">
            {jumps.map((j, idx) => {
              const active = j.key === activeJump;
              return (
                <div key={j.key} className={cn("rounded-lg border bg-surface/50 p-3", active ? "border-primary/60" : "border-border")} onClick={() => setActiveJump(j.key)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-xs font-bold text-muted">{idx + 1}</span>
                    <Select value={j.kind} onClick={(e) => e.stopPropagation()} onChange={(e) => setJumpKind(j.key, e.target.value as JumpState["kind"])} className="h-8 w-40">
                      {JUMP_KINDS.map((k) => (
                        <option key={k.value} value={k.value}>{k.label}</option>
                      ))}
                    </Select>
                    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm", j.x != null ? "bg-primary/15 text-primary" : "bg-card-hover text-muted")}>
                      <MapPin className="h-3.5 w-3.5" />
                      {j.x != null ? "Placed" : active ? "Tap the map…" : "No spot"}
                    </span>
                    {jumps.length > 1 ? (
                      <button type="button" onClick={(e) => { e.stopPropagation(); removeJump(j.key); }} className="ml-auto text-muted hover:text-loss">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  {squad.length > 0 ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] uppercase tracking-wider text-muted">Who:</span>
                      <WhoChip label="Whole squad" active={j.who.length === 0} onClick={() => setWholeSquad(j.key)} />
                      {squad.map((id) => (
                        <WhoChip key={id} label={nameOf(id)} color={colorOf(id)} active={j.who.includes(id)} onClick={() => toggleWho(j.key, id)} />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addJump} className="self-start">
            <Plus className="h-4 w-4" /> Add respawn / redeploy
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evidence &amp; notes</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>End-of-round screenshot (optional)</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border-strong bg-surface px-3 py-2 text-sm text-muted hover:bg-card-hover">
              <ImageUp className="h-4 w-4" />
              {file ? file.name : "Attach a screenshot — compressed automatically"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Rotations, clutch moments, what to do differently…" />
          </Field>
        </CardContent>
      </Card>

      {error ? <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p> : null}

      <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-lg border border-border bg-card/90 p-3 backdrop-blur">
        <Button type="button" variant="ghost" onClick={() => router.push("/matches")} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || squad.length === 0}>
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
function NumField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px]">{label}</Label>
      <Input type="number" min={0} inputMode="numeric" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder="0" className="h-9 px-2 text-center disabled:opacity-40" />
    </div>
  );
}
function WhoChip({ label, color, active, onClick }: { label: string; color?: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", active ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted hover:bg-card-hover")}>
      {color ? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /> : null}
      {label}
    </button>
  );
}
