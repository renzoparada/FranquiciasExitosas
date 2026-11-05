import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown, MessageSquareWarning, Send, ShieldCheck } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { observeMinutes, saveMinutes, sendMinutes } from "@/app/actions/project";
import { GateDiamond } from "@/components/escala/gate-diamond";
import { EscalaTile } from "@/components/escala/escala-tile";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import type { Profile } from "@/lib/auth";
import { REVIEW_LABEL, type ReviewStatus } from "@/lib/data";
import { GATES, GATE_STATUS_LABEL, STEPS, type GateStatus } from "@/lib/escala";
import { dateTime, day } from "@/lib/format";
import { ApproveMinutesForm } from "./approve-minutes-form";
import { CelebrateGate } from "@/components/escala/celebrate-gate";

type Content = { antecedentes?: string; resultados?: string; decision?: string; decision_texto?: string; proximos_pasos?: string };
const DECISION_LABEL: Record<string, string> = { franquiciar: "Franquiciar", ajustar: "Ajustar antes de franquiciar", no_franquiciar: "Todavía no franquiciar" };
const SEMAFORO: Record<string, { label: string; cls: string }> = {
  verde: { label: "Franquiciar", cls: "bg-ok text-white" },
  amarillo: { label: "Ajustar", cls: "bg-warn text-ink" },
  rojo: { label: "Todavía no", cls: "bg-bad text-white" },
  incompleto: { label: "Matriz incompleta", cls: "bg-surface-2 text-muted" },
};

export async function GateDetail({
  supabase,
  profile,
  projectId,
  gateId,
  base,
  clientView,
}: {
  supabase: SupabaseClient;
  profile: Profile;
  projectId: string;
  gateId: string;
  base: string;
  clientView: boolean;
}) {
  const { data: gate } = await supabase
    .from("brand_gates")
    .select("id, brand_id, gate_code, status, planned_date, passed_at, decision, brands!inner(name, project_id)")
    .eq("id", gateId)
    .eq("brands.project_id", projectId)
    .maybeSingle();
  if (!gate) notFound();
  const def = GATES.find((g) => g.code === gate.gate_code)!;
  const step = STEPS.find((s) => s.code === def.step)!;
  const brandName = (gate.brands as unknown as { name: string }).name;
  const path = `${base}/${gateId}`;
  const isAdmin = profile.role === "admin" && !clientView;

  let mq = supabase.from("gate_minutes").select("*").eq("brand_gate_id", gateId).order("version", { ascending: false }).limit(1);
  if (clientView) mq = mq.neq("status", "borrador");
  const { data: mrow } = await mq.maybeSingle();
  const minutes = mrow as
    | { id: string; title: string; content: Content; status: ReviewStatus; sent_at: string | null; approved_by_name: string | null; approved_at: string | null; content_hash: string | null; observation: string | null }
    | null;

  const { data: matrix } =
    gate.gate_code === "FRANQUICIABLE"
      ? await supabase.from("v_franchisability").select("weighted_avg, traffic_light, vetoed, scored, total_criteria").eq("brand_id", gate.brand_id).maybeSingle()
      : { data: null };
  const c = minutes?.content ?? {};
  const editable = isAdmin && (!minutes || minutes.status === "borrador" || minutes.status === "observado");

  return (
    <div className="space-y-6">
      <Link href={base} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand">
        <ArrowLeft className="size-4" /> Puertas
      </Link>
      {clientView && gate.status === "superada" && <CelebrateGate gateId={gate.id} gateName={def.name} passedAt={gate.passed_at} />}

      <Card className="flex flex-wrap items-center gap-5">
        <GateDiamond status={gate.status as GateStatus} size="lg" className="mx-2" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Puerta de decisión · {brandName}</p>
          <h1 className="font-display text-3xl font-black uppercase">{def.name}</h1>
          <p className="text-sm text-muted">{def.criterion}</p>
        </div>
        <div className="text-right text-sm">
          <p className="flex items-center justify-end gap-1.5">
            Cierra el paso <EscalaTile letter={step.letter} size="xs" /> <strong>{step.name}</strong>
          </p>
          <p className="text-muted">
            {gate.status === "superada" ? `Superada el ${dateTime(gate.passed_at)}` : `${GATE_STATUS_LABEL[gate.status as GateStatus]} · prevista ${day(gate.planned_date)}`}
          </p>
        </div>
      </Card>

      {matrix && (
        <Card className="flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <CardTitle>Matriz de franquiciabilidad</CardTitle>
            <p className="text-sm text-muted">
              {matrix.scored} de {matrix.total_criteria} criterios puntuados{matrix.vetoed ? " · veto por rentabilidad o protección legal" : ""}
            </p>
          </div>
          <span className="font-display text-3xl font-black">{matrix.weighted_avg ?? "—"}</span>
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${SEMAFORO[matrix.traffic_light]?.cls}`}>{SEMAFORO[matrix.traffic_light]?.label}</span>
        </Card>
      )}

      {/* Acta */}
      {minutes && !editable && (
        <Card className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-xl">{minutes.title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge tone={minutes.status === "aprobado" ? "ok" : minutes.status === "enviado" ? "brand" : "warn"}>
                {minutes.status === "enviado" ? "Por aprobar" : REVIEW_LABEL[minutes.status]}
              </Badge>
              <Button asChild variant="outline" size="sm">
                <a href={`/api/pdf/acta/${minutes.id}`} target="_blank" rel="noreferrer">
                  <FileDown /> PDF
                </a>
              </Button>
            </div>
          </div>
          {[
            ["Antecedentes", c.antecedentes],
            ["Resultados", c.resultados],
            ["Decisión", [c.decision && DECISION_LABEL[c.decision], c.decision_texto].filter(Boolean).join(". ")],
            ["Próximos pasos", c.proximos_pasos],
          ].map(([label, text]) =>
            text ? (
              <section key={label}>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</h4>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
              </section>
            ) : null,
          )}
          {minutes.status === "aprobado" && (
            <div className="flex items-start gap-3 rounded-2xl bg-ok/10 p-4 text-sm">
              <ShieldCheck className="mt-0.5 size-5 text-ok" />
              <div>
                <p className="font-semibold">
                  Aprobada por {minutes.approved_by_name} el {dateTime(minutes.approved_at, "d 'de' MMMM yyyy 'a las' HH:mm")} (La Paz)
                </p>
                <p className="break-all text-xs text-muted">Huella del contenido: {minutes.content_hash}</p>
              </div>
            </div>
          )}
          {isAdmin && minutes.status === "enviado" && <p className="text-sm text-muted">Enviada el {dateTime(minutes.sent_at)}. Esperando la aprobación del cliente.</p>}
        </Card>
      )}

      {minutes?.status === "observado" && minutes.observation && (
        <Card className="border-warn/40 bg-warn/5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquareWarning className="size-4 text-warn" /> Observación del cliente
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{minutes.observation}</p>
        </Card>
      )}

      {!minutes && !isAdmin && <Card className="text-sm text-muted">El acta de esta puerta todavía no fue enviada.</Card>}

      {/* Aprobación del cliente */}
      {minutes?.status === "enviado" && clientView && profile.role === "cliente" && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <ApproveMinutesForm
            minutesId={minutes.id}
            projectId={projectId}
            gateId={gate.id}
            gateName={def.name}
            defaultName={profile.full_name ?? ""}
            path={path}
          />
          <ActionForm action={observeMinutes} className="space-y-3 rounded-3xl border border-line bg-surface p-5">
            <input type="hidden" name="minutes_id" value={minutes.id} />
            <input type="hidden" name="path" value={path} />
            <p className="font-display font-black">¿Algo por corregir?</p>
            <Textarea name="observation" required placeholder="Indica qué hay que ajustar en el acta" />
            <Button type="submit" variant="outline">
              <MessageSquareWarning /> Enviar observación
            </Button>
          </ActionForm>
        </div>
      )}

      {/* Editor del consultor */}
      {editable && (
        <Card>
          <CardTitle>{minutes ? "Editar acta" : "Redactar acta"}</CardTitle>
          <ActionForm action={saveMinutes} resetOnSuccess={false} className="mt-4 space-y-4">
            <input type="hidden" name="brand_gate_id" value={gate.id} />
            <input type="hidden" name="path" value={path} />
            {minutes && <input type="hidden" name="minutes_id" value={minutes.id} />}
            <Field label="Título">
              <Input name="title" defaultValue={minutes?.title ?? `Acta de la puerta ${def.name.toUpperCase()} · ${brandName}`} />
            </Field>
            <Field label="Antecedentes">
              <Textarea name="antecedentes" defaultValue={c.antecedentes} placeholder="Qué se trabajó en el paso y con qué información." />
            </Field>
            <Field label="Resultados">
              <Textarea name="resultados" defaultValue={c.resultados} placeholder="Hallazgos y entregables que respaldan la decisión." />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              {gate.gate_code === "FRANQUICIABLE" && (
                <Field label="Decisión">
                  <Select name="decision" defaultValue={c.decision ?? gate.decision ?? ""}>
                    <option value="">Elegir…</option>
                    {Object.entries(DECISION_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Decisión (texto)">
                <Input name="decision_texto" defaultValue={c.decision_texto} placeholder={def.criterion} />
              </Field>
            </div>
            <Field label="Próximos pasos">
              <Textarea name="proximos_pasos" defaultValue={c.proximos_pasos} />
            </Field>
            <Button type="submit" variant="outline">Guardar borrador</Button>
          </ActionForm>
          {minutes && (
            <ActionForm action={sendMinutes} className="mt-4 border-t border-line/60 pt-4">
              <input type="hidden" name="minutes_id" value={minutes.id} />
              <input type="hidden" name="path" value={path} />
              <Button type="submit">
                <Send /> Enviar acta al cliente para aprobación
              </Button>
              <a href={`/api/pdf/acta/${minutes.id}`} target="_blank" rel="noreferrer" className="ml-4 text-sm font-semibold text-muted hover:text-brand">
                Vista previa PDF
              </a>
            </ActionForm>
          )}
        </Card>
      )}
    </div>
  );
}
