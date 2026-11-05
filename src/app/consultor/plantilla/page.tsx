import type { Metadata } from "next";
import { PageTitle } from "@/components/consultor/page-title";
import { EscalaTile } from "@/components/escala/escala-tile";
import { GateDiamond } from "@/components/escala/gate-diamond";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { LEMA, PILLARS, SPECIALTY_LABEL, type Pillar } from "@/lib/escala";

export const metadata: Metadata = { title: "Plantilla ESCALA" };

export default async function PlantillaPage() {
  const { supabase } = await requireStaff();
  const [steps, gates, tasks, deliverables, criteria, requests] = await Promise.all([
    supabase.from("tpl_steps").select("*").order("sort"),
    supabase.from("tpl_gates").select("*").order("sort"),
    supabase.from("tpl_tasks").select("id, step_code, title, specialty, sort").order("sort"),
    supabase.from("tpl_deliverables").select("id, step_code, title, release_trigger, sort").order("sort"),
    supabase.from("tpl_criteria").select("*").order("sort"),
    supabase.from("tpl_info_requests").select("id, category, title, is_trademark").order("sort"),
  ]);

  return (
    <>
      <PageTitle
        eyebrow="Método ESCALA®"
        title="Plantilla ESCALA"
        description={`${LEMA}. Cada proyecto nuevo copia esta plantilla; luego todo se edita dentro del proyecto sin tocar la plantilla.`}
      />

      <div className="space-y-4">
        {steps.data?.map((s) => {
          const gate = gates.data?.find((g) => g.step_code === s.code);
          return (
            <Card key={s.code}>
              <div className="flex flex-wrap items-start gap-4">
                <EscalaTile letter={s.letter} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Etapa {s.stage} · Pilar {PILLARS[s.pillar as Pillar].name} · {s.ref_duration}
                  </p>
                  <p className="font-display text-xl font-black">{s.name}</p>
                  <p className="text-sm text-muted">{s.description}</p>
                </div>
                {gate && (
                  <div className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2">
                    <GateDiamond status="superada" size="md" />
                    <div className="text-xs">
                      <p className="font-black uppercase">{gate.name}</p>
                      <p className="max-w-56 text-muted">{gate.criterion}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-5 grid gap-6 border-t border-line/60 pt-5 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Tareas estándar</p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {tasks.data?.filter((t) => t.step_code === s.code).map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2">
                        <span>{t.title}</span>
                        {t.specialty && <Badge className="shrink-0">{SPECIALTY_LABEL[t.specialty]}</Badge>}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Entregables · se liberan con la cuota</p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {deliverables.data?.filter((d) => d.step_code === s.code).map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-2">
                        <span>{d.title}</span>
                        <Badge tone="dark" className="shrink-0">{d.release_trigger === "firma" ? "Firma" : d.release_trigger}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          );
        })}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <p className="font-display text-lg font-black">Matriz de franquiciabilidad</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {criteria.data?.map((c) => (
                <li key={c.code} className="flex justify-between gap-2">
                  <span>
                    {c.name} {c.is_veto && <Badge tone="brand">Veto</Badge>}
                  </span>
                  <span className="font-semibold tabular-nums">{Number(c.weight)} %</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <p className="font-display text-lg font-black">Información a solicitar al cliente</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {requests.data?.map((r) => (
                <li key={r.id} className="flex justify-between gap-2">
                  <span>{r.title}</span>
                  <span className="text-muted">{r.is_trademark ? "Regla 5" : r.category}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
