"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import { fmtDelta } from "@/lib/utils";

export interface RpPoint {
  t: string; // ISO date
  rp: number;
  delta: number | null;
}

export function RpChart({ data }: { data: RpPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted">
        Log a ranked match to start the climb.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="rpFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff3b4e" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#ff3b4e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2530" vertical={false} />
        <XAxis
          dataKey="t"
          tickFormatter={(v) => format(new Date(v), "MMM d")}
          stroke="#64707f"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          minTickGap={28}
        />
        <YAxis
          stroke="#64707f"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={48}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: "#0f131b",
            border: "1px solid #2b3340",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(v) => format(new Date(v as string), "EEE, MMM d · HH:mm")}
          formatter={((value: unknown, _name: unknown, item: { payload?: RpPoint }) => {
            const d = item?.payload?.delta;
            return [`${value} RP`, d != null ? `(${fmtDelta(d)})` : "RP"];
            // recharts' formatter types are overly strict; cast at the boundary
          }) as never}
        />
        <Area
          type="monotone"
          dataKey="rp"
          stroke="#ff3b4e"
          strokeWidth={2}
          fill="url(#rpFill)"
          dot={{ r: 2, fill: "#ff3b4e" }}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
