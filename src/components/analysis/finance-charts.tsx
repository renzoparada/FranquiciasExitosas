"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function FinanceCharts({ data, currency }: { data: { escenario: string; Inversión: number | null; "EBITDA anual": number | null; Payback: number | null }[]; currency: "BOB" | "USD" }) {
  const fmt = (v: number) => `${currency === "USD" ? "USD" : "Bs"} ${new Intl.NumberFormat("es-BO", { notation: "compact", maximumFractionDigits: 1 }).format(v)}`;
  const tip = { borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 12 };
  return (
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={data} barGap={4}>
            <CartesianGrid vertical={false} stroke="var(--line)" strokeOpacity={0.6} />
            <XAxis dataKey="escenario" tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} width={72} />
            <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={tip} cursor={{ fill: "var(--surface-2)" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Inversión" fill="var(--ink)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="EBITDA anual" fill="var(--brand)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid vertical={false} stroke="var(--line)" strokeOpacity={0.6} />
            <XAxis dataKey="escenario" tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} width={30} />
            <Tooltip formatter={(v) => `${v} meses`} contentStyle={tip} cursor={{ fill: "var(--surface-2)" }} />
            <Bar dataKey="Payback" name="Payback (meses)" fill="var(--muted)" radius={[6, 6, 0, 0]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
