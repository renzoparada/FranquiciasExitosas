import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saveScore } from "@/app/actions/analysis";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { FileList } from "@/components/project/file-list";
import { FileUploader } from "@/components/project/file-uploader";
import { getBrands, getFiles, signedFiles } from "@/lib/data";
import { cn } from "@/lib/utils";
import { DataLabelBadge, LabelSelect } from "./data-label-badge";
import { MatrixRadar } from "./radar";

type Criterion = { code: string; name: string; weight: number; is_veto: boolean; guide: string | null };
type Score = { id: string; brand_id: string; criterion_code: string; score: number | null; evidence: string | null; data_label: string | null };
type Result = { brand_id: string; weighted_avg: number | null; vetoed: boolean | null; traffic_light: string; scored: number; total_criteria: number };

export const SEMAFORO: Record<string, { label: string; text: string; cls: string }> = {
  verde: { label: "Franquiciar", text: "4,0 – 5,0", cls: "bg-ok text-white" },
  amarillo: { label: "Ajustar", text: "3,0 – 3,9", cls: "bg-warn text-ink" },
  rojo: { label: "Todavía no", text: "menos de 3,0", cls: "bg-bad text-white" },
  incompleto: { label: "Incompleta", text: "faltan criterios", cls: "bg-surface-2 text-muted" },
};

export async function MatrixSection({
  supabase,
  projectId,
  base,
  editable,
  searchParams,
  gatesBase,
}: {
  supabase: SupabaseClient;
  projectId: string;
  base: string;
  editable: boolean;
  searchParams: Record<string, string | string[] | undefined>;
  gatesBase: string;
}) {
  const brands = await getBrands(supabase, projectId);
  const marca = typeof searchParams.marca === "string" ? searchParams.marca : brands[0]?.id;
  const brand = brands.find((b) => b.id === marca) ?? brands[0];
  const ids = brands.map((b) => b.id);
  const [{ data: crit }, { data: sc }, { data: res }, { data: gate }] = await Promise.all([
    supabase.from("tpl_criteria").select("code, name, weight, is_veto, guide").order("sort"),
    supabase.from("franchisability_scores").select("id, brand_id, criterion_code, score, evidence, data_label").in("brand_id", ids),
    supabase.from("v_franchisability").select("brand_id, weighted_avg, vetoed, traffic_light, scored, total_criteria").in("brand_id", ids),
    supabase.from("brand_gates").select("id").eq("brand_id", brand?.id ?? "").eq("gate_code", "FRANQUICIABLE").maybeSingle(),
  ]);
  const criteria = (crit ?? []) as Criterion[];
  const scores = (sc ?? []) as Score[];
  const results = (res ?? []) as Result[];
  const r = results.find((x) => x.brand_id === brand?.id);
  const brandScores = scores.filter((s) => s.brand_id === brand?.id);
  const files = await signedFiles(supabase, await getFiles(supabase, "fscore", brandScores.map((s) => s.id), !editable));
  const radar = criteria.map((c) => ({
    criterio: c.name.replace("Disposición del fundador", "Fundador").replace("Simplicidad operativa", "Simplicidad").replace("Concepto diferenciado", "Concepto"),
    ...Object.fromEntries(brands.map((b) => [b.name, scores.find((s) => s.brand_id === b.id && s.criterion_code === c.code)?.score ?? 0])),
  }));
  const path = base.split("?")[0];
  const light = SEMAFORO[r?.traffic_light ?? "incompleto"];

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
        {gate && (
          <Link href={`${gatesBase}/${gate.id}`} className="text-sm font-semibold text-brand hover:underline">
            Alimenta el acta de la puerta FRANQUICIABLE →
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Card className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Promedio ponderado · {brand?.name}</p>
          <p className="font-display text-7xl font-black tabular-nums">
            {r?.weighted_avg !== null && r?.weighted_avg !== undefined ? Number(r.weighted_avg).toFixed(2).replace(".", ",") : "—"}
          </p>
          <span className={cn("rounded-full px-4 py-1.5 text-sm font-black", light.cls)}>{light.label}</span>
          <p className="text-xs text-muted">
            {r?.scored ?? 0} de {r?.total_criteria ?? criteria.length} criterios · {light.text}
          </p>
          {r?.vetoed && (
            <p className="mt-2 flex items-center gap-2 rounded-xl bg-bad/10 px-3 py-2 text-sm font-semibold text-bad">
              <ShieldAlert className="size-4" /> Veto: rentabilidad o protección legal con puntaje 1
            </p>
          )}
          <div className="mt-4 flex gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-ok" />4,0–5,0 franquiciar</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-warn" />3,0–3,9 ajustar</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-bad" />&lt;3,0 todavía no</span>
          </div>
        </Card>
        <Card>
          <CardTitle>Radar comparativo por marca</CardTitle>
          <MatrixRadar data={radar} brands={brands.map((b) => b.name)} />
        </Card>
      </div>

      <Card className="p-0">
        <div className="border-b border-line/60 px-5 py-4">
          <CardTitle>Criterios</CardTitle>
          <CardDescription>Puntaje de 1 a 5 con evidencia. Cada puntaje lleva su etiqueta (regla 1).</CardDescription>
        </div>
        <ul className="divide-y divide-line/50">
          {criteria.map((c) => {
            const s = brandScores.find((x) => x.criterion_code === c.code);
            const f = s ? files.filter((x) => x.entity_id === s.id) : [];
            return (
              <li key={c.code} className="grid gap-3 px-5 py-4 lg:grid-cols-[1.1fr_2fr]">
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {c.name} <Badge>{Number(c.weight)} %</Badge> {c.is_veto && <Badge tone="brand">Veto si es 1</Badge>}
                  </p>
                  <p className="text-xs text-muted">{c.guide}</p>
                </div>
                {editable ? (
                  <div className="space-y-2">
                    <ActionForm action={saveScore} resetOnSuccess={false} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="brand_id" value={brand?.id} />
                      <input type="hidden" name="criterion_code" value={c.code} />
                      <input type="hidden" name="path" value={path} />
                      <div className="flex overflow-hidden rounded-xl border border-line" role="radiogroup" aria-label={`Puntaje de ${c.name}`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <label key={n} className="cursor-pointer">
                            <input type="radio" name="score" value={n} defaultChecked={s?.score === n} className="peer sr-only" />
                            <span className="flex size-9 items-center justify-center border-r border-line text-sm font-bold last:border-r-0 peer-checked:bg-brand peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand hover:bg-surface-2">
                              {n}
                            </span>
                          </label>
                        ))}
                      </div>
                      <LabelSelect name="data_label" defaultValue={s?.data_label} />
                      <Input name="evidence" defaultValue={s?.evidence ?? ""} placeholder="Evidencia que respalda el puntaje" className="h-9 min-w-48 flex-1 text-xs" />
                      <Button type="submit" size="sm" variant="outline">Guardar</Button>
                    </ActionForm>
                    {s && (
                      <div className="flex flex-wrap items-start gap-2">
                        {f.length > 0 && <div className="min-w-0 flex-1"><FileList files={f} /></div>}
                        <div className="w-56">
                          <FileUploader target={{ projectId, brandId: brand?.id, entityType: "fscore", entityId: s.id, visibility: "cliente" }} label="Adjuntar evidencia" compact />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-display text-2xl font-black">{s?.score ?? "—"}</span>
                    <DataLabelBadge label={s?.data_label} empty={!s?.score} />
                    {s?.evidence && <span className="text-sm text-muted">{s.evidence}</span>}
                    {f.length > 0 && <div className="w-full"><FileList files={f} /></div>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
