"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addLocationFeedback } from "@/lib/actions";
import type { Player } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/input";
import { Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function Stars({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? 0 : n)}
            className="p-0.5"
            aria-label={`${n} stars`}
          >
            <Star
              className={cn(
                "h-5 w-5 transition-colors",
                n <= value ? "fill-warn text-warn" : "text-border-strong",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function LocationFeedbackForm({
  locationId,
  players,
  currentPlayerId,
}: {
  locationId: string;
  players: Player[];
  currentPlayerId: string | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [loot, setLoot] = useState(0);
  const [note, setNote] = useState("");
  const [author, setAuthor] = useState(currentPlayerId ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-6">
        <Stars value={rating} onChange={setRating} label="Overall" />
        <Stars value={loot} onChange={setLoot} label="Loot quality" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Note</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Whole squad drop or split? Where's the loot? Rotations, common enemies…"
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>From</Label>
          <Select value={author} onChange={(e) => setAuthor(e.target.value)} className="w-44">
            <option value="">Anonymous</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </Select>
        </div>
        <Button
          disabled={pending || (rating === 0 && loot === 0 && !note.trim())}
          onClick={() =>
            start(async () => {
              setError(null);
              try {
                await addLocationFeedback({
                  location_id: locationId,
                  author_player_id: author || null,
                  rating: rating || null,
                  loot_quality: loot || null,
                  note: note.trim() || null,
                });
                setRating(0);
                setLoot(0);
                setNote("");
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Failed");
              }
            })
          }
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Post feedback
        </Button>
      </div>
      {error ? <p className="text-xs text-loss">{error}</p> : null}
    </div>
  );
}
