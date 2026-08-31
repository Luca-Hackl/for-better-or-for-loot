"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TacticalMap } from "@/components/tactical-map";
import { MapUploader } from "@/components/map-uploader";
import { updateLocationPosition, createLocation } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LocationRow, MapImage } from "@/lib/types";
import { Move, Check, Loader2, X, MapPinPlus } from "lucide-react";

type Pending = { x: number; y: number };

/** Locations map: tap a pin to open its intel; "Arrange pins" to drag them,
 *  upload a real background, or click empty space to drop a new marker. */
export function LocationsMap({
  locations,
  mapImage,
}: {
  locations: LocationRow[];
  mapImage: MapImage | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
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
        await createLocation({
          name: name.trim(),
          pos_x: pending.x,
          pos_y: pending.y,
        });
        cancel();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add marker");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <MapPinPlus className="h-3.5 w-3.5" /> Click empty space to add a marker · drag pins to move
          </span>
        ) : (
          <span />
        )}
        <Button
          variant={editing ? "primary" : "outline"}
          size="sm"
          onClick={() => {
            setEditing((e) => !e);
            cancel();
          }}
        >
          {editing ? (
            <>
              <Check className="h-4 w-4" /> Done
            </>
          ) : (
            <>
              <Move className="h-4 w-4" /> Arrange pins
            </>
          )}
        </Button>
      </div>

      {editing ? <MapUploader hasMap={!!mapImage} /> : null}

      <div className="relative">
        <TacticalMap
          locations={locations}
          mode={editing ? "edit" : "select"}
          onSelect={editing ? undefined : (id) => router.push(`/locations/${id}`)}
          onReposition={(id, x, y) =>
            start(async () => {
              await updateLocationPosition({ id, pos_x: x, pos_y: y });
              router.refresh();
            })
          }
          onCreateAt={(x, y) => {
            setName("");
            setError(null);
            setPending({ x, y });
          }}
          backgroundUrl={mapImage?.url ?? null}
          aspectRatio={mapImage ? mapImage.width / mapImage.height : undefined}
        />

        {pending ? (
          <div
            className="absolute z-40 flex -translate-x-1/2 flex-col gap-1"
            style={{
              left: `${pending.x * 100}%`,
              top: `${pending.y * 100}%`,
            }}
          >
            <span
              className="mx-auto h-3 w-3 rounded-full bg-primary"
              style={{ boxShadow: "0 0 10px #ff3b4e" }}
            />
            <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1.5 shadow-lg">
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") create();
                  if (e.key === "Escape") cancel();
                }}
                placeholder="Marker name"
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

      {error ? <p className="text-xs text-loss">{error}</p> : null}

      <div className="flex items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Hot drop
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" /> Standard
        </span>
        <span className="ml-auto">
          {editing ? "Changes save automatically." : "Tap a pin for its intel."}
        </span>
      </div>
    </div>
  );
}
