import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectOverview } from "@/lib/escala";

export type ReportSnapshot = {
  project: string;
  client: string;
  period: { start: string; end: string };
  overall: number;
  brands: { name: string; progress: number; letters: { letter: string; status: string; locked: boolean }[]; gates: { name: string; status: string; date: string | null }[] }[];
  done: { title: string; letter: string | null; brand: string | null }[];
  next: { title: string; letter: string | null; brand: string | null; due: string | null }[];
  risks: string[];
  pending: string[];
  note: string | null;
};

const LETTER: Record<string, string> = { E: "E", S: "S", C: "C", A1: "A", L: "L", A2: "A" };

/** Arma el contenido del informe quincenal (solo información visible para el cliente). */
export async function buildReportSnapshot(supabase: SupabaseClient, projectId: string, start: string, end: string, note: string): Promise<ReportSnapshot> {
  const plus15 = new Date(new Date(`${end}T12:00:00Z`).getTime() + 15 * 864e5).toISOString().slice(0, 10);
  const [{ data: project }, { data: ov }, done, next, overdue, decisions, minutes, deliverables, observed] = await Promise.all([
    supabase.from("projects").select("name, clients(name)").eq("id", projectId).single(),
    supabase.rpc("get_project_overview", { p_project: projectId }),
    supabase.from("tasks").select("title, step_code, brands(name)").eq("project_id", projectId).eq("visibility", "cliente").eq("status", "hecho")
      .gte("completed_at", `${start}T00:00:00-04:00`).order("completed_at").limit(12),
    supabase.from("tasks").select("title, step_code, due_date, brands(name)").eq("project_id", projectId).eq("visibility", "cliente").neq("status", "hecho")
      .gte("due_date", end).lte("due_date", plus15).order("due_date").limit(10),
    supabase.from("tasks").select("title, due_date").eq("project_id", projectId).eq("visibility", "cliente").neq("status", "hecho").lt("due_date", end).order("due_date").limit(5),
    supabase.from("decisions").select("title").eq("project_id", projectId).eq("visibility", "cliente").eq("status", "pendiente").limit(5),
    supabase.from("gate_minutes").select("title, brand_gates!inner(brands!inner(project_id))").eq("brand_gates.brands.project_id", projectId).eq("status", "enviado"),
    supabase.from("deliverables").select("title, brands!inner(project_id)").eq("brands.project_id", projectId).eq("visibility", "cliente").eq("status", "enviado"),
    supabase.from("deliverables").select("title, brands!inner(project_id)").eq("brands.project_id", projectId).eq("visibility", "cliente").eq("status", "observado"),
  ]);
  const o = ov as ProjectOverview;
  const brandName = (b: unknown) => (b as { name: string } | null)?.name ?? null;

  const risks: string[] = [];
  if (overdue.data?.length) risks.push(`${overdue.data.length} tarea(s) con fecha vencida: ${overdue.data.map((t) => t.title).slice(0, 3).join("; ")}.`);
  o.brands.forEach((b) => {
    if (!b.trademark_ok) risks.push(`${b.name}: sin registro de marca validado; el paso Atraer queda bloqueado (regla 5).`);
    if (!b.entry_format) risks.push(`${b.name}: falta definir el formato de entrada (regla 3).`);
  });
  if (o.stats.info_pending) risks.push(`${o.stats.info_pending} solicitud(es) de información pendientes del cliente.`);
  if (observed.data?.length) risks.push(`${observed.data.length} entregable(s) con observaciones por resolver.`);

  const pending = [
    ...(minutes.data ?? []).map((m) => `Aprobar: ${m.title}`),
    ...(deliverables.data ?? []).map((d) => `Revisar entregable: ${d.title}`),
    ...(decisions.data ?? []).map((d) => `Decidir: ${d.title}`),
  ];

  return {
    project: project?.name ?? "",
    client: (project?.clients as unknown as { name: string } | null)?.name ?? "",
    period: { start, end },
    overall: o.stats.overall_progress,
    brands: o.brands.map((b) => ({
      name: b.name,
      progress: b.progress,
      letters: b.steps.map((s) => ({ letter: s.letter, status: s.status, locked: s.locked })),
      gates: b.gates.map((g) => ({ name: g.name, status: g.status, date: g.planned_date })),
    })),
    done: (done.data ?? []).map((t) => ({ title: t.title, letter: t.step_code ? LETTER[t.step_code] : null, brand: brandName(t.brands) })),
    next: (next.data ?? []).map((t) => ({ title: t.title, letter: t.step_code ? LETTER[t.step_code] : null, brand: brandName(t.brands), due: t.due_date })),
    risks,
    pending,
    note: note || null,
  };
}
