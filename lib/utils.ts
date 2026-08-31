import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a signed RP delta like "+42" / "-30" / "0". */
export function fmtDelta(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n > 0 ? `+${n}` : `${n}`;
}

/** Compact number, e.g. 12.3k. */
export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(digits);
}

/** Safe kill/death ratio. */
export function kd(kills: number, deaths: number): number {
  return deaths === 0 ? kills : kills / deaths;
}

export function pct(n: number, d: number): number {
  return d === 0 ? 0 : (n / d) * 100;
}
