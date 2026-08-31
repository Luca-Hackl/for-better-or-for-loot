"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TacticalMap } from "@/components/tactical-map";
import { createLocation } from "@/lib/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { LocationRow } from "@/lib/types";
import { Check, X, Loader2 } from "lucide-react";

/**
 * Map for picking a drop zone: tap an existing pin, or click empty space to
 * drop a new named marker at that spot (created + auto-selected). Used in Play
 * mode and anywhere a drop needs to be chosen on the map.
 */
export function MapPicker({
  locations,
  selectedId,
  onSelect,
  label,
  backgroundUrl,
  aspectRatio,
}: {
  locations: LocationRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  label?: string | null;
  backgroundUrl?: string | null;
  aspectRatio?: number | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [name, setName] = useState("");
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    setPending(null);
    setName("");
    setError(null);
  }
  function create() {
    if (!pending || !name.trim()) return;
    start(async () => {
      setError(null);
      try {
        const id = await createLocation({ name: name.trim(), pos_x: pending.x, pos_y: pending.y });
        cancel();
        onSelect(id); // select the freshly-placed marker
        router.refresh(); // pull the new pin into the map
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add marker");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <TacticalMap
          locations={locations}
          mode="select"
          selectedId={selectedId}
          onSelect={onSelect}
          onCreateAt={(x, y) => {
            setName("");
            setError(null);
            setPending({ x, y });
          }}
          label={label}
          backgroundUrl={backgroundUrl}
          aspectRatio={aspectRatio}
        />
        {pending ? (
          <div
            className="absolute z-40 flex -translate-x-1/2 flex-col gap-1"
            style={{ left: `${pending.x * 100}%`, top: `${pending.y * 100}%` }}
          >
            <span className="mx-auto h-3 w-3 rounded-full bg-primary" style={{ boxShadow: "0 0 10px #ff3b4e" }} />
            <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1.5 shadow-lg">
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") create();
                  if (e.key === "Escape") cancel();
                }}
                placeholder="Name this spot"
                className="h-8 w-36"
              />
              <Button size="icon" className="h-8 w-8" disabled={busy || !name.trim()} onClick={create}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cancel} disabled={busy}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <p className="text-[11px] text-muted">
        Tap a pin, or click an empty spot to drop a new marker.
      </p>
      {error ? <p className="text-xs text-loss">{error}</p> : null}
    </div>
  );
}
