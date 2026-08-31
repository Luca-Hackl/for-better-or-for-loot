import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  color,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { color?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        className,
      )}
      style={
        color
          ? { color, borderColor: `${color}55`, backgroundColor: `${color}18` }
          : undefined
      }
      {...props}
    />
  );
}
