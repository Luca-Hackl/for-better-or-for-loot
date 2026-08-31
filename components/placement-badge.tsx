import { cn } from "@/lib/utils";

/** Squad placement chip: #1 reads "VICTORY", top-3 gold, rest neutral. */
export function PlacementBadge({
  placement,
  total,
  className,
}: {
  placement?: number | null;
  total?: number | null;
  className?: string;
}) {
  if (placement == null) {
    return <span className={cn("text-muted text-sm", className)}>—</span>;
  }
  const isWin = placement === 1;
  const isTop3 = placement <= 3;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold tracking-wide tnum",
        isWin
          ? "bg-win/15 text-win border border-win/40"
          : isTop3
            ? "bg-warn/15 text-warn border border-warn/30"
            : "bg-card-hover text-muted border border-border",
        className,
      )}
    >
      {isWin ? "🏆 VICTORY" : `#${placement}`}
      {!isWin && total ? <span className="text-muted-foreground">/{total}</span> : null}
    </span>
  );
}
