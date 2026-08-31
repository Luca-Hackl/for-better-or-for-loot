import { formatRank, tierColor } from "@/lib/ranks";
import { cn } from "@/lib/utils";

/** RedSec rank chip, e.g. "Gold III" tinted by tier color. */
export function RankBadge({
  tier,
  division,
  className,
  size = "md",
}: {
  tier?: string | null;
  division?: number | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const color = tierColor(tier);
  const label = formatRank(tier, division);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border font-bold tracking-wide",
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-3 py-1 text-sm",
        size === "lg" && "px-4 py-1.5 text-base",
        className,
      )}
      style={{ color, borderColor: `${color}55`, backgroundColor: `${color}14` }}
    >
      <span
        className="inline-block rounded-full"
        style={{
          backgroundColor: color,
          width: size === "lg" ? 10 : 8,
          height: size === "lg" ? 10 : 8,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
      {label}
    </span>
  );
}
