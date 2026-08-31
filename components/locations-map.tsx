"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TacticalMap } from "@/components/tactical-map";
import { MapUploader } from "@/components/map-uploader";
import { updateLocationPosition } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import type { LocationRow, MapImage } from "@/lib/types";
import { Move, Check } from "lucide-react";

/** Locations map: tap a pin to open its intel, or "Arrange pins" to drag them
 *  and upload a real map background. */
export function LocationsMap({
  locations,
  mapImage,
}: {
  locations: LocationRow[];
  mapImage: MapImage | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [, start] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button
          variant={editing ? "primary" : "outline"}
          size="sm"
          onClick={() => setEditing((e) => !e)}
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
        backgroundUrl={mapImage?.url ?? null}
        aspectRatio={mapImage ? mapImage.width / mapImage.height : undefined}
      />

      <div className="flex items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Hot drop
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" /> Standard
        </span>
        <span className="ml-auto">
          {editing ? "Drag pins to reposition — saved automatically." : "Tap a pin for its intel."}
        </span>
      </div>
    </div>
  );
}
