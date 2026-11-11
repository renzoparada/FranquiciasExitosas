import Link from "next/link";
import { CheckCircle2, Lock } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saveScenario, saveTerms, validatePayback } from "@/app/actions/analysis";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { getBrands } from "@/lib/data";
import { ENTRY_FORMAT_LABEL } from "@/lib/escala";
import { derive, fmtMetric, FIN_METRICS, SCENARIOS, type FinMetric } from "@/lib/finance";
import { dateTime, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DataLabelBadge, LabelSelect } from "./data-label-badge";
import { FinanceCharts } from "./finance-charts";
import { FinanceImport } from "./finance-import";

type Value = { metric: FinMetric; value: number | null; data_label: string | null };
type Scenario = { id: string; scenario: string; format: string | null; notes: string | null; financial_values: Value[] };
type Terms = { entry_fee: number | null; royalty_pct: number | null; marketing_fund_pct: number | null; data_label: string | null; payback_validated_at: string | null } | null;

export async function FinanceSection({
  supabase,
  projectId,
  base,
  editable,
  isAdmin,
  searchParams,
}: {
  supabase: SupabaseClient;
  projectId: string;
  base: string;
  editable: boolean;
  isAdmin: boolean;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const [brands, { data: project }] = await Promise.all([getBrands(supabase, projectId), supabase.from("projects").select("currency").eq("id", projectId).single()]);
  const currency = (project?.currency ?? "BOB") as "BOB" | "USD";
  const marca = typeof searchParams.marca === "string" ? searchParams.marca : brands[0]?.id;
  const brand = brands.find((b) => b.id === marca) ?? brands[0];
  const [{ data: sc }, { data: terms }, { data: brandRow }] = await Promise.all([
    supabase.from("financial_scenarios").select("id, scenario, format, notes, financial_values(metric, value, data_label)").eq("brand_id", brand?.id ?? ""),
    supabase.from("franchise_terms").select("entry_fee, royalty_pct, marketing_fund_pct, data_label, payback_validated_at").eq("brand_id", brand?.id ?? "").maybeSingle(),
    supabase.from("brands").select("entry_format").eq("id", brand?.id ?? "").maybeSingle(),
  ]);
  const scenarios = (sc ?? []) as Scenario[];
  const t = terms as Terms;
  const path = base.split("?")[0];

  const valueOf = (s: string, m: FinMetric) => scenarios.find((x) => x.scenario === s)?.financial_values.find((v) => v.metric === m);
  const numbers = (s: string) => Object.fromEntries(FIN_METRICS.map((m) => [m.key, valueOf(s, m.key)?.value ?? null])) as Partial<Record<FinMetric, number | null>>;
  const chart = SCENARIOS.map((s) => {
    const n = numbers(s.key);
    const d = derive(n);
    const ebitda = n.ebitda_mensual ?? d.ebitda_mensual ?? null;
    return { escenario: s.label, Inversión: n.inversion ?? null, "EBITDA anual": ebitda !== null ? ebitda * 12 : null, Payback: n.payback_meses ?? d.payback_meses ?? null };
  });
  const moderatePayback = valueOf("moderado", "payback_meses");
  const validated = !!t?.payback_validated_at;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {brands.length > 1 && (
          <div className="flex gap-1 rounded-full border border-line bg-surface p-1 text-sm">
            {brands.map((b) => (
              <Link key={b.id} href={`${base}${base.includes("?") ? "&" : "?"}marca=${b.id}`} className={cn("rounded-full px-4 py-1.5 font-semibold", b.id === brand?.id ? "bg-ink text-canvas" : "text-muted hover:text-ink")}>
                {b.name}
              </Link>
            ))}
          </div>
        )}
        <p className="text-sm text-muted">
          Formato de entrada (regla 3): <strong className="text-ink">{brandRow?.entry_format ? ENTRY_FORMAT_LABEL[brandRow.entry_format] : "por definir"}</strong>
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Escenarios de la unidad franquiciada</CardTitle>
            <CardDescription>Cifras por mes salvo que se indique. Sin cifra → [POR CONFIRMAR]. Los valores “calculados” son referencia y no se guardan.</CardDescription>
          </div>
          {editable && brand && <FinanceImport brandId={brand.id} currency={currency} path={path} />}
        </div>
        <div className="mt-6">
          <FinanceCharts data={chart} currency={currency} />
        </div>
      </Card>

      {editable ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {SCENARIOS.map((s) => {
            const row = scenarios.find((x) => x.scenario === s.key);
            const d = derive(numbers(s.key));
            return (
              <Card key={s.key} className={cn(s.key === "moderado" && "ring-2 ring-brand/30")}>
                <CardTitle>{s.label}</CardTitle>
                <ActionForm action={saveScenario} resetOnSuccess={false} className="mt-4 space-y-3">
                  <input type="hidden" name="brand_id" value={brand?.id} />
                  <input type="hidden" name="scenario" value={s.key} />
                  <input type="hidden" name="currency" value={currency} />
                  <input type="hidden" name="path" value={path} />
                  {FIN_METRICS.map((m) => {
                    const v = valueOf(s.key, m.key);
                    return (
                      <div key={m.key}>
                        <label className="text-xs font-semibold text-muted">
                          {m.label} <span className="font-normal">({m.unit === "money" ? (currency === "USD" ? "USD" : "Bs") : m.unit === "pct" ? "%" : "meses"})</span>
                        </label>
                        <div className="mt-1 flex gap-2">
                          <Input name={`v_${m.key}`} inputMode="decimal" defaultValue={v?.value ?? ""} placeholder="[POR CONFIRMAR]" className="h-9 text-sm" />
                          <LabelSelect name={`l_${m.key}`} defaultValue={v?.data_label} className="w-32 shrink-0" />
                        </div>
                        {d[m.key] !== undefined && (v?.value === null || v?.value === undefined) && (
                          <p className="mt-0.5 text-[11px] text-muted">Calculado: {fmtMetric(d[m.key], m.unit, currency)}</p>
                        )}
                      </div>
                    );
                  })}
                  <Field label="Formato del escenario">
                    <Select name="format" defaultValue={row?.format ?? ""}>
                      <option value="">Formato de entrada de la marca</option>
                      {Object.entries(ENTRY_FORMAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </Select>
                  </Field>
                  <Input name="notes" defaultValue={row?.notes ?? ""} placeholder="Supuestos clave del escenario" className="text-sm" />
                  <Button type="submit" className="w-full">Guardar {s.label.toLowerCase()}</Button>
                </ActionForm>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line/60 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3">Métrica</th>
                {SCENARIOS.map((s) => <th key={s.key} className="px-3 py-3">{s.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/50">
              {FIN_METRICS.map((m) => (
                <tr key={m.key}>
                  <td className="px-5 py-3 font-medium">{m.label}</td>
                  {SCENARIOS.map((s) => {
                    const v = valueOf(s.key, m.key);
                    return (
                      <td key={s.key} className="px-3 py-3">
                        <div className="font-semibold">{v?.value !== null && v?.value !== undefined ? fmtMetric(Number(v.value), m.unit, currency) : ""}</div>
                        <DataLabelBadge label={v?.data_label} empty={v?.value === null || v?.value === undefined} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Regla 2 · El franquiciado gana primero */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Regla 2 · El franquiciado gana primero</p>
          <CardTitle className="mt-1">Payback del franquiciado</CardTitle>
          <p className="mt-3 font-display text-4xl font-black">
            {moderatePayback?.value !== null && moderatePayback?.value !== undefined ? fmtMetric(Number(moderatePayback.value), "months") : "[POR CONFIRMAR]"}
          </p>
          <p className="text-sm text-muted">Escenario moderado {moderatePayback?.data_label && <DataLabelBadge label={moderatePayback.data_label} />}</p>
          {validated ? (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-ok/10 px-3 py-2 text-sm font-semibold text-ok">
              <CheckCircle2 className="size-4" /> Validado el {dateTime(t!.payback_validated_at)}
            </p>
          ) : isAdmin ? (
            <ActionForm action={validatePayback} className="mt-4">
              <input type="hidden" name="brand_id" value={brand?.id} />
              <input type="hidden" name="path" value={path} />
              <Button type="submit" disabled={moderatePayback?.value === null || moderatePayback?.value === undefined}>
                <CheckCircle2 /> Validar payback
              </Button>
              <p className="mt-2 text-xs text-muted">Valida el payback del escenario moderado. Esto respalda la puerta RENTABLE.</p>
            </ActionForm>
          ) : (
            <p className="mt-4 text-sm text-muted">Pendiente de validación.</p>
          )}
        </Card>

        <Card>
          <CardTitle>Canon, regalía y fondo de marketing</CardTitle>
          {isAdmin ? (
            <ActionForm action={saveTerms} resetOnSuccess={false} className="mt-4 space-y-3">
              <input type="hidden" name="brand_id" value={brand?.id} />
              <input type="hidden" name="currency" value={currency} />
              <input type="hidden" name="path" value={path} />
              {!validated && (
                <p className="flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand">
                  <Lock className="size-4" /> Bloqueado hasta validar el payback del franquiciado.
                </p>
              )}
              <fieldset disabled={!validated} className="grid gap-3 sm:grid-cols-2 disabled:opacity-50">
                <Field label={`Derecho de entrada (${currency === "USD" ? "USD" : "Bs"})`}><Input name="entry_fee" inputMode="decimal" defaultValue={t?.entry_fee ?? ""} /></Field>
                <Field label="Regalía (% de ventas)"><Input name="royalty_pct" inputMode="decimal" defaultValue={t?.royalty_pct ?? ""} /></Field>
                <Field label="Fondo de marketing (%)"><Input name="marketing_fund_pct" inputMode="decimal" defaultValue={t?.marketing_fund_pct ?? ""} /></Field>
                <Field label="Etiqueta"><LabelSelect name="data_label" defaultValue={t?.data_label} className="h-11 w-full rounded-xl text-sm" /></Field>
                <div className="sm:col-span-2"><Button type="submit">Guardar condiciones</Button></div>
              </fieldset>
            </ActionForm>
          ) : (
            <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div><dt className="text-xs text-muted">Derecho de entrada</dt><dd className="font-semibold">{t?.entry_fee != null ? money(Number(t.entry_fee), currency) : "[POR CONFIRMAR]"}</dd></div>
              <div><dt className="text-xs text-muted">Regalía</dt><dd className="font-semibold">{t?.royalty_pct != null ? `${Number(t.royalty_pct)} %` : "[POR CONFIRMAR]"}</dd></div>
              <div><dt className="text-xs text-muted">Fondo de marketing</dt><dd className="font-semibold">{t?.marketing_fund_pct != null ? `${Number(t.marketing_fund_pct)} %` : "[POR CONFIRMAR]"}</dd></div>
            </dl>
          )}
        </Card>
      </div>
    </div>
  );
}
