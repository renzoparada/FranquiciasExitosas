import type { SupabaseClient } from "@supabase/supabase-js";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { day, money, todayLaPaz } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = { brand_name: string; concept: string; net_amount: number; tax_amount: number; total: number; currency: "BOB" | "USD"; due_date: string | null; status: string };
const STATUS: Record<string, { label: string; tone: "neutral" | "brand" | "ok" }> = {
  pendiente: { label: "Pendiente", tone: "neutral" },
  facturada: { label: "Facturada", tone: "brand" },
  pagada: { label: "Pagada", tone: "ok" },
};

/** Estado de cuenta del cliente (sin notas internas del consultor). */
export async function AccountStatement({ supabase, projectId }: { supabase: SupabaseClient; projectId: string }) {
  const { data } = await supabase.rpc("get_account_statement", { p_project: projectId });
  const rows = (data ?? []) as Row[];
  const today = todayLaPaz();
  const brands = [...new Set(rows.map((r) => r.brand_name))];
  const cur = rows[0]?.currency ?? "BOB";
  const total = rows.reduce((a, r) => a + Number(r.total), 0);
  const paid = rows.filter((r) => r.status === "pagada").reduce((a, r) => a + Number(r.total), 0);

  if (!rows.length) return <Card className="text-sm text-muted">Todavía no hay cuotas registradas para este proyecto.</Card>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[["Total", total], ["Pagado", paid], ["Saldo", total - paid]].map(([k, v], i) => (
          <Card key={k as string} className={cn("p-4", i === 2 && "bg-ink text-canvas")}>
            <p className={cn("text-xs font-semibold uppercase tracking-wide", i === 2 ? "text-canvas/60" : "text-muted")}>{k}</p>
            <p className="font-display mt-1 text-lg font-black tabular-nums sm:text-2xl">{money(v as number, cur)}</p>
          </Card>
        ))}
      </div>
      {brands.map((b) => (
        <Card key={b} className="p-0">
          <CardTitle className="border-b border-line/60 px-5 py-4">{b}</CardTitle>
          <ul className="divide-y divide-line/50">
            {rows.filter((r) => r.brand_name === b).map((r, i) => {
              const overdue = r.status !== "pagada" && r.due_date && r.due_date < today;
              return (
                <li key={i} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{r.concept}</p>
                    <p className={cn("text-xs", overdue ? "font-bold text-brand" : "text-muted")}>
                      {money(Number(r.net_amount), r.currency)} + impuestos {money(Number(r.tax_amount), r.currency)} · {r.due_date ? `vence ${day(r.due_date)}` : "se activa con su puerta"}
                      {overdue && " · vencida"}
                    </p>
                  </div>
                  <span className="font-display font-black tabular-nums">{money(Number(r.total), r.currency)}</span>
                  <Badge tone={STATUS[r.status]?.tone}>{STATUS[r.status]?.label ?? r.status}</Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
      <p className="text-xs text-muted">Los entregables de cada etapa se liberan para descarga cuando su cuota está pagada.</p>
    </div>
  );
}
