"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import type { PlayerStat } from "@/lib/types";

const COLORS = ["#ff3b4e", "#35d0e0", "#ffcc33", "#c46bff"];

function color(p: PlayerStat, i: number) {
  return p.color ?? COLORS[i % COLORS.length];
}

export function H2HRadar({ players }: { players: PlayerStat[] }) {
  const metrics = [
    { label: "Kills/game", get: (p: PlayerStat) => p.avg_kills },
    { label: "Assists/game", get: (p: PlayerStat) => p.avg_assists },
    { label: "K/D", get: (p: PlayerStat) => p.kd },
    { label: "Revives/game", get: (p: PlayerStat) => (p.games ? p.revives / p.games : 0) },
    { label: "MVP %", get: (p: PlayerStat) => (p.games ? (p.mvps / p.games) * 100 : 0) },
  ];

  const data = metrics.map((m) => {
    const raw = players.map((p) => m.get(p));
    const max = Math.max(...raw, 0.0001);
    const row: Record<string, number | string> = { metric: m.label };
    players.forEach((p, i) => {
      row[p.display_name] = Math.round((m.get(p) / max) * 100);
    });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#1e2530" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: "#8b95a7", fontSize: 11 }} />
        {players.map((p, i) => (
          <Radar
            key={p.player_id}
            name={p.display_name}
            dataKey={p.display_name}
            stroke={color(p, i)}
            fill={color(p, i)}
            fillOpacity={0.25}
          />
        ))}
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            background: "#0f131b",
            border: "1px solid #2b3340",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={((v: unknown) => `${v as number}/100`) as never}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function H2HTotals({ players }: { players: PlayerStat[] }) {
  const data = [
    { stat: "Kills", ...fromField(players, "kills") },
    { stat: "Assists", ...fromField(players, "assists") },
    { stat: "Deaths", ...fromField(players, "deaths") },
    { stat: "Revives", ...fromField(players, "revives") },
    { stat: "MVPs", ...fromField(players, "mvps") },
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2530" vertical={false} />
        <XAxis dataKey="stat" stroke="#64707f" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="#64707f" fontSize={11} tickLine={false} axisLine={false} width={36} />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
          contentStyle={{
            background: "#0f131b",
            border: "1px solid #2b3340",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {players.map((p, i) => (
          <Bar key={p.player_id} dataKey={p.display_name} fill={color(p, i)} radius={[3, 3, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function fromField(players: PlayerStat[], field: keyof PlayerStat) {
  const row: Record<string, number> = {};
  players.forEach((p) => {
    row[p.display_name] = Number(p[field] ?? 0);
  });
  return row;
}
