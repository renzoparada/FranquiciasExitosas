"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireProfile, requireStaff } from "@/lib/auth";
import type { ActionResult } from "@/components/ui/action-form";
import { FIN_METRICS, type FinMetric } from "@/lib/finance";
import { todayLaPaz } from "@/lib/format";
import { buildReportSnapshot } from "@/lib/report";

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function fail(error: { message: string; code?: string } | null | undefined, fallback = "No se pudo guardar."): ActionResult {
  if (!error) return { ok: false, message: fallback };
  if (error.message.startsWith("REGLA")) return { ok: false, message: error.message };
  if (error.code === "42501") return { ok: false, message: "No tienes permiso para esta acción." };
  if (error.code === "23514") return { ok: false, message: "REGLA 1 · Cada cifra lleva su etiqueta: elige si es dato comprobado, estimación o supuesto." };
  return { ok: false, message: error.message || fallback };
}
function refresh(fd: FormData) {
  const path = String(fd.get("path") ?? "");
  if (path.startsWith("/portal/") || path.startsWith("/consultor/")) revalidatePath(path);
}
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return v === null ? "" : String(v).trim();
};
const orNull = (v: string) => (v === "" ? null : v);
/** Número en formato local (1.234,56 o 1234.56) → number | null. */
function num(v: string): number | null {
  if (!v) return null;
  const clean = v.replace(/\s/g, "").replace(/^Bs\.?|^USD/i, "");
  const normalized = /,\d{1,2}$/.test(clean) ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
const LABELS = ["comprobado", "estimacion", "supuesto"];
const label = (v: string) => (LABELS.includes(v) ? v : null);
const RULE1 = "REGLA 1 · Cada cifra lleva su etiqueta: elige si es dato comprobado, estimación o supuesto.";

// ---------------------------------------------------------------------------
// Matriz de franquiciabilidad
// ---------------------------------------------------------------------------
export async function saveScore(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const score = str(fd, "score") ? Number(str(fd, "score")) : null;
  const dl = label(str(fd, "data_label"));
  if (score !== null && !dl) return { ok: false, message: RULE1 };
  const { error } = await supabase.from("franchisability_scores").upsert(
    {
      brand_id: str(fd, "brand_id"),
      criterion_code: str(fd, "criterion_code"),
      score,
      data_label: score === null ? null : dl,
      evidence: orNull(str(fd, "evidence")),
    },
    { onConflict: "brand_id,criterion_code" },
  );
  if (error) return fail(error);
  refresh(fd);
  return { ok: true, message: "Puntaje guardado." };
}

// ---------------------------------------------------------------------------
// Competidores
// ---------------------------------------------------------------------------
export async function saveCompetitor(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const name = str(fd, "name");
  if (!name) return { ok: false, message: "Escribe el nombre del competidor." };
  const row = {
    name,
    format: orNull(str(fd, "format")),
    format_notes: orNull(str(fd, "format_notes")),
    source: orNull(str(fd, "source")),
    observed_on: orNull(str(fd, "observed_on")),
    confidence: label(str(fd, "confidence")),
    notes: orNull(str(fd, "notes")),
    digital_presence: {
      instagram: str(fd, "instagram") || null,
      facebook: str(fd, "facebook") || null,
      tiktok: str(fd, "tiktok") || null,
      web: str(fd, "web") || null,
      seguidores: str(fd, "seguidores") || null,
    },
  };
  const id = str(fd, "competitor_id");
  const { error } = id
    ? await supabase.from("competitors").update(row).eq("id", id)
    : await supabase.from("competitors").insert({ ...row, project_id: str(fd, "project_id") });
  if (error) return fail(error);
  refresh(fd);
  return { ok: true, message: id ? "Ficha actualizada." : "Competidor agregado." };
}

export async function deleteCompetitor(fd: FormData) {
  const { supabase } = await requireStaff();
  await supabase.from("competitors").delete().eq("id", str(fd, "competitor_id"));
  refresh(fd);
}

export async function addLocation(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const lat = num(str(fd, "lat"));
  const lng = num(str(fd, "lng"));
  if ((lat === null) !== (lng === null)) return { ok: false, message: "Completa latitud y longitud, o deja ambas vacías." };
  if (lat !== null && (Math.abs(lat) > 90 || Math.abs(lng!) > 180)) return { ok: false, message: "Coordenadas fuera de rango." };
  if (!str(fd, "address") && lat === null) return { ok: false, message: "Escribe una dirección o coordenadas." };
  const { error } = await supabase.from("competitor_locations").insert({
    competitor_id: str(fd, "competitor_id"),
    address: orNull(str(fd, "address")),
    city: orNull(str(fd, "city")),
    lat,
    lng,
  });
  if (error) return fail(error);
  refresh(fd);
  return { ok: true, message: "Ubicación agregada." };
}

export async function deleteLocation(fd: FormData) {
  const { supabase } = await requireStaff();
  await supabase.from("competitor_locations").delete().eq("id", str(fd, "location_id"));
  refresh(fd);
}

export async function addPrice(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const size = str(fd, "size_name");
  if (!size) return { ok: false, message: "Escribe el tamaño o presentación." };
  const price = num(str(fd, "price"));
  const grams = num(str(fd, "grams"));
  const secs = num(str(fd, "service_time_sec"));
  const dl = label(str(fd, "data_label"));
  if ((price !== null || grams !== null || secs !== null) && !dl) return { ok: false, message: RULE1 };
  const { error } = await supabase.from("competitor_prices").insert({
    competitor_id: str(fd, "competitor_id"),
    size_name: size,
    price,
    grams,
    service_time_sec: secs === null ? null : Math.round(secs),
    currency: str(fd, "currency") === "USD" ? "USD" : "BOB",
    data_label: dl,
  });
  if (error) return fail(error);
  refresh(fd);
  return { ok: true, message: "Precio agregado." };
}

export async function deletePrice(fd: FormData) {
  const { supabase } = await requireStaff();
  await supabase.from("competitor_prices").delete().eq("id", str(fd, "price_id"));
  refresh(fd);
}

// ---------------------------------------------------------------------------
// Modelo financiero
// ---------------------------------------------------------------------------
async function upsertScenario(
  supabase: Awaited<ReturnType<typeof requireStaff>>["supabase"],
  brandId: string,
  scenario: string,
  values: Partial<Record<FinMetric, { value: number | null; label: string | null }>>,
  currency: "BOB" | "USD",
  extra?: { format?: string | null; notes?: string | null },
) {
  const { data: sc, error } = await supabase
    .from("financial_scenarios")
    .upsert({ brand_id: brandId, scenario, ...(extra ?? {}) }, { onConflict: "brand_id,scenario" })
    .select("id")
    .single();
  if (error) return error;
  const rows = Object.entries(values).map(([metric, v]) => ({
    scenario_id: sc.id,
    metric,
    value: v!.value,
    data_label: v!.value === null ? null : v!.label,
    currency: FIN_METRICS.find((m) => m.key === metric)?.unit === "money" ? currency : null,
  }));
  if (!rows.length) return null;
  const { error: e2 } = await supabase.from("financial_values").upsert(rows, { onConflict: "scenario_id,metric" });
  return e2;
}

export async function saveScenario(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const values: Partial<Record<FinMetric, { value: number | null; label: string | null }>> = {};
  for (const m of FIN_METRICS) {
    const value = num(str(fd, `v_${m.key}`));
    const dl = label(str(fd, `l_${m.key}`));
    if (value !== null && !dl) return { ok: false, message: `${RULE1} (${m.label})` };
    values[m.key] = { value, label: dl };
  }
  const error = await upsertScenario(supabase, str(fd, "brand_id"), str(fd, "scenario"), values, str(fd, "currency") === "USD" ? "USD" : "BOB", {
    format: orNull(str(fd, "format")),
    notes: orNull(str(fd, "notes")),
  });
  if (error) return fail(error);
  refresh(fd);
  return { ok: true, message: "Escenario guardado." };
}

export type ImportRow = { metric: FinMetric; scenario: "conservador" | "moderado" | "optimista"; value: number | null; label: string | null };

/** Importación desde Excel/CSV (filas ya interpretadas en el navegador). */
export async function importFinancial(brandId: string, currency: "BOB" | "USD", rows: ImportRow[], path: string): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const missing = rows.filter((r) => r.value !== null && !label(r.label ?? ""));
  if (missing.length) return { ok: false, message: `${RULE1} Faltan ${missing.length} etiquetas en el archivo.` };
  for (const sc of ["conservador", "moderado", "optimista"] as const) {
    const values: Partial<Record<FinMetric, { value: number | null; label: string | null }>> = {};
    rows.filter((r) => r.scenario === sc && FIN_METRICS.some((m) => m.key === r.metric)).forEach((r) => (values[r.metric] = { value: r.value, label: r.label }));
    if (!Object.keys(values).length) continue;
    const error = await upsertScenario(supabase, brandId, sc, values, currency);
    if (error) return fail(error);
  }
  if (path.startsWith("/consultor/")) revalidatePath(path);
  return { ok: true, message: `Importadas ${rows.length} cifras.` };
}

export async function validatePayback(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("validate_payback", { p_brand: str(fd, "brand_id") });
  if (error) return fail(error);
  refresh(fd);
  return { ok: true, message: "Payback del franquiciado validado. Ya puedes definir canon y regalía." };
}

export async function saveTerms(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const brandId = str(fd, "brand_id");
  const entry = num(str(fd, "entry_fee"));
  const royalty = num(str(fd, "royalty_pct"));
  const mkt = num(str(fd, "marketing_fund_pct"));
  const dl = label(str(fd, "data_label"));
  if ((entry !== null || royalty !== null || mkt !== null) && !dl) return { ok: false, message: RULE1 };
  const { data: current } = await supabase.from("franchise_terms").select("payback_validated_at").eq("brand_id", brandId).maybeSingle();
  if (!current?.payback_validated_at && (entry !== null || royalty !== null)) {
    return { ok: false, message: "REGLA 2 · El franquiciado gana primero: valida el payback de la unidad antes de guardar el canon o la regalía." };
  }
  const { error } = await supabase.from("franchise_terms").upsert(
    {
      brand_id: brandId,
      entry_fee: entry,
      royalty_pct: royalty,
      marketing_fund_pct: mkt,
      data_label: entry === null && royalty === null && mkt === null ? null : dl,
      currency: str(fd, "currency") === "USD" ? "USD" : "BOB",
      payback_validated_at: current?.payback_validated_at ?? null,
    },
    { onConflict: "brand_id" },
  );
  if (error) return fail(error);
  refresh(fd);
  return { ok: true, message: "Canon, regalía y fondo de marketing guardados." };
}

// ---------------------------------------------------------------------------
// Bitácora: decisiones y reuniones
// ---------------------------------------------------------------------------
export async function saveDecision(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const title = str(fd, "title");
  if (!title) return { ok: false, message: "Escribe la decisión." };
  const row = {
    title,
    description: orNull(str(fd, "description")),
    decided_on: orNull(str(fd, "decided_on")),
    owner_id: orNull(str(fd, "owner_id")),
    brand_id: orNull(str(fd, "brand_id")),
    status: str(fd, "status") === "tomada" ? "tomada" : "pendiente",
    visibility: str(fd, "visibility") === "interno" ? "interno" : "cliente",
  };
  const id = str(fd, "decision_id");
  const { error } = id
    ? await supabase.from("decisions").update(row).eq("id", id)
    : await supabase.from("decisions").insert({ ...row, project_id: str(fd, "project_id") });
  if (error) return fail(error);
  refresh(fd);
  return { ok: true, message: "Decisión registrada." };
}

export async function deleteDecision(fd: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("decisions").delete().eq("id", str(fd, "decision_id"));
  refresh(fd);
}

export async function saveMeeting(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const title = str(fd, "title");
  const date = str(fd, "date");
  const time = str(fd, "time") || "09:00";
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return { ok: false, message: "Completa el título, la fecha y la hora." };
  }
  const row = {
    title,
    // Bolivia no tiene horario de verano: La Paz = UTC−4 todo el año.
    scheduled_at: new Date(`${date}T${time}:00-04:00`).toISOString(),
    duration_min: Number(str(fd, "duration_min") || 60),
    location_or_link: orNull(str(fd, "location_or_link")),
    minutes: orNull(str(fd, "minutes")),
    brand_id: orNull(str(fd, "brand_id")),
    visibility: str(fd, "visibility") === "interno" ? "interno" : "cliente",
  };
  const id = str(fd, "meeting_id");
  const { error } = id
    ? await supabase.from("meetings").update(row).eq("id", id)
    : await supabase.from("meetings").insert({ ...row, project_id: str(fd, "project_id") });
  if (error) return fail(error);
  refresh(fd);
  return { ok: true, message: id ? "Reunión actualizada." : "Reunión agendada." };
}

export async function deleteMeeting(fd: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("meetings").delete().eq("id", str(fd, "meeting_id"));
  refresh(fd);
}

export async function addAgreement(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const text = str(fd, "text");
  if (!text) return { ok: false, message: "Escribe el acuerdo." };
  const { error } = await supabase.from("meeting_agreements").insert({
    meeting_id: str(fd, "meeting_id"),
    text,
    owner_id: orNull(str(fd, "owner_id")),
    due_date: orNull(str(fd, "due_date")),
  });
  if (error) return fail(error);
  refresh(fd);
  return { ok: true, message: "Acuerdo agregado." };
}

/** Convierte un acuerdo de reunión en tarea con un clic. */
export async function agreementToTask(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { data: a } = await supabase
    .from("meeting_agreements")
    .select("id, text, owner_id, due_date, task_id, meetings!inner(project_id, brand_id, visibility)")
    .eq("id", str(fd, "agreement_id"))
    .single();
  if (!a) return { ok: false, message: "Acuerdo no encontrado." };
  if (a.task_id) return { ok: false, message: "Este acuerdo ya es una tarea." };
  const m = a.meetings as unknown as { project_id: string; brand_id: string | null; visibility: "interno" | "cliente" };
  const { data: owner } = a.owner_id ? await supabase.from("profiles").select("role").eq("id", a.owner_id).single() : { data: null };
  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      project_id: m.project_id,
      brand_id: m.brand_id,
      title: a.text,
      description: "Acuerdo de reunión.",
      // Si el responsable es del cliente, la tarea queda sin asignar al equipo (se ve en el portal).
      assignee_id: owner && owner.role !== "cliente" ? a.owner_id : null,
      due_date: a.due_date,
      visibility: m.visibility,
    })
    .select("id")
    .single();
  if (error) return fail(error);
  await supabase.from("meeting_agreements").update({ task_id: task.id }).eq("id", a.id);
  refresh(fd);
  return { ok: true, message: "Acuerdo convertido en tarea." };
}

// ---------------------------------------------------------------------------
// Honorarios (solo consultor)
// ---------------------------------------------------------------------------
export async function createFeePlan(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const base = num(str(fd, "base_amount"));
  const tax = num(str(fd, "tax_pct")) ?? 16;
  const success = num(str(fd, "success_fee_pct")) ?? 10;
  if (!base || base <= 0) return { ok: false, message: "Escribe el honorario fijo." };
  const { data: plan, error } = await supabase
    .from("fee_plans")
    .insert({ brand_id: str(fd, "brand_id"), base_amount: base, tax_pct: tax, success_fee_pct: success, currency: str(fd, "currency") === "USD" ? "USD" : "BOB" })
    .select("id")
    .single();
  if (error) return fail(error);
  const parts = [
    { label: "Firma del contrato", pct: 40, trigger: "firma" },
    { label: "Puerta RENTABLE", pct: 30, trigger: "RENTABLE" },
    { label: "Puerta REPLICABLE", pct: 30, trigger: "REPLICABLE" },
  ];
  const { error: e2 } = await supabase.from("installments").insert(
    parts.map((p, i) => ({
      fee_plan_id: plan.id,
      label: p.label,
      pct: p.pct,
      trigger: p.trigger,
      net_amount: Math.round(base * p.pct) / 100,
      tax_amount: Math.round(base * p.pct * tax) / 10000,
      sort: i,
    })),
  );
  if (e2) return fail(e2);
  refresh(fd);
  return { ok: true, message: "Plan de honorarios creado." };
}

export async function updateInstallment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const status = str(fd, "status");
  const invoice = orNull(str(fd, "invoice_no"));
  if (status === "facturada" && !invoice) return { ok: false, message: "Escribe el número de factura." };
  const { error } = await supabase
    .from("installments")
    .update({ status, invoice_no: invoice, due_date: orNull(str(fd, "due_date")) })
    .eq("id", str(fd, "installment_id"));
  if (error) return fail(error);
  refresh(fd);
  return { ok: true, message: status === "pagada" ? "Pago registrado: los entregables de esta cuota quedan liberados." : "Cuota actualizada." };
}

export async function addFranchiseSale(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const brandId = str(fd, "brand_id");
  const entry = num(str(fd, "entry_fee_amount"));
  const name = str(fd, "franchisee_name");
  const signed = str(fd, "signed_at");
  if (!name || !signed || entry === null || entry <= 0) return { ok: false, message: "Completa franquiciado, fecha de firma y derecho de entrada." };
  const { data: plan } = await supabase.from("fee_plans").select("success_fee_pct, tax_pct, currency").eq("brand_id", brandId).maybeSingle();
  if (!plan) return { ok: false, message: "Primero crea el plan de honorarios de la marca." };
  const { error } = await supabase.from("franchise_sales").insert({
    brand_id: brandId,
    franchisee_name: name,
    city: orNull(str(fd, "city")),
    signed_at: signed,
    entry_fee_amount: entry,
    success_fee_pct: plan.success_fee_pct,
    tax_pct: plan.tax_pct,
    currency: plan.currency,
  });
  if (error) return fail(error);
  refresh(fd);
  return { ok: true, message: "Franquicia vendida registrada. El fee de éxito se calculó automáticamente." };
}

export async function updateSale(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const status = str(fd, "status");
  const { error } = await supabase
    .from("franchise_sales")
    .update({ status, invoice_no: orNull(str(fd, "invoice_no")), paid_at: status === "pagada" ? new Date().toISOString() : null })
    .eq("id", str(fd, "sale_id"));
  if (error) return fail(error);
  refresh(fd);
  return { ok: true, message: "Fee de éxito actualizado." };
}

// ---------------------------------------------------------------------------
// Informe quincenal
// ---------------------------------------------------------------------------
export async function generateReport(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const projectId = str(fd, "project_id");
  const end = todayLaPaz();
  const start = new Date(new Date(`${end}T12:00:00Z`).getTime() - 14 * 864e5).toISOString().slice(0, 10);
  const snapshot = await buildReportSnapshot(supabase, projectId, start, end, str(fd, "note"));
  const { error } = await supabase.from("reports").insert({
    project_id: projectId,
    period_start: start,
    period_end: end,
    snapshot,
    visibility: str(fd, "visibility") === "interno" ? "interno" : "cliente",
  });
  if (error) return fail(error);
  refresh(fd);
  revalidatePath(`/portal/${projectId}`);
  return { ok: true, message: "Informe quincenal generado." };
}

export async function deleteReport(fd: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("reports").delete().eq("id", str(fd, "report_id"));
  refresh(fd);
}

// ---------------------------------------------------------------------------
// Notificaciones
// ---------------------------------------------------------------------------
export async function markNotificationsRead(ids?: string[]) {
  const { supabase, profile } = await requireProfile();
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", profile.id).is("read_at", null);
  if (ids?.length) q = q.in("id", ids);
  await q;
}
