"use client";

import { useEffect, useRef, useState } from "react";
import type { LocationRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Flame, Check } from "lucide-react";

type Pos = { x: number; y: number };

/**
 * Stylized Fort Lyndon tactical map.
 *  - mode="select": click a pin to choose it (onSelect). Selected pin is ringed.
 *  - mode="edit":   drag pins to reposition (onReposition persists 0..1 coords).
 */
export function TacticalMap({
  locations,
  mode = "select",
  selectedId,
  onSelect,
  onReposition,
  className,
}: {
  locations: LocationRow[];
  mode?: "select" | "edit";
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onReposition?: (id: string, x: number, y: number) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  // optimistic positions during a drag, keyed by id
  const [pos, setPos] = useState<Record<string, Pos>>({});

  // seed/refresh positions from props (fallback to a tidy default if missing)
  useEffect(() => {
    const next: Record<string, Pos> = {};
    locations.forEach((l, i) => {
      const fx = l.pos_x ?? 0.5 + ((i % 5) - 2) * 0.04;
      const fy = l.pos_y ?? 0.5 + (Math.floor(i / 5) - 1) * 0.05;
      next[l.id] = { x: fx, y: fy };
    });
    setPos(next);
  }, [locations]);

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

  return (
    <div
      ref={ref}
      className={cn(
        "relative aspect-[16/10] w-full select-none overflow-hidden rounded-lg border border-border",
        mode === "edit" && "cursor-crosshair",
        className,
      )}
      style={{
        background:
          "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(43,51,64,0.4) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(43,51,64,0.4) 40px), radial-gradient(120% 120% at 30% 20%, rgba(53,208,224,0.06), transparent 60%), #0b0e14",
        touchAction: mode === "edit" ? "none" : undefined,
      }}
    >
      <span className="pointer-events-none absolute left-3 top-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Fort Lyndon
      </span>

      {locations.map((l) => {
        const p = pos[l.id] ?? { x: 0.5, y: 0.5 };
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
              "group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5",
              mode === "edit" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
              dragId === l.id && "z-20",
            )}
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            aria-pressed={selected}
            title={l.name}
          >
            <span
              className={cn(
                "flex items-center justify-center rounded-full ring-1 transition-transform group-hover:scale-110",
                selected ? "ring-2 ring-white" : "ring-white/20",
              )}
              style={{
                width: selected ? 20 : 14,
                height: selected ? 20 : 14,
                backgroundColor: dotColor,
                boxShadow: `0 0 ${selected ? 16 : 8}px ${dotColor}`,
              }}
            >
              {selected ? <Check className="h-3 w-3 text-white" /> : null}
            </span>
            <span
              className={cn(
                "whitespace-nowrap rounded px-1 py-0.5 text-[10px] font-medium leading-none",
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
    </div>
  );
}
