import Link from "next/link";
import type { LocationRow, LocationStat } from "@/lib/types";

/** A lightweight tactical map: POI dots placed by pos_x/pos_y (0..1). */
export function DropMap({
  locations,
  statsById,
}: {
  locations: LocationRow[];
  statsById: Map<string, LocationStat>;
}) {
  const withCoords = locations.filter((l) => l.pos_x != null && l.pos_y != null);
  if (withCoords.length === 0) return null;

  return (
    <div
      className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-border"
      style={{
        background:
          "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(43,51,64,0.4) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(43,51,64,0.4) 40px), radial-gradient(120% 120% at 30% 20%, rgba(53,208,224,0.06), transparent 60%), #0b0e14",
      }}
    >
      <span className="absolute left-3 top-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Fort Lyndon
      </span>
      {withCoords.map((l) => {
        const s = statsById.get(l.id);
        const games = s?.games ?? 0;
        const wr = s?.win_rate ?? 0;
        const size = 10 + Math.min(games, 12) * 1.6; // busier spots read bigger
        return (
          <Link
            key={l.id}
            href={`/locations/${l.id}`}
            className="group absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${(l.pos_x ?? 0) * 100}%`, top: `${(l.pos_y ?? 0) * 100}%` }}
          >
            <span
              className="block rounded-full ring-1 ring-white/20 transition-transform group-hover:scale-125"
              style={{
                width: size,
                height: size,
                backgroundColor: l.is_hot_drop ? "#ff3b4e" : "#35d0e0",
                boxShadow: `0 0 ${6 + wr * 12}px ${l.is_hot_drop ? "#ff3b4e" : "#35d0e0"}`,
                opacity: games > 0 ? 1 : 0.45,
              }}
            />
            <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-card px-1.5 py-0.5 text-[10px] font-medium text-foreground opacity-0 shadow transition-opacity group-hover:opacity-100">
              {l.name}
              {games > 0 ? ` · ${Math.round(wr * 100)}% WR` : ""}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
