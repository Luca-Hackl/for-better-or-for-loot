"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertMyStats } from "@/lib/actions";
import type { MatchPlayer, Player } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Crown, Loader2, Check, UserCog } from "lucide-react";

const numOrNull = (s: string) => {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Lets the signed-in user enter/update THEIR OWN stat line for a match. */
export function MyStatsPanel({
  matchId,
  me,
  existing,
}: {
  matchId: string;
  me: Player;
  existing: MatchPlayer | null;
}) {
  const router = useRouter();
  const [kills, setKills] = useState(existing ? String(existing.kills) : "");
  const [assists, setAssists] = useState(existing ? String(existing.assists) : "");
  const [deaths, setDeaths] = useState(existing ? String(existing.deaths) : "");
  const [revives, setRevives] = useState(existing?.revives != null ? String(existing.revives) : "");
  const [damage, setDamage] = useState(existing?.damage != null ? String(existing.damage) : "");
  const [mvp, setMvp] = useState(existing?.was_mvp ?? false);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="mt-4" style={{ borderColor: `${me.color ?? "#2b3340"}55` }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="h-4 w-4 text-accent" />
          {existing ? "Your stats" : "Enter your stats"}
          <span className="ml-1 inline-flex items-center gap-1 text-xs font-normal text-muted">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: me.color ?? "#8b95a7" }} />
            {me.display_name}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <Num label="Kills" value={kills} onChange={setKills} />
          <Num label="Assists" value={assists} onChange={setAssists} />
          <Num label="Deaths" value={deaths} onChange={setDeaths} />
          <Num label="Revives" value={revives} onChange={setRevives} />
          <Num label="Damage" value={damage} onChange={setDamage} />
        </div>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMvp((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition-colors",
              mvp ? "border-warn/40 bg-warn/20 text-warn" : "border-transparent text-muted hover:bg-card-hover",
            )}
          >
            <Crown className="h-3.5 w-3.5" /> MVP
          </button>
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                setSaved(false);
                try {
                  await upsertMyStats({
                    match_id: matchId,
                    kills: numOrNull(kills) ?? 0,
                    assists: numOrNull(assists) ?? 0,
                    deaths: numOrNull(deaths) ?? 0,
                    revives: numOrNull(revives),
                    damage: numOrNull(damage),
                    was_mvp: mvp,
                  });
                  setSaved(true);
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed to save");
                }
              })
            }
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
            {saved ? "Saved" : existing ? "Update" : "Save my stats"}
          </Button>
        </div>
        {error ? <p className="text-xs text-loss">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

function Num({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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
