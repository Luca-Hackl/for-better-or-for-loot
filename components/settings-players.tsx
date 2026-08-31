"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePlayer, claimPlayer } from "@/lib/actions";
import type { Player } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { PLAYER_COLORS } from "@/lib/ranks";
import { Loader2, Check, UserCheck } from "lucide-react";

export function SettingsPlayers({
  players,
  currentPlayerId,
}: {
  players: Player[];
  currentPlayerId: string | null;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {players.map((p) => (
        <PlayerRow key={p.id} player={p} isMe={p.id === currentPlayerId} />
      ))}
    </div>
  );
}

function PlayerRow({ player, isMe }: { player: Player; isMe: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(player.display_name);
  const [eaId, setEaId] = useState(player.ea_id ?? "");
  const [platform, setPlatform] = useState(player.platform ?? "pc");
  const [colorVal, setColorVal] = useState(player.color ?? PLAYER_COLORS[0]);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card style={{ borderColor: `${colorVal}44` }}>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colorVal }} />
          <span className="text-sm font-semibold">{player.display_name}</span>
          {isMe ? (
            <span className="ml-auto inline-flex items-center gap-1 rounded bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
              <UserCheck className="h-3 w-3" /> You
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => start(async () => {
                await claimPlayer(player.id);
                router.refresh();
              })}
            >
              This is me
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Display name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>EA ID</Label>
            <Input value={eaId} onChange={(e) => setEaId(e.target.value)} placeholder="gamertag" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Platform</Label>
            <Select value={platform} onChange={(e) => setPlatform(e.target.value as "pc" | "xbl" | "psn")}>
              <option value="pc">PC</option>
              <option value="xbl">Xbox</option>
              <option value="psn">PlayStation</option>
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Accent color</Label>
          <div className="flex items-center gap-2">
            {PLAYER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColorVal(c)}
                className="h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-card transition-transform hover:scale-110"
                style={{ backgroundColor: c, boxShadow: colorVal === c ? `0 0 0 2px ${c}` : undefined }}
                aria-label={c}
              />
            ))}
            <input
              type="color"
              value={colorVal}
              onChange={(e) => setColorVal(e.target.value)}
              className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent"
            />
          </div>
        </div>

        {error ? <p className="text-xs text-loss">{error}</p> : null}
        <Button
          size="sm"
          className="self-start"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              setSaved(false);
              try {
                await updatePlayer({
                  id: player.id,
                  display_name: name,
                  ea_id: eaId || null,
                  platform: platform as Player["platform"],
                  color: colorVal,
                });
                setSaved(true);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Failed");
              }
            })
          }
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saved ? "Saved" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
