import { Plus } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addFranchiseSale, createFeePlan, updateInstallment, updateSale } from "@/app/actions/analysis";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { getBrands } from "@/lib/data";
import { day, money, todayLaPaz } from "@/lib/format";
import { cn } from "@/lib/utils";

type Cur = "BOB" | "USD";
type Inst = { id: string; label: string; pct: number; trigger: string; net_amount: number; tax_amount: number; due_date: string | null; status: string; invoice_no: string | null; paid_at: string | null; sort: number };
type Plan = { id: string; brand_id: string; base_amount: number; tax_pct: number; success_fee_pct: number; currency: Cur; installments: Inst[] };
type Sale = { id: string; brand_id: string; franchisee_name: string; city: string | null; signed_at: string; entry_fee_amount: number; success_fee_net: number; success_fee_tax: number; currency: Cur; status: string; invoice_no: string | null };

const STATUS: Record<string, { label: string; tone: "neutral" | "brand" | "ok" }> = {
  pendiente: { label: "Pendiente", tone: "neutral" },
  facturada: { label: "Facturada", tone: "brand" },
  pagada: { label: "Pagada", tone: "ok" },
};
const TRIGGER: Record<string, string> = { firma: "Firma del contrato", RENTABLE: "Puerta RENTABLE", REPLICABLE: "Puerta REPLICABLE" };

export async function FeesSection({ supabase, projectId, path }: { supabase: SupabaseClient; projectId: string; path: string }) {
  const brands = await getBrands(supabase, projectId);
  const ids = brands.map((b) => b.id);
  const [{ data: p }, { data: s }, { data: project }] = await Promise.all([
    supabase.from("fee_plans").select("id, brand_id, base_amount, tax_pct, success_fee_pct, currency, installments(id, label, pct, trigger, net_amount, tax_amount, due_date, status, invoice_no, paid_at, sort)").in("brand_id", ids),
    supabase.from("franchise_sales").select("id, brand_id, franchisee_name, city, signed_at, entry_fee_amount, success_fee_net, success_fee_tax, currency, status, invoice_no").in("brand_id", ids).order("signed_at"),
    supabase.from("projects").select("currency").eq("id", projectId).single(),
  ]);
  const plans = (p ?? []) as Plan[];
  const sales = (s ?? []) as Sale[];
  const currency = (project?.currency ?? "BOB") as Cur;
  const today = todayLaPaz();

  const all = plans.flatMap((pl) => pl.installments.map((i) => ({ ...i, total: Number(i.net_amount) + Number(i.tax_amount) })));
  const saleTotals = sales.map((x) => Number(x.success_fee_net) + Number(x.success_fee_tax));
  const contracted = all.reduce((a, i) => a + i.total, 0);
  const paid = all.filter((i) => i.status === "pagada").reduce((a, i) => a + i.total, 0) + sales.filter((x) => x.status === "pagada").reduce((a, x) => a + Number(x.success_fee_net) + Number(x.success_fee_tax), 0);
  const success = saleTotals.reduce((a, v) => a + v, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Honorarios contratados", money(contracted, currency), "con impuestos"],
          ["Fees de éxito", money(success, currency), `${sales.length} franquicia(s) vendida(s)`],
          ["Cobrado", money(paid, currency), "cuotas y fees pagados"],
          ["Por cobrar", money(contracted + success - paid, currency), "pendiente o facturado"],
        ].map(([k, v, h], i) => (
          <Card key={k} className={cn("p-5", i === 3 && "bg-ink text-canvas")}>
            <p className={cn("text-xs font-semibold uppercase tracking-wide", i === 3 ? "text-canvas/60" : "text-muted")}>{k}</p>
            <p className="font-display mt-2 text-2xl font-black tabular-nums">{v}</p>
            <p className={cn("text-xs", i === 3 ? "text-canvas/60" : "text-muted")}>{h}</p>
          </Card>
        ))}
      </div>

      {brands.map((b) => {
        const plan = plans.find((x) => x.brand_id === b.id);
        const bs = sales.filter((x) => x.brand_id === b.id);
        return (
          <Card key={b.id} className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-xl">{b.name}</CardTitle>
              {plan && (
                <p className="text-sm text-muted">
                  {money(Number(plan.base_amount), plan.currency)} + {Number(plan.tax_pct)} % de impuestos ={" "}
                  <strong className="text-ink">{money(Number(plan.base_amount) * (1 + Number(plan.tax_pct) / 100), plan.currency)}</strong> · fee de éxito {Number(plan.success_fee_pct)} % del derecho de entrada
                </p>
              )}
            </div>

            {plan ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted">
                    <tr><th className="py-2">Cuota</th><th className="py-2">Ligada a</th><th className="py-2 text-right">Neto</th><th className="py-2 text-right">Impuestos</th><th className="py-2 text-right">Total</th><th className="py-2 pl-4">Estado · factura · vencimiento</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line/50">
                    {[...plan.installments].sort((a, c) => a.sort - c.sort).map((i) => {
                      const overdue = i.status !== "pagada" && i.due_date && i.due_date < today;
                      return (
                        <tr key={i.id}>
                          <td className="py-3 font-semibold">{i.label} <span className="text-xs font-normal text-muted">({Number(i.pct)} %)</span></td>
                          <td className="py-3 text-muted">{TRIGGER[i.trigger] ?? i.trigger}</td>
                          <td className="py-3 text-right tabular-nums">{money(Number(i.net_amount), plan.currency)}</td>
                          <td className="py-3 text-right tabular-nums text-muted">{money(Number(i.tax_amount), plan.currency)}</td>
                          <td className="py-3 text-right font-semibold tabular-nums">{money(Number(i.net_amount) + Number(i.tax_amount), plan.currency)}</td>
                          <td className="py-2 pl-4">
                            <ActionForm action={updateInstallment} resetOnSuccess={false} className="flex flex-wrap items-center gap-2">
                              <input type="hidden" name="installment_id" value={i.id} /><input type="hidden" name="path" value={path} />
                              <Select name="status" defaultValue={i.status} className="h-9 w-32 py-1 text-xs" aria-label="Estado">
                                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                              </Select>
                              <Input name="invoice_no" defaultValue={i.invoice_no ?? ""} placeholder="N.º factura" className="h-9 w-28 text-xs" />
                              <Input name="due_date" type="date" defaultValue={i.due_date ?? ""} className={cn("h-9 w-36 text-xs", overdue && "border-brand text-brand")} aria-label="Vencimiento" />
                              <Button type="submit" size="sm" variant="ghost">Guardar</Button>
                            </ActionForm>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-muted">Al marcar una cuota como pagada, los entregables ligados a ella se liberan para descarga del cliente (regla 7).</p>
              </div>
            ) : (
              <ActionForm action={createFeePlan} className="grid gap-3 rounded-2xl bg-surface-2 p-4 sm:grid-cols-4">
                <input type="hidden" name="brand_id" value={b.id} /><input type="hidden" name="currency" value={currency} /><input type="hidden" name="path" value={path} />
                <Field label="Honorario fijo"><Input name="base_amount" inputMode="decimal" defaultValue="35000" /></Field>
                <Field label="Impuestos (%)" hint="IVA 13 % + IT 3 %"><Input name="tax_pct" inputMode="decimal" defaultValue="16" /></Field>
                <Field label="Fee de éxito (%)"><Input name="success_fee_pct" inputMode="decimal" defaultValue="10" /></Field>
                <div className="flex items-end"><Button type="submit">Crear plan 40/30/30</Button></div>
              </ActionForm>
            )}

            <div className="border-t border-line/60 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Franquicias vendidas · fee de éxito</p>
              {bs.length ? (
                <ul className="space-y-1.5">
                  {bs.map((x) => (
                    <li key={x.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                      <span className="min-w-40 flex-1"><strong>{x.franchisee_name}</strong>{x.city ? ` · ${x.city}` : ""} <span className="text-xs text-muted">· firmó {day(x.signed_at)}</span></span>
                      <span className="text-xs text-muted">Derecho de entrada {money(Number(x.entry_fee_amount), x.currency)}</span>
                      <span className="font-semibold">Fee {money(Number(x.success_fee_net) + Number(x.success_fee_tax), x.currency)}</span>
                      <ActionForm action={updateSale} resetOnSuccess={false} className="flex items-center gap-2">
                        <input type="hidden" name="sale_id" value={x.id} /><input type="hidden" name="path" value={path} />
                        <Select name="status" defaultValue={x.status} className="h-8 w-28 py-0 text-xs" aria-label="Estado">
                          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </Select>
                        <Input name="invoice_no" defaultValue={x.invoice_no ?? ""} placeholder="Factura" className="h-8 w-24 text-xs" />
                        <Button type="submit" size="sm" variant="ghost">Guardar</Button>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Todavía no hay franquicias vendidas.</p>
              )}
              {plan && (
                <details className="mt-3">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden"><Plus className="size-4 text-brand" /> Registrar franquicia vendida</summary>
                  <ActionForm action={addFranchiseSale} className="mt-3 grid gap-3 sm:grid-cols-5">
                    <input type="hidden" name="brand_id" value={b.id} /><input type="hidden" name="path" value={path} />
                    <Field label="Franquiciado"><Input name="franchisee_name" required /></Field>
                    <Field label="Ciudad"><Input name="city" /></Field>
                    <Field label="Fecha de firma"><Input name="signed_at" type="date" required /></Field>
                    <Field label="Derecho de entrada"><Input name="entry_fee_amount" inputMode="decimal" required /></Field>
                    <div className="flex items-end"><Button type="submit">Registrar</Button></div>
                  </ActionForm>
                  <CardDescription className="mt-2">El fee de éxito ({Number(plan.success_fee_pct)} % + {Number(plan.tax_pct)} % de impuestos) se calcula automáticamente sobre el derecho de entrada.</CardDescription>
                </details>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
