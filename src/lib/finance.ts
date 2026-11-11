// Métricas del modelo financiero por escenario (regla 1: cada cifra lleva etiqueta).

export type FinMetric =
  | "inversion"
  | "ventas_mensuales"
  | "costo_ventas_pct"
  | "gastos_fijos_mensuales"
  | "ebitda_mensual"
  | "ebitda_pct"
  | "punto_equilibrio_mensual"
  | "punto_equilibrio_meses"
  | "payback_meses";

export type Unit = "money" | "pct" | "months";

export const FIN_METRICS: { key: FinMetric; label: string; unit: Unit; hint?: string }[] = [
  { key: "inversion", label: "Inversión inicial del franquiciado", unit: "money" },
  { key: "ventas_mensuales", label: "Ventas mensuales", unit: "money" },
  { key: "costo_ventas_pct", label: "Costo de ventas", unit: "pct", hint: "% sobre ventas" },
  { key: "gastos_fijos_mensuales", label: "Gastos fijos mensuales", unit: "money" },
  { key: "ebitda_mensual", label: "EBITDA mensual", unit: "money" },
  { key: "ebitda_pct", label: "Margen EBITDA", unit: "pct" },
  { key: "punto_equilibrio_mensual", label: "Punto de equilibrio (ventas/mes)", unit: "money" },
  { key: "punto_equilibrio_meses", label: "Meses hasta el equilibrio", unit: "months" },
  { key: "payback_meses", label: "Payback del franquiciado", unit: "months" },
];

export const SCENARIOS = [
  { key: "conservador", label: "Conservador" },
  { key: "moderado", label: "Moderado" },
  { key: "optimista", label: "Optimista" },
] as const;
export type ScenarioKey = (typeof SCENARIOS)[number]["key"];

export const DATA_LABEL: Record<string, string> = {
  comprobado: "Dato comprobado",
  estimacion: "Estimación",
  supuesto: "Supuesto",
};

/** Valores derivados (solo de referencia, no se guardan): EBITDA, equilibrio y payback. */
export function derive(v: Partial<Record<FinMetric, number | null>>) {
  const ventas = v.ventas_mensuales ?? null;
  const costo = v.costo_ventas_pct ?? null;
  const fijos = v.gastos_fijos_mensuales ?? null;
  const out: Partial<Record<FinMetric, number>> = {};
  if (ventas !== null && costo !== null && fijos !== null) {
    const ebitda = ventas * (1 - costo / 100) - fijos;
    out.ebitda_mensual = Math.round(ebitda);
    if (ventas > 0) out.ebitda_pct = Math.round((ebitda / ventas) * 1000) / 10;
    if (costo < 100) out.punto_equilibrio_mensual = Math.round(fijos / (1 - costo / 100));
  }
  const ebitda = v.ebitda_mensual ?? out.ebitda_mensual ?? null;
  if (v.inversion && ebitda && ebitda > 0) out.payback_meses = Math.round((v.inversion / ebitda) * 10) / 10;
  return out;
}

export function fmtMetric(value: number | null | undefined, unit: Unit, currency: "BOB" | "USD" = "BOB") {
  if (value === null || value === undefined) return "[POR CONFIRMAR]";
  const n = new Intl.NumberFormat("es-BO", { maximumFractionDigits: unit === "money" ? 0 : 1 }).format(value);
  if (unit === "money") return `${currency === "USD" ? "USD" : "Bs"} ${n}`;
  if (unit === "pct") return `${n} %`;
  return `${n} meses`;
}
