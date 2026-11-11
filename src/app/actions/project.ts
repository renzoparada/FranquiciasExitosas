"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireProfile, requireStaff } from "@/lib/auth";
import type { ActionResult } from "@/components/ui/action-form";

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function fail(error: { message: string; code?: string } | null | undefined, fallback = "No se pudo guardar."): ActionResult {
  if (!error) return { ok: false, message: fallback };
  if (error.message.startsWith("REGLA")) return { ok: false, message: error.message };
  if (error.code === "42501") return { ok: false, message: "No tienes permiso para esta acción." };
  return { ok: false, message: error.message || fallback };
}

/** Revalida la ruta enviada por el formulario (solo rutas internas). */
function refresh(fd: FormData) {
  const path = String(fd.get("path") ?? "").split("?")[0];
  if (path.startsWith("/portal/") || path.startsWith("/consultor/")) revalidatePath(path);
}

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return v === null ? "" : String(v).trim();
};
const orNull = (v: string) => (v === "" ? null : v);

// ---------------------------------------------------------------------------
// Comentarios
// ---------------------------------------------------------------------------
export async function addComment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase, profile } = await requireProfile();
  const body = str(fd, "body");
  if (!body) return { ok: false, message: "Escribe un comentario." };
  const visibility = profile.role === "cliente" ? "cliente" : str(fd, "visibility") === "interno" ? "interno" : "cliente";
  const { error } = await supabase.from("comments").insert({
    project_id: str(fd, "project_id"),
    entity_type: str(fd, "entity_type"),
    entity_id: str(fd, "entity_id"),
    body,
    visibility,
    author_id: profile.id,
  });
  if (error) return fail(error);
  refresh(fd);
  return { ok: true, message: "Comentario publicado." };
}

// ---------------------------------------------------------------------------
// Tareas
// ---------------------------------------------------------------------------
const taskSchema = z.object({
  title: z.string().trim().min(2, "Escribe el título de la tarea."),
  description: z.string().trim().optional(),
  brand_id: z.string().optional(),
  step_code: z.enum(["E", "S", "C", "A1", "L", "A2", ""]).optional(),
  assignee_id: z.string().optional(),
  due_date: z.string().optional(),
  priority: z.enum(["baja", "media", "alta", "urgente"]),
  visibility: z.enum(["interno", "cliente"]),
  status: z.enum(["por_hacer", "en_curso", "en_revision", "hecho"]),
});

export async function saveTask(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = taskSchema.safeParse({
    title: fd.get("title"),
    description: fd.get("description") ?? undefined,
    brand_id: fd.get("brand_id") ?? undefined,
    step_code: fd.get("step_code") ?? undefined,
    assignee_id: fd.get("assignee_id") ?? undefined,
    due_date: fd.get("due_date") ?? undefined,
    priority: fd.get("priority") ?? "media",
    visibility: fd.get("visibility") ?? "cliente",
    status: fd.get("status") ?? "por_hacer",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const t = parsed.data;
  const row = {
    title: t.title,
    description: orNull(t.description ?? ""),
    brand_id: orNull(t.brand_id ?? ""),
    step_code: orNull(t.step_code ?? ""),
    assignee_id: orNull(t.assignee_id ?? ""),
    due_date: orNull(t.due_date ?? ""),
    priority: t.priority,
    visibility: t.visibility,
    status: t.status,
  };
  const id = str(fd, "task_id");
  const { error } = id
    ? await supabase.from("tasks").update(row).eq("id", id)
    : await supabase.from("tasks").insert({ ...row, project_id: str(fd, "project_id") });
  if (error) return fail(error);
  refresh(fd);
  return { ok: true, message: id ? "Tarea actualizada." : "Tarea creada." };
}

export async function deleteTask(fd: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("tasks").delete().eq("id", str(fd, "task_id"));
  refresh(fd);
}

/** Cambio de estado (Kanban). Admin o especialista asignado (RLS). */
export async function moveTask(taskId: string, status: string, path: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.from("tasks").update({ status }).eq("id", taskId).select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, message: "No puedes mover esta tarea." };
  if (path.startsWith("/consultor/")) revalidatePath(path);
  return { ok: true };
}

export async function addChecklistItem(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const text = str(fd, "text");
  if (!text) return { ok: false, message: "Escribe el ítem." };
  const { error } = await supabase.from("task_checklist_items").insert({ task_id: str(fd, "task_id"), text, sort: Date.now() % 1e9 });
  if (error) return fail(error);
  refresh(fd);
  return { ok: true };
}

export async function toggleChecklistItem(fd: FormData) {
  const { supabase } = await requireStaff();
  await supabase.from("task_checklist_items").update({ done: str(fd, "done") === "1" }).eq("id", str(fd, "item_id"));
  refresh(fd);
}

export async function deleteChecklistItem(fd: FormData) {
  const { supabase } = await requireStaff();
  await supabase.from("task_checklist_items").delete().eq("id", str(fd, "item_id"));
  refresh(fd);
}

// ---------------------------------------------------------------------------
// Gantt
// ---------------------------------------------------------------------------
export async function updateStepDates(stepId: string, start: string, end: string, path: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) {
    return { ok: false, message: "Fechas no válidas." };
  }
  const { error } = await supabase.from("brand_steps").update({ planned_start: start, planned_end: end }).eq("id", stepId);
  if (error) return fail(error);
  // La puerta que cierra el paso se mueve con él.
  const { data: step } = await supabase.from("brand_steps").select("brand_id, step_code").eq("id", stepId).single();
  if (step) {
    const { data: tpl } = await supabase.from("tpl_steps").select("closing_gate").eq("code", step.step_code).single();
    if (tpl?.closing_gate) {
      await supabase.from("brand_gates").update({ planned_date: end }).eq("brand_id", step.brand_id).eq("gate_code", tpl.closing_gate);
    }
  }
  if (path.startsWith("/consultor/")) revalidatePath(path);
  return { ok: true, message: "Fechas actualizadas." };
}

// ---------------------------------------------------------------------------
// Entregables
// ---------------------------------------------------------------------------
export async function createDeliverable(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const title = str(fd, "title");
  if (!title) return { ok: false, message: "Escribe el nombre del entregable." };
  const { error } = await supabase.from("deliverables").insert({
    brand_id: str(fd, "brand_id"),
    step_code: str(fd, "step_code"),
    title,
    release_trigger: str(fd, "release_trigger") || "firma",
    visibility: str(fd, "visibility") === "interno" ? "interno" : "cliente",
  });
  if (error) return fail(error);
  refresh(fd);
  return { ok: true, message: "Entregable creado." };
}

/** Publica la última versión cargada y la envía al cliente para revisión. */
export async function sendDeliverable(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const id = str(fd, "deliverable_id");
  const { data: last } = await supabase
    .from("deliverable_versions")
    .select("id, version, file_id")
    .eq("deliverable_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last) return { ok: false, message: "Primero sube una versión del entregable." };
  if (!last.file_id) return { ok: false, message: "La última versión no tiene archivo." };
  const { error: e1 } = await supabase
    .from("deliverable_versions")
    .update({ submitted_at: new Date().toISOString(), review_status: "enviado" })
    .eq("id", last.id);
  if (e1) return fail(e1);
  const { error } = await supabase.from("deliverables").update({ status: "enviado", current_version: last.version }).eq("id", id);
  if (error) return fail(error);
  refresh(fd);
  return { ok: true, message: "Enviado al cliente para revisión." };
}

export async function reviewDeliverable(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireProfile();
  const decision = str(fd, "decision");
  const comment = str(fd, "comment");
  if (decision === "observado" && !comment) return { ok: false, message: "Cuéntanos qué hay que ajustar." };
  const { error } = await supabase.rpc("review_deliverable", {
    p_deliverable: str(fd, "deliverable_id"),
    p_decision: decision,
    p_comment: comment || null,
  });
  if (error) return fail(error);
  refresh(fd);
  return { ok: true, message: decision === "aprobado" ? "¡Entregable aprobado!" : "Observación enviada al consultor." };
}

// ---------------------------------------------------------------------------
// Actas de puerta
// ---------------------------------------------------------------------------
export async function saveMinutes(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const gateId = str(fd, "brand_gate_id");
  const content = {
    antecedentes: str(fd, "antecedentes"),
    resultados: str(fd, "resultados"),
    decision: str(fd, "decision"),
    decision_texto: str(fd, "decision_texto"),
    proximos_pasos: str(fd, "proximos_pasos"),
  };
  const title = str(fd, "title") || "Acta de puerta";
  const minutesId = str(fd, "minutes_id");
  const { error } = minutesId
    ? await supabase.from("gate_minutes").update({ title, content }).eq("id", minutesId).in("status", ["borrador", "observado"])
    : await supabase.from("gate_minutes").insert({ brand_gate_id: gateId, title, content });
  if (error) return fail(error);
  if (content.decision) {
    await supabase.from("brand_gates").update({ decision: content.decision }).eq("id", gateId);
  }
  refresh(fd);
  return { ok: true, message: "Acta guardada como borrador." };
}

export async function sendMinutes(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const id = str(fd, "minutes_id");
  const { data, error } = await supabase
    .from("gate_minutes")
    .update({ status: "enviado", sent_at: new Date().toISOString(), observation: null })
    .eq("id", id)
    .in("status", ["borrador", "observado"])
    .select("brand_gate_id, title")
    .single();
  if (error) return fail(error);
  await supabase.from("brand_gates").update({ status: "acta_enviada" }).eq("id", data.brand_gate_id);
  refresh(fd);
  return { ok: true, message: "Acta enviada al cliente para su aprobación." };
}

export async function approveMinutes(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireProfile();
  if (str(fd, "acepto") !== "1") return { ok: false, message: "Marca la casilla de conformidad." };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const { error } = await supabase.rpc("approve_gate_minutes", {
    p_minutes: str(fd, "minutes_id"),
    p_full_name: str(fd, "full_name"),
    p_ip: ip,
  });
  if (error) return fail(error);
  refresh(fd);
  revalidatePath(`/portal/${str(fd, "project_id")}`);
  return { ok: true, message: "approved" };
}

export async function observeMinutes(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireProfile();
  const observation = str(fd, "observation");
  if (!observation) return { ok: false, message: "Escribe qué hay que ajustar en el acta." };
  const { error } = await supabase.rpc("observe_gate_minutes", { p_minutes: str(fd, "minutes_id"), p_observation: observation });
  if (error) return fail(error);
  refresh(fd);
  return { ok: true, message: "Observación enviada al consultor." };
}

// ---------------------------------------------------------------------------
// Solicitudes de información
// ---------------------------------------------------------------------------
export async function submitInfoRequest(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireProfile();
  const id = str(fd, "request_id");
  const { count } = await supabase
    .from("files")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", "info_request")
    .eq("entity_id", id);
  if (!count) return { ok: false, message: "Adjunta al menos un archivo antes de enviar." };
  const { error } = await supabase.rpc("submit_info_request", { p_request: id });
  if (error) return fail(error);
  refresh(fd);
  return { ok: true, message: "¡Gracias! Avisamos al consultor." };
}

export async function reviewInfoRequest(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const decision = str(fd, "decision");
  const observation = str(fd, "observation");
  if (decision === "observado" && !observation) return { ok: false, message: "Explica qué falta o qué corregir." };
  const { error } = await supabase
    .from("info_requests")
    .update({ status: decision, observation: decision === "observado" ? observation : null })
    .eq("id", str(fd, "request_id"));
  if (error) return fail(error);
  refresh(fd);
  return { ok: true, message: decision === "validado" ? "Información validada." : "Observación enviada al cliente." };
}

export async function saveInfoRequest(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const id = str(fd, "request_id");
  const due = orNull(str(fd, "due_date"));
  if (id) {
    const { error } = await supabase.from("info_requests").update({ due_date: due }).eq("id", id);
    if (error) return fail(error);
  } else {
    const title = str(fd, "title");
    if (!title) return { ok: false, message: "Escribe qué información necesitas." };
    const { error } = await supabase.from("info_requests").insert({
      brand_id: str(fd, "brand_id"),
      category: str(fd, "category") || "Otros",
      title,
      description: orNull(str(fd, "description")),
      due_date: due,
      sort: 100,
    });
    if (error) return fail(error);
  }
  refresh(fd);
  return { ok: true, message: id ? "Fecha actualizada." : "Solicitud agregada." };
}
