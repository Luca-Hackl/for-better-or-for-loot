"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LiveMatch } from "@/lib/data";
import type { MatchEvent, MatchPlayer, Player } from "@/lib/types";
import { subscribeToMatch } from "@/lib/supabase/realtime";
import { logLiveEvent, updateLiveStat, finishLiveMatch } from "@/lib/actions";
import { TacticalMap } from "@/components/tactical-map";
import { NumStepper } from "@/components/num-stepper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { fireConfetti } from "@/lib/confetti";
import { cn } from "@/lib/utils";
import { Timer, Crosshair, Skull, Square, ScrollText, Users, Flag, Loader2, X, Radio } from "lucide-react";

type Line = MatchPlayer & { players: Player | null };

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function LiveMatch({
  initial,
  meId,
  isHost,
  mapImage,
}: {
  initial: LiveMatch;
  meId: string | null;
  isHost: boolean;
  mapImage: { url: string; width: number; height: number } | null;
}) {
  const router = useRouter();
  const startedAt = initial.started_at ? new Date(initial.started_at).getTime() : Date.now();

  const [lines, setLines] = useState<Record<string, Line>>(
    Object.fromEntries(initial.match_players.map((l) => [l.player_id, l])),
  );
  const [events, setEvents] = useState<MatchEvent[]>(
    [...initial.match_events].sort((a, b) => a.at_seconds - b.at_seconds || a.created_at.localeCompare(b.created_at)),
  );
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);
  const [pendingDeath, setPendingDeath] = useState<string | null>(null); // death_event_id awaiting respawn
  const [showRespawn, setShowRespawn] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [placement, setPlacement] = useState("");
  const [totalSquads, setTotalSquads] = useState("");
  const [busy, setBusy] = useState(false);
  const seen = useRef<Set<string>>(new Set(initial.match_events.map((e) => e.client_event_id)));

  const elapsed = useMemo(() => Math.max(0, Math.floor((Date.now() - startedAt) / 1000)), [startedAt, tick]);
  const nameOf = (id: string | null) => (id ? lines[id]?.players?.display_name ?? "Player" : "Squad");
  const colorOf = (id: string | null) => (id ? lines[id]?.players?.color ?? "#8b95a7" : "#8b95a7");
  const myLine = meId ? lines[meId] : null;

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const cleanup = subscribeToMatch(initial.id, {
      presenceKey: meId ?? undefined,
      onPlayer: (row) =>
        setLines((prev) => ({
          ...prev,
          [row.player_id]: { ...(prev[row.player_id] ?? ({} as Line)), ...row, players: prev[row.player_id]?.players ?? null },
        })),
      onEvent: (row) => {
        if (seen.current.has(row.client_event_id)) return;
        seen.current.add(row.client_event_id);
        setEvents((prev) =>
          [...prev, row].sort((a, b) => a.at_seconds - b.at_seconds || a.created_at.localeCompare(b.created_at)),
        );
      },
      onMatch: (row) => {
        if (row.status === "final") {
          router.push(`/matches/${initial.id}`);
          router.refresh();
        }
      },
      onPresence: (state) => {
        const keys = new Set<string>();
        for (const k of Object.keys(state)) keys.add(k);
        setOnline(keys);
      },
    });
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id, meId]);

  /* ---- my live controls ---- */
  function bumpMyStat(field: "kills" | "assists" | "deaths", value: number) {
    if (!meId) return;
    setLines((prev) => ({ ...prev, [meId]: { ...prev[meId], [field]: value } }));
    updateLiveStat({ match_id: initial.id, [field]: value }).catch(() => {});
  }
  function logKill() {
    if (!meId) return;
    const next = (myLine?.kills ?? 0) + 1;
    bumpMyStat("kills", next);
    logLiveEvent({ match_id: initial.id, kind: "kill", at_seconds: elapsed, client_event_id: crypto.randomUUID() }).catch(() => {});
  }
  async function logDeath() {
    if (!meId) return;
    bumpMyStat("deaths", (myLine?.deaths ?? 0) + 1);
    try {
      const id = await logLiveEvent({ match_id: initial.id, kind: "death", at_seconds: elapsed, client_event_id: crypto.randomUUID() });
      setPendingDeath(id);
      setShowRespawn(true);
    } catch {
      /* ignore */
    }
  }
  function placeRespawn(x: number, y: number) {
    logLiveEvent({
      match_id: initial.id,
      kind: "respawn",
      at_seconds: elapsed,
      client_event_id: crypto.randomUUID(),
      pos_x: x,
      pos_y: y,
      death_event_id: pendingDeath,
    }).catch(() => {});
    setShowRespawn(false);
    setPendingDeath(null);
  }

  async function finish() {
    setBusy(true);
    try {
      const won = Number(placement) === 1;
      await finishLiveMatch({
        match_id: initial.id,
        placement: placement ? Number(placement) : null,
        total_squads: totalSquads ? Number(totalSquads) : null,
      });
      if (won) fireConfetti({ particleCount: 200, colors: ["#ffcc33", "#ff3b4e", "#ffffff"] });
      router.push(`/matches/${initial.id}`);
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  const roster = Object.values(lines).sort((a, b) => (a.player_id === meId ? -1 : b.player_id === meId ? 1 : 0));

  return (
    <div className="mx-auto max-w-2xl">
      {/* respawn map sheet */}
      {showRespawn ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">Where did you respawn?</span>
              <button onClick={() => { setShowRespawn(false); setPendingDeath(null); }} className="text-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <TacticalMap
              locations={[]}
              mode="select"
              onCreateAt={placeRespawn}
              label="Tap your respawn point"
              backgroundUrl={mapImage?.url ?? null}
              aspectRatio={mapImage ? mapImage.width / mapImage.height : undefined}
            />
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setShowRespawn(false); setPendingDeath(null); }}>
              Stayed down (final)
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Radio className="h-5 w-5 animate-pulse" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Live match</h1>
            <p className="text-xs text-muted">Everyone&apos;s stats sync in real time.</p>
          </div>
        </div>
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Timer className="h-4 w-4 text-win" />
          <span className="tnum text-lg">{mmss(elapsed)}</span>
        </span>
      </div>

      {/* my controls */}
      {meId ? (
        <Card className="mb-4">
          <CardContent className="flex flex-wrap items-center gap-2 py-3">
            <Button size="sm" variant="outline" onClick={logKill} className="border-win/50 text-win hover:bg-win/15">
              <Crosshair className="h-4 w-4" /> Kill +1
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => bumpMyStat("assists", (myLine?.assists ?? 0) + 1)}
              className="border-accent/50 text-accent hover:bg-accent/15"
            >
              +1 Assist
            </Button>
            <Button size="sm" variant="danger" onClick={logDeath}>
              <Skull className="h-4 w-4" /> I died
            </Button>
            <span className="ml-auto text-xs text-muted">
              You: <span className="tnum text-foreground">{myLine?.kills ?? 0}</span>/
              {myLine?.assists ?? 0}/{myLine?.deaths ?? 0}
            </span>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-4">
          <CardContent className="py-3 text-sm text-muted">
            Claim your player in Settings to log your own stats live.
          </CardContent>
        </Card>
      )}

      {/* roster (live) */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Squad
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {roster.map((l) => {
            const mine = l.player_id === meId;
            const joined = !!l.joined_at;
            return (
              <div key={l.player_id} className={cn("rounded-lg border p-3", mine ? "border-primary/50" : "border-border bg-surface/50")}>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorOf(l.player_id) }} />
                  {l.players?.display_name ?? "Player"}
                  {mine ? <span className="text-[11px] font-normal text-primary">you</span> : null}
                  {online.has(l.player_id) ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-win"><span className="h-1.5 w-1.5 rounded-full bg-win" /> online</span>
                  ) : !joined ? (
                    <span className="text-[10px] text-muted-foreground">invited…</span>
                  ) : null}
                </div>
                {mine ? (
                  <div className="grid grid-cols-3 gap-2">
                    <NumStepper label="Kills" value={String(l.kills ?? 0)} onChange={(v) => bumpMyStat("kills", Math.max(0, parseInt(v || "0", 10)))} accent="#ff3b4e" />
                    <NumStepper label="Assists" value={String(l.assists ?? 0)} onChange={(v) => bumpMyStat("assists", Math.max(0, parseInt(v || "0", 10)))} />
                    <NumStepper label="Deaths" value={String(l.deaths ?? 0)} onChange={(v) => bumpMyStat("deaths", Math.max(0, parseInt(v || "0", 10)))} />
                  </div>
                ) : (
                  <div className="tnum flex items-center gap-4 text-sm">
                    <span><span className="font-bold text-foreground">{l.kills ?? 0}</span> <span className="text-muted">K</span></span>
                    <span><span className="font-bold text-foreground">{l.assists ?? 0}</span> <span className="text-muted">A</span></span>
                    <span><span className="font-bold text-foreground">{l.deaths ?? 0}</span> <span className="text-muted">D</span></span>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* shared game-log */}
      {events.length > 0 ? (
        <Card className="mb-4">
          <CardContent className="py-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <ScrollText className="h-3.5 w-3.5" /> Game log
            </div>
            <ul className="flex max-h-56 flex-col gap-1 overflow-auto">
              {[...events].reverse().map((ev) => (
                <li key={ev.id} className="flex items-center gap-2 text-sm">
                  <span className="tnum w-10 shrink-0 text-muted-foreground">{mmss(ev.at_seconds)}</span>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorOf(ev.player_id) }} />
                  <span className="text-foreground">{nameOf(ev.player_id)}</span>
                  {ev.kind === "kill" ? <span className="text-win">got a kill</span>
                    : ev.kind === "death" ? <span className="text-loss">went down</span>
                    : ev.kind === "respawn" ? <span className="text-accent">respawned</span>
                    : ev.kind === "join" ? <span className="text-muted">joined</span>
                    : ev.kind === "stop" ? <span className="text-muted">— match ended</span>
                    : <span className="text-muted">dropped in</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* host finish */}
      {isHost ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-warn" /> Finish match
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {finishing ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Placement</Label>
                    <Input type="number" min={1} value={placement} onChange={(e) => setPlacement(e.target.value)} placeholder="1" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>of squads</Label>
                    <Input type="number" min={1} value={totalSquads} onChange={(e) => setTotalSquads(e.target.value)} placeholder="25" />
                  </div>
                </div>
                <p className="text-[11px] text-muted">
                  Everyone keeps their own kills/deaths. Enter your RP on the match page afterward.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setFinishing(false)} disabled={busy}>Cancel</Button>
                  <Button size="sm" onClick={finish} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />} Finish &amp; save
                  </Button>
                </div>
              </>
            ) : (
              <Button onClick={() => setFinishing(true)}>
                <Square className="h-4 w-4" /> End the match
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <p className="text-center text-xs text-muted">The host ends the match when you extract or wipe.</p>
      )}
    </div>
  );
}
