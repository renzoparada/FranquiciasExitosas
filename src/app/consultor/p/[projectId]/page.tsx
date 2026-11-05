import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, Lock, X } from "lucide-react";
import { PageTitle } from "@/components/consultor/page-title";
import { EscalaTile } from "@/components/escala/escala-tile";
import { GateDiamond } from "@/components/escala/gate-diamond";
import { MiniEscala } from "@/components/escala/mini-escala";
import { ProgressRing } from "@/components/escala/progress-ring";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { requireStaff } from "@/lib/auth";
import {
  ENTRY_FORMAT_LABEL,
  GATE_STATUS_LABEL,
  ROLE_LABEL,
  STEP_STATUS_LABEL,
  TRADEMARK_LABEL,
  type AppRole,
  type ProjectOverview,
} from "@/lib/escala";
import { day } from "@/lib/format";
import { addProjectMember, removeProjectMember, updateBrand, updateStep } from "../../actions";

export const metadata: Metadata = { title: "Proyecto" };

type Member = { profile_id: string; profiles: { full_name: string | null; email: string; role: AppRole } | null };

export default async function ProjectConsole(props: PageProps<"/consultor/p/[projectId]">) {
  const { projectId } = await props.params;
  const { supabase, profile } = await requireStaff();
  const isAdmin = profile.role === "admin";

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, start_date, currency, clients(name)")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: ov }, { data: brands }, { data: steps }, { data: members }, { data: staff }] = await Promise.all([
    supabase.rpc("get_project_overview", { p_project: projectId }),
    supabase.from("brands").select("id, name, week_offset, entry_format, trademark_status, first_opening_date").eq("project_id", projectId).order("sort"),
    supabase.from("brand_steps").select("id, brand_id, step_code").in(
      "brand_id",
      (await supabase.from("brands").select("id").eq("project_id", projectId)).data?.map((b) => b.id) ?? [],
    ),
    supabase.from("project_members").select("profile_id, profiles(full_name, email, role)").eq("project_id", projectId),
    isAdmin ? supabase.from("profiles").select("id, full_name, email, role").neq("role", "cliente").order("full_name") : Promise.resolve({ data: [] }),
  ]);
  const overview = ov as ProjectOverview;
  const memberList = (members ?? []) as unknown as Member[];
  const memberIds = new Set(memberList.map((m) => m.profile_id));
  const client = project.clients as unknown as { name: string } | null;

  return (
    <>
      <PageTitle
        eyebrow={client?.name}
        title={project.name}
        description={`Inicio ${day(project.start_date)} · Moneda ${project.currency === "BOB" ? "Bs" : "USD"}`}
        actions={
          <Button asChild variant="dark">
            <Link href={`/portal/${projectId}`}>
              <Eye /> Ver como cliente
            </Link>
          </Button>
        }
      />

      <Card className="mb-6 flex flex-wrap items-center gap-6">
        <ProgressRing value={overview.stats.overall_progress} size={90} stroke={8} />
        <div className="space-y-2">
          <MiniEscala brands={overview.brands} />
          <p className="text-sm text-muted">
            {overview.stats.info_pending} solicitudes de información pendientes · {overview.stats.deliverables_to_review} entregables en revisión del cliente
            {overview.stats.next_gate && ` · Próxima puerta ${overview.stats.next_gate.name.toUpperCase()} (${overview.stats.next_gate.brand}) el ${day(overview.stats.next_gate.date)}`}
          </p>
        </div>
      </Card>

      <div className="space-y-6">
        {overview.brands.map((b) => {
          const brand = brands?.find((x) => x.id === b.id);
          return (
            <Card key={b.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="size-3 rounded-full" style={{ background: b.color ?? "var(--brand)" }} />
                  <CardTitle className="text-xl">{b.name}</CardTitle>
                  <Badge tone={b.trademark_ok ? "ok" : "warn"}>
                    Marca: {TRADEMARK_LABEL[brand?.trademark_status ?? "sin_registro"]}
                  </Badge>
                  <Badge>{b.entry_format ? ENTRY_FORMAT_LABEL[b.entry_format] : "Formato por definir"}</Badge>
                </div>
                <span className="font-display text-2xl font-black">{b.progress}%</span>
              </div>

              {isAdmin && brand && (
                <ActionForm action={updateBrand} resetOnSuccess={false} className="mt-4 grid gap-3 rounded-2xl bg-surface-2 p-4 sm:grid-cols-5">
                  <input type="hidden" name="brand_id" value={b.id} />
                  <input type="hidden" name="project_id" value={projectId} />
                  <Field label="Registro de marca (regla 5)">
                    <Select name="trademark_status" defaultValue={brand.trademark_status}>
                      {Object.entries(TRADEMARK_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Formato de entrada (regla 3)">
                    <Select name="entry_format" defaultValue={brand.entry_format ?? ""}>
                      <option value="">Por definir</option>
                      {Object.entries(ENTRY_FORMAT_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Desfase (semanas)">
                    <Input name="week_offset" type="number" min={0} defaultValue={brand.week_offset} />
                  </Field>
                  <Field label="1.ª apertura (inicia L y A)">
                    <Input name="first_opening_date" type="date" defaultValue={brand.first_opening_date ?? ""} />
                  </Field>
                  <div className="flex items-end">
                    <Button type="submit" variant="outline" className="w-full">Guardar marca</Button>
                  </div>
                </ActionForm>
              )}

              <div className="mt-4 divide-y divide-line/60">
                {b.steps.map((s) => {
                  const row = steps?.find((x) => x.brand_id === b.id && x.step_code === s.code);
                  return (
                    <ActionForm
                      key={s.code}
                      action={updateStep}
                      resetOnSuccess={false}
                      className="grid items-center gap-3 py-3 sm:grid-cols-[auto_1fr_auto] lg:grid-cols-[auto_1.4fr_0.9fr_0.9fr_1fr_auto]"
                    >
                      <input type="hidden" name="step_id" value={row?.id} />
                      <input type="hidden" name="project_id" value={projectId} />
                      <EscalaTile
                        letter={s.letter}
                        size="md"
                        state={s.status === "cerrado" ? "done" : s.status === "pendiente" ? (s.locked ? "locked" : "pending") : "current"}
                      />
                      <div className="min-w-0">
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-xs text-muted">
                          {s.progress}% de tareas · {STEP_STATUS_LABEL[s.status]}
                          {s.locked && (
                            <span className="ml-1 inline-flex items-center gap-1 text-brand">
                              <Lock className="size-3" /> Bloqueado: falta registro de marca
                            </span>
                          )}
                        </p>
                      </div>
                      {isAdmin ? (
                        <>
                          <Input name="planned_start" type="date" defaultValue={s.planned_start ?? ""} aria-label="Inicio planificado" />
                          <Input name="planned_end" type="date" defaultValue={s.planned_end ?? ""} aria-label="Fin planificado" />
                          <Select name="status" defaultValue={s.status} aria-label="Estado">
                            {Object.entries(STEP_STATUS_LABEL).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </Select>
                          <Button type="submit" variant="ghost" size="sm">Guardar</Button>
                        </>
                      ) : (
                        <p className="text-sm text-muted">
                          {day(s.planned_start, "d MMM")} – {day(s.planned_end, "d MMM yyyy")}
                        </p>
                      )}
                    </ActionForm>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap gap-3 border-t border-line/60 pt-4">
                {b.gates.map((g) => (
                  <div key={g.code} className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2">
                    <GateDiamond status={g.status} size="sm" />
                    <div className="text-xs">
                      <p className="font-black uppercase">{g.name}</p>
                      <p className="text-muted">
                        {g.status === "pendiente" ? day(g.planned_date, "d MMM yyyy") : GATE_STATUS_LABEL[g.status]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}

        <Card>
          <CardTitle>Equipo del proyecto</CardTitle>
          <ul className="mt-3 divide-y divide-line/60">
            {memberList.map((m) => (
              <li key={m.profile_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>
                  <span className="font-semibold">{m.profiles?.full_name}</span> <span className="text-muted">{m.profiles?.email}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={m.profiles?.role === "cliente" ? "brand" : "neutral"}>{ROLE_LABEL[m.profiles?.role ?? "cliente"]}</Badge>
                  {isAdmin && m.profile_id !== profile.id && (
                    <form action={removeProjectMember}>
                      <input type="hidden" name="project_id" value={projectId} />
                      <input type="hidden" name="profile_id" value={m.profile_id} />
                      <button className="rounded-full p-1 text-muted hover:bg-surface-2 hover:text-brand" aria-label="Quitar del proyecto">
                        <X className="size-4" />
                      </button>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {isAdmin && (
            <ActionForm action={addProjectMember} className="mt-4 flex flex-wrap gap-2">
              <input type="hidden" name="project_id" value={projectId} />
              <Select name="profile_id" defaultValue="" className="max-w-sm" aria-label="Persona">
                <option value="">Agregar consultor o especialista…</option>
                {(staff ?? [])
                  .filter((s) => !memberIds.has(s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} · {ROLE_LABEL[s.role as AppRole]}
                    </option>
                  ))}
              </Select>
              <Button type="submit" variant="outline">Agregar</Button>
            </ActionForm>
          )}
          <p className="mt-3 text-xs text-muted">Los usuarios del cliente se agregan desde Clientes → Invitar.</p>
        </Card>
      </div>
    </>
  );
}
