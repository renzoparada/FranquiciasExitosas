"use client";

import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#E30613", "#1D1D1F", "#6E6E73", "#B00010"];

export function MatrixRadar({ data, brands }: { data: Record<string, string | number | null>[]; brands: string[] }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--line)" />
          <PolarAngleAxis dataKey="criterio" tick={{ fontSize: 11, fill: "var(--muted)" }} />
          <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} />
          {brands.map((b, i) => (
            <Radar key={b} name={b} dataKey={b} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.18} strokeWidth={2} isAnimationActive />
          ))}
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
