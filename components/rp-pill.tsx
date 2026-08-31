import { cn, fmtDelta } from "@/lib/utils";

/** RP change pill — green for gains, red for losses. */
export function RpPill({
  delta,
  className,
  size = "md",
}: {
  delta?: number | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  if (delta == null) return <span className={cn("text-muted", className)}>—</span>;
  const positive = delta > 0;
  const neutral = delta === 0;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-bold tnum",
        size === "sm" && "px-1.5 py-0.5 text-xs",
        size === "md" && "px-2.5 py-1 text-sm",
        size === "lg" && "px-3 py-1.5 text-lg",
        neutral
          ? "bg-card-hover text-muted border border-border"
          : positive
            ? "bg-win/15 text-win border border-win/40"
            : "bg-loss/15 text-loss border border-loss/40",
        className,
      )}
    >
      {fmtDelta(delta)} <span className="ml-1 opacity-70 font-medium">RP</span>
    </span>
  );
}
