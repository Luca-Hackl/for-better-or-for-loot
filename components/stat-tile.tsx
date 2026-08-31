import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/** A single big-number KPI tile for the dashboard. */
export function StatTile({
  label,
  value,
  sub,
  accent,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <Card className={cn("p-4 flex flex-col gap-1 justify-between", className)}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted">
        {label}
      </div>
      <div
        className="tnum text-2xl md:text-3xl font-bold leading-none"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {sub ? <div className="text-xs text-muted">{sub}</div> : null}
    </Card>
  );
}
