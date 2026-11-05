import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StepCode, StepStatus, GateCode, GateStatus } from "@/lib/escala";

export type TaskStatus = "por_hacer" | "en_curso" | "en_revision" | "hecho";
export type Priority = "baja" | "media" | "alta" | "urgente";
export type Visibility = "interno" | "cliente";
export type ReviewStatus = "borrador" | "enviado" | "observado" | "aprobado";
export type RequestStatus = "pendiente" | "recibido" | "observado" | "validado";

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  por_hacer: "Por hacer",
  en_curso: "En curso",
  en_revision: "En revisión",
  hecho: "Hecho",
};
export const PRIORITY_LABEL: Record<Priority, string> = { baja: "Baja", media: "Media", alta: "Alta", urgente: "Urgente" };
export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  borrador: "Borrador",
  enviado: "Por revisar",
  observado: "Observado",
  aprobado: "Aprobado",
};
export const REQUEST_LABEL: Record<RequestStatus, string> = {
  pendiente: "Pendiente",
  recibido: "Recibido",
  observado: "Observado",
  validado: "Validado",
};

export type Brand = { id: string; name: string; color: string | null; sort: number };
export type Person = { id: string; full_name: string | null; email: string; role: string; specialty: string | null };

export type Task = {
  id: string;
  project_id: string;
  brand_id: string | null;
  step_code: StepCode | null;
  title: string;
  description: string | null;
  assignee_id: string | null;
  status: TaskStatus;
  priority: Priority;
  visibility: Visibility;
  planned_start: string | null;
  due_date: string | null;
  completed_at: string | null;
  sort: number;
};

export type GanttStep = {
  id: string;
  brand_id: string;
  step_code: StepCode;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: StepStatus;
};
export type GanttGate = { id: string; brand_id: string; gate_code: GateCode; planned_date: string | null; status: GateStatus };

export async function getBrands(supabase: SupabaseClient, projectId: string) {
  const { data } = await supabase.from("brands").select("id, name, color, sort").eq("project_id", projectId).order("sort");
  return (data ?? []) as Brand[];
}

export async function getProjectPeople(supabase: SupabaseClient, projectId: string) {
  const { data } = await supabase
    .from("project_members")
    .select("profiles(id, full_name, email, role, specialty)")
    .eq("project_id", projectId);
  return ((data ?? []).map((r) => r.profiles).filter(Boolean) as unknown as Person[]).sort((a, b) =>
    (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email),
  );
}

export async function getGantt(supabase: SupabaseClient, brandIds: string[]) {
  if (!brandIds.length) return { steps: [] as GanttStep[], gates: [] as GanttGate[] };
  const [steps, gates] = await Promise.all([
    supabase
      .from("brand_steps")
      .select("id, brand_id, step_code, planned_start, planned_end, actual_start, actual_end, status")
      .in("brand_id", brandIds),
    supabase.from("brand_gates").select("id, brand_id, gate_code, planned_date, status").in("brand_id", brandIds),
  ]);
  return { steps: (steps.data ?? []) as GanttStep[], gates: (gates.data ?? []) as GanttGate[] };
}

export type TaskFilters = { marca?: string; letra?: string; responsable?: string; vencidas?: string };

export async function getTasks(
  supabase: SupabaseClient,
  projectId: string,
  f: TaskFilters,
  opts: { clientView: boolean; today: string },
) {
  let q = supabase
    .from("tasks")
    .select("id, project_id, brand_id, step_code, title, description, assignee_id, status, priority, visibility, planned_start, due_date, completed_at, sort")
    .eq("project_id", projectId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("sort");
  if (opts.clientView) q = q.eq("visibility", "cliente");
  if (f.marca) q = q.eq("brand_id", f.marca);
  if (f.letra) q = q.eq("step_code", f.letra);
  if (f.responsable) q = q.eq("assignee_id", f.responsable);
  if (f.vencidas === "1") q = q.lt("due_date", opts.today).neq("status", "hecho");
  const { data } = await q;
  return (data ?? []) as Task[];
}

/** URLs firmadas (1 h) para archivos que el usuario puede leer según RLS. */
export async function signedFiles<T extends { id: string; path: string; name: string; bucket: string; created_at: string; visibility: Visibility }>(
  supabase: SupabaseClient,
  rows: T[],
): Promise<(T & { url: string | null })[]> {
  return Promise.all(
    rows.map(async (f) => {
      const { data } = await supabase.storage.from(f.bucket).createSignedUrl(f.path, 3600, { download: f.name });
      return { ...f, url: data?.signedUrl ?? null };
    }),
  );
}

export async function getFiles(supabase: SupabaseClient, entityType: string, entityIds: string[], clientView: boolean) {
  if (!entityIds.length) return [];
  let q = supabase
    .from("files")
    .select("id, path, name, bucket, created_at, visibility, entity_id")
    .eq("entity_type", entityType)
    .in("entity_id", entityIds)
    .order("created_at", { ascending: false });
  if (clientView) q = q.eq("visibility", "cliente");
  const { data } = await q;
  return (data ?? []) as {
    id: string;
    path: string;
    name: string;
    bucket: string;
    created_at: string;
    visibility: Visibility;
    entity_id: string;
  }[];
}

export async function getComments(supabase: SupabaseClient, entityType: string, entityId: string, clientView: boolean) {
  let q = supabase
    .from("comments")
    .select("id, body, visibility, created_at, author:profiles(full_name, email, role)")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at");
  if (clientView) q = q.eq("visibility", "cliente");
  const { data } = await q;
  return (data ?? []) as unknown as {
    id: string;
    body: string;
    visibility: Visibility;
    created_at: string;
    author: { full_name: string | null; email: string; role: string } | null;
  }[];
}
