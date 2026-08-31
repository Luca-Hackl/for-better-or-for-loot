"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LocationRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Flame, Check } from "lucide-react";

type Pos = { x: number; y: number };

const GRID_COLS = 6;

/**
 * Stylized (or image-backed) Fort Lyndon tactical map.
 *  - mode="select": tap a pin to choose it (onSelect). Selected pin is ringed.
 *  - mode="edit":   drag pins to reposition (onReposition persists 0..1 coords).
 * Unplaced pins (null coords) are laid out on a non-overlapping grid so they
 * never stack. An optional uploaded image can back the map; pins stay aligned
 * because the container's aspect-ratio is set to the image's natural ratio.
 */
export function TacticalMap({
  locations,
  mode = "select",
  selectedId,
  onSelect,
  onReposition,
  onCreateAt,
  points,
  backgroundUrl,
  aspectRatio,
  label,
  className,
}: {
  locations: LocationRow[];
  mode?: "select" | "edit";
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onReposition?: (id: string, x: number, y: number) => void;
  onCreateAt?: (x: number, y: number) => void;
  points?: { id: string; x: number; y: number; color?: string; selected?: boolean; label?: string }[];
  backgroundUrl?: string | null;
  aspectRatio?: number | null;
  label?: string | null;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [pos, setPos] = useState<Record<string, Pos>>({});
  const [imgError, setImgError] = useState(false);

  // Grid slots for pins missing coordinates — spread across the full map.
  const defaultPos = useMemo(() => {
    const unplaced = locations.filter((l) => l.pos_x == null || l.pos_y == null);
    const slotBy: Record<string, Pos> = {};
    unplaced.forEach((l, k) => {
      slotBy[l.id] = {
        x: 0.1 + (k % GRID_COLS) * (0.8 / (GRID_COLS - 1)),
        y: 0.12 + Math.floor(k / GRID_COLS) * 0.16,
      };
    });
    return (l: LocationRow): Pos =>
      l.pos_x != null && l.pos_y != null
        ? { x: l.pos_x, y: l.pos_y }
        : (slotBy[l.id] ?? { x: 0.5, y: 0.5 });
  }, [locations]);

  // (Re)seed positions from props whenever locations change (DB coords win).
  useEffect(() => {
    const next: Record<string, Pos> = {};
    locations.forEach((l) => {
      next[l.id] = defaultPos(l);
    });
    setPos(next);
  }, [locations, defaultPos]);

  useEffect(() => {
    setImgError(false);
  }, [backgroundUrl]);

  function clientToRel(clientX: number, clientY: number): Pos {
    const rect = ref.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  }

  useEffect(() => {
    if (!dragId) return;
    const move = (e: PointerEvent) => {
      const p = clientToRel(e.clientX, e.clientY);
      setPos((prev) => ({ ...prev, [dragId]: p }));
    };
    const up = (e: PointerEvent) => {
      const p = clientToRel(e.clientX, e.clientY);
      onReposition?.(dragId, p.x, p.y);
      setDragId(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragId, onReposition]);

  const showImage = !!backgroundUrl && !imgError;

  return (
    <div
      ref={ref}
      onClick={
        onCreateAt
          ? (e) => {
              // fire only for clicks on the empty map (background), not on a pin
              if (e.target === e.currentTarget) {
                const p = clientToRel(e.clientX, e.clientY);
                onCreateAt(p.x, p.y);
              }
            }
          : undefined
      }
      className={cn(
        "relative w-full select-none overflow-hidden rounded-lg border border-border",
        mode === "edit" && "cursor-crosshair",
        className,
      )}
      style={{
        aspectRatio: String(aspectRatio && aspectRatio > 0 ? aspectRatio : 16 / 10),
        background: showImage
          ? "#0b0e14"
          : "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(43,51,64,0.4) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(43,51,64,0.4) 40px), radial-gradient(120% 120% at 30% 20%, rgba(53,208,224,0.06), transparent 60%), #0b0e14",
        touchAction: mode === "edit" ? "none" : undefined,
      }}
    >
      {showImage ? (
        // plain <img> (no next/image) so we avoid remotePatterns config
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backgroundUrl!}
          alt=""
          aria-hidden
          onError={() => setImgError(true)}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none"
        />
      ) : null}

      <span className="pointer-events-none absolute left-3 top-2 z-10 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Fort Lyndon
      </span>

      {label ? (
        <span className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full border border-primary/40 bg-primary/20 px-3 py-0.5 text-[11px] font-semibold text-primary backdrop-blur-sm">
          {label}
        </span>
      ) : null}

      {locations.map((l) => {
        const p = pos[l.id] ?? defaultPos(l);
        const selected = selectedId === l.id;
        const hot = l.is_hot_drop;
        const dotColor = hot ? "#ff3b4e" : "#35d0e0";
        return (
          <button
            key={l.id}
            type="button"
            onClick={mode === "select" ? () => onSelect?.(l.id) : undefined}
            onPointerDown={
              mode === "edit"
                ? (e) => {
                    e.preventDefault();
                    setDragId(l.id);
                  }
                : undefined
            }
            className={cn(
              "group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 p-3",
              mode === "edit" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
              dragId === l.id ? "z-30" : selected ? "z-20" : "z-[1]",
            )}
            style={{
              left: `${p.x * 100}%`,
              top: `${p.y * 100}%`,
              touchAction: "manipulation",
            }}
            aria-pressed={selected}
            aria-label={l.name}
            title={l.name}
          >
            <span
              className={cn(
                "pointer-events-none flex items-center justify-center rounded-full ring-1 transition-transform group-hover:scale-110",
                selected ? "ring-2 ring-white" : "ring-white/20",
              )}
              style={{
                width: selected ? 22 : 16,
                height: selected ? 22 : 16,
                backgroundColor: dotColor,
                boxShadow: `0 0 ${selected ? 16 : 8}px ${dotColor}`,
              }}
            >
              {selected ? <Check className="h-3.5 w-3.5 text-white" /> : null}
            </span>
            <span
              className={cn(
                "pointer-events-none whitespace-nowrap rounded px-1 py-0.5 text-[10px] font-medium leading-none",
                selected
                  ? "bg-white text-black"
                  : "bg-card/80 text-foreground opacity-0 group-hover:opacity-100",
              )}
            >
              <span className="inline-flex items-center gap-0.5">
                {hot ? <Flame className="h-2.5 w-2.5" /> : null}
                {l.name}
              </span>
            </span>
          </button>
        );
      })}

      {(points ?? []).map((pt) => (
        <span
          key={pt.id}
          className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
          style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%` }}
        >
          <span
            className="flex items-center justify-center rounded-full ring-1 ring-white/70"
            style={{
              width: pt.selected ? 20 : 14,
              height: pt.selected ? 20 : 14,
              backgroundColor: pt.color ?? "#ff3b4e",
              boxShadow: `0 0 ${pt.selected ? 14 : 7}px ${pt.color ?? "#ff3b4e"}`,
            }}
          >
            {pt.label ? (
              <span className="text-[9px] font-bold text-white">{pt.label}</span>
            ) : null}
          </span>
        </span>
      ))}
    </div>
  );
}
