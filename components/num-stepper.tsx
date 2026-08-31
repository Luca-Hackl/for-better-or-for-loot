"use client";

import { Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";

const toInt = (s: string) => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
};

/** Big tap-friendly counter: − [editable] + . Fast for live entry. */
export function NumStepper({
  label,
  value,
  onChange,
  disabled,
  accent,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  accent?: string;
}) {
  const bump = (d: number) => onChange(String(Math.max(0, toInt(value || "0") + d)));

  return (
    <div className="flex flex-col items-center gap-1">
      <Label className="text-[10px]">{label}</Label>
      <div className="flex items-stretch overflow-hidden rounded-md border border-border-strong">
        <button
          type="button"
          disabled={disabled}
          onClick={() => bump(-1)}
          className="flex w-8 items-center justify-center bg-surface text-muted transition-colors hover:bg-card-hover active:bg-primary/20 disabled:opacity-40"
          aria-label={`decrease ${label}`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="tnum w-10 border-x border-border-strong bg-background text-center text-base font-bold outline-none focus:bg-surface disabled:opacity-40"
          style={accent ? { color: accent } : undefined}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => bump(1)}
          className="flex w-8 items-center justify-center bg-surface text-foreground transition-colors hover:bg-card-hover active:bg-primary/30 disabled:opacity-40"
          aria-label={`increase ${label}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
