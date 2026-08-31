"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePlayer, claimPlayer, createPlayer, deletePlayer } from "@/lib/actions";
import type { Player } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { PLAYER_COLORS } from "@/lib/ranks";
import { Loader2, Check, UserCheck, Trash2, UserPlus } from "lucide-react";

const MAX_PLAYERS = 4;

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
        <PlayerRow key={p.id} player={p} isMe={p.id === currentPlayerId} canDelete={players.length > 1} />
      ))}
      {players.length < MAX_PLAYERS ? <AddPlayerCard existing={players.length} /> : null}
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      {PLAYER_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="h-7 w-7 rounded-full transition-transform hover:scale-110"
          style={{ backgroundColor: c, boxShadow: value === c ? `0 0 0 2px ${c}` : undefined }}
          aria-label={c}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent"
      />
    </div>
  );
}

function PlayerRow({
  player,
  isMe,
  canDelete,
}: {
  player: Player;
  isMe: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(player.display_name);
  const [eaId, setEaId] = useState(player.ea_id ?? "");
  const [platform, setPlatform] = useState(player.platform ?? "pc");
  const [colorVal, setColorVal] = useState(player.color ?? PLAYER_COLORS[0]);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

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
              onClick={() =>
                start(async () => {
                  await claimPlayer(player.id);
                  router.refresh();
                })
              }
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
          <ColorPicker value={colorVal} onChange={setColorVal} />
        </div>

        {error ? <p className="text-xs text-loss">{error}</p> : null}

        <div className="flex items-center gap-2">
          <Button
            size="sm"
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

          {canDelete ? (
            confirmDel ? (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[11px] text-muted">Delete + all their matches?</span>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDel(false)} disabled={pending}>
                  No
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      try {
                        await deletePlayer(player.id);
                        router.refresh();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Failed");
                        setConfirmDel(false);
                      }
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setConfirmDel(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function AddPlayerCard({ existing }: { existing: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [colorVal, setColorVal] = useState(PLAYER_COLORS[existing % PLAYER_COLORS.length]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[8rem] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong text-muted transition-colors hover:bg-card-hover hover:text-foreground"
      >
        <UserPlus className="h-6 w-6" />
        <span className="text-sm font-medium">Add squadmate</span>
      </button>
    );
  }

  return (
    <Card style={{ borderColor: `${colorVal}44` }}>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="flex flex-col gap-1.5">
          <Label>Display name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Squadmate" autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Accent color</Label>
          <ColorPicker value={colorVal} onChange={setColorVal} />
        </div>
        {error ? <p className="text-xs text-loss">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={pending || !name.trim()}
            onClick={() =>
              start(async () => {
                setError(null);
                try {
                  await createPlayer({ display_name: name.trim(), color: colorVal });
                  setName("");
                  setOpen(false);
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed");
                }
              })
            }
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
