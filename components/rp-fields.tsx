"use client";

import { useEffect, useMemo, useState } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { TIERS, TIER_MAP, ROMAN } from "@/lib/ranks";
import { fmtDelta } from "@/lib/utils";

export interface RpValue {
  rp_before: number | null;
  rp_delta: number | null;
  rp_after: number | null;
  rank_tier: string | null;
  rank_division: number | null;
}

const num = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/**
 * RP entry for the current player, with two-way auto-calc between
 * before / gained(±) / now. Prefills "before" from the player's latest RP.
 */
export function RpFields({
  latestRp,
  initial,
  onChange,
}: {
  latestRp: number | null;
  initial?: Partial<RpValue>;
  onChange: (v: RpValue) => void;
}) {
  const [before, setBefore] = useState(
    initial?.rp_before != null ? String(initial.rp_before) : latestRp != null ? String(latestRp) : "",
  );
  const [gain, setGain] = useState(initial?.rp_delta != null ? String(initial.rp_delta) : "");
  const [now, setNow] = useState(initial?.rp_after != null ? String(initial.rp_after) : "");
  const [tier, setTier] = useState(initial?.rank_tier ?? "");
  const [division, setDivision] = useState(initial?.rank_division != null ? String(initial.rank_division) : "");

  // two-way calc
  function editBefore(v: string) {
    setBefore(v);
    const b = num(v);
    const g = num(gain);
    const n = num(now);
    if (b != null && g != null) setNow(String(b + g));
    else if (b != null && n != null) setGain(String(n - b));
  }
  function editGain(v: string) {
    setGain(v);
    const b = num(before);
    const g = num(v);
    if (b != null && g != null) setNow(String(b + g));
  }
  function editNow(v: string) {
    setNow(v);
    const b = num(before);
    const n = num(v);
    if (b != null && n != null) setGain(String(n - b));
  }

  const value = useMemo<RpValue>(
    () => ({
      rp_before: num(before),
      rp_delta: num(gain),
      rp_after: num(now),
      rank_tier: tier || null,
      rank_division: num(division),
    }),
    [before, gain, now, tier, division],
  );

  useEffect(() => {
    onChange(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.rp_before, value.rp_delta, value.rp_after, value.rank_tier, value.rank_division]);

  const g = num(gain);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Field label="RP before">
        <Input
          type="number"
          value={before}
          onChange={(e) => editBefore(e.target.value)}
          placeholder={latestRp != null ? String(latestRp) : "e.g. 4596"}
        />
      </Field>
      <Field label="Gained / lost">
        <Input
          type="number"
          value={gain}
          onChange={(e) => editGain(e.target.value)}
          placeholder="+4 / -30"
          className={g != null ? (g > 0 ? "text-win" : g < 0 ? "text-loss" : "") : ""}
        />
      </Field>
      <Field label="RP now">
        <Input
          type="number"
          value={now}
          onChange={(e) => editNow(e.target.value)}
          placeholder="e.g. 4600"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Tier">
          <Select value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="">—</option>
            {TIERS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Div">
          <Select
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            disabled={!tier || (TIER_MAP[tier as keyof typeof TIER_MAP]?.divisions ?? 1) <= 1}
          >
            <option value="">—</option>
            {ROMAN.slice(1).map((r, i) => (
              <option key={r} value={i + 1}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {value.rp_delta != null ? (
        <p className="col-span-full text-[11px] text-muted">
          Net this round: <span className={value.rp_delta >= 0 ? "text-win" : "text-loss"}>{fmtDelta(value.rp_delta)} RP</span>
          {value.rp_after != null ? ` · now at ${value.rp_after}` : ""}
        </p>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
