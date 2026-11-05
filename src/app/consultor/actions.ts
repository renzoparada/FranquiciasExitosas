"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/components/ui/action-form";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Traduce los errores de Postgres (reglas ESCALA, permisos) a un mensaje legible. */
function fail(error: { message: string; code?: string } | null | undefined, fallback = "No se pudo guardar."): ActionResult {
  if (!error) return { ok: false, message: fallback };
  if (error.message.startsWith("REGLA")) return { ok: false, message: error.message };
  if (error.code === "42501") return { ok: false, message: "No tienes permiso para esta acción." };
  return { ok: false, message: error.message || fallback };
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------
const clientSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del cliente."),
  legal_name: z.string().trim().optional(),
  nit: z.string().trim().optional(),
  city: z.string().trim().optional(),
});

async function uploadLogo(file: File | null, folder: string) {
  if (!file || file.size === 0) return null;
  if (!file.type.startsWith("image/")) throw new Error("El logo debe ser una imagen.");
  if (file.size > 2 * 1024 * 1024) throw new Error("El logo debe pesar menos de 2 MB.");
  const { supabase } = await requireAdmin();
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${folder}/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("branding").upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(error.message);
  return supabase.storage.from("branding").getPublicUrl(path).data.publicUrl;
}

export async function createClientAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await requireAdmin();
  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    legal_name: formData.get("legal_name") || undefined,
    nit: formData.get("nit") || undefined,
    city: formData.get("city") || undefined,
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { data, error } = await supabase
    .from("clients")
    .insert({ ...parsed.data, created_by: profile.id })
    .select("id")
    .single();
  if (error) return fail(error);
  try {
    const logo = await uploadLogo(formData.get("logo") as File | null, `clients/${data.id}`);
    if (logo) await supabase.from("clients").update({ logo_url: logo }).eq("id", data.id);
  } catch (e) {
    return { ok: false, message: `Cliente creado, pero el logo no se subió: ${(e as Error).message}` };
  }
  revalidatePath("/consultor/clientes");
  return { ok: true, message: "Cliente creado." };
}

export async function updateClientLogo(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const clientId = String(formData.get("client_id"));
  try {
    const logo = await uploadLogo(formData.get("logo") as File | null, `clients/${clientId}`);
    if (!logo) return { ok: false, message: "Elige una imagen." };
    const { error } = await supabase.from("clients").update({ logo_url: logo }).eq("id", clientId);
    if (error) return fail(error);
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  revalidatePath("/consultor", "layout");
  return { ok: true, message: "Logo actualizado." };
}

/** Invita (o vincula si ya existe) a un usuario y devuelve su id. */
async function inviteOrFind(email: string, fullName?: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: fullName ? { full_name: fullName } : undefined,
    redirectTo: `${siteUrl()}/auth/confirm`,
  });
  if (data?.user) return data.user.id;
  // Si ya estaba registrado, se busca su perfil.
  const { data: existing } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (existing) return existing.id as string;
  throw new Error(error?.message ?? "No se pudo invitar al usuario.");
}

const inviteSchema = z.object({
  email: z.email("Correo no válido.").transform((e) => e.toLowerCase()),
  full_name: z.string().trim().min(2, "Escribe el nombre completo."),
});

export async function inviteClientUser(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const clientId = String(formData.get("client_id"));
  const parsed = inviteSchema.safeParse({ email: formData.get("email"), full_name: formData.get("full_name") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  try {
    const admin = createAdminClient();
    const userId = await inviteOrFind(parsed.data.email, parsed.data.full_name);
    const { data: prof } = await admin.from("profiles").select("role").eq("id", userId).single();
    if (prof && prof.role !== "cliente") {
      return { ok: false, message: "Ese correo pertenece al equipo del consultor; usa otro correo para el cliente." };
    }
    await admin.from("profiles").update({ full_name: parsed.data.full_name }).eq("id", userId);
    await admin.from("client_members").upsert({ client_id: clientId, profile_id: userId });
    // Acceso a todos los proyectos del cliente.
    const { data: projects } = await admin.from("projects").select("id").eq("client_id", clientId);
    if (projects?.length) {
      await admin
        .from("project_members")
        .upsert(projects.map((p) => ({ project_id: p.id, profile_id: userId })), { ignoreDuplicates: true });
    }
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  revalidatePath("/consultor/clientes");
  return { ok: true, message: `Invitación enviada a ${parsed.data.email}.` };
}

// ---------------------------------------------------------------------------
// Equipo (consultores y especialistas)
// ---------------------------------------------------------------------------
const staffSchema = inviteSchema.extend({
  role: z.enum(["admin", "especialista"]),
  specialty: z.string().optional(),
});

export async function inviteStaff(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = staffSchema.safeParse({
    email: formData.get("email"),
    full_name: formData.get("full_name"),
    role: formData.get("role"),
    specialty: formData.get("specialty") || undefined,
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  try {
    const admin = createAdminClient();
    const userId = await inviteOrFind(parsed.data.email, parsed.data.full_name);
    const { error } = await admin
      .from("profiles")
      .update({
        role: parsed.data.role,
        full_name: parsed.data.full_name,
        specialty: parsed.data.role === "especialista" && parsed.data.specialty ? parsed.data.specialty : null,
      })
      .eq("id", userId);
    if (error) throw error;
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  revalidatePath("/consultor/equipo");
  return { ok: true, message: `Invitación enviada a ${parsed.data.email}.` };
}

export async function addProjectMember(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const projectId = String(formData.get("project_id"));
  const profileId = String(formData.get("profile_id") || "");
  if (!profileId) return { ok: false, message: "Elige a una persona." };
  const { error } = await supabase.from("project_members").insert({ project_id: projectId, profile_id: profileId });
  if (error && error.code !== "23505") return fail(error);
  revalidatePath(`/consultor/p/${projectId}`);
  return { ok: true, message: "Miembro agregado al proyecto." };
}

export async function removeProjectMember(formData: FormData) {
  const { supabase } = await requireAdmin();
  const projectId = String(formData.get("project_id"));
  await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("profile_id", String(formData.get("profile_id")));
  revalidatePath(`/consultor/p/${projectId}`);
}

// ---------------------------------------------------------------------------
// Proyectos (desde la plantilla ESCALA)
// ---------------------------------------------------------------------------
const projectSchema = z.object({
  client_id: z.uuid("Elige un cliente."),
  name: z.string().trim().min(3, "Escribe el nombre del proyecto."),
  start_date: z.iso.date("Elige la fecha de inicio."),
  currency: z.enum(["BOB", "USD"]),
  brands: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Cada marca necesita un nombre."),
        week_offset: z.coerce.number().int().min(0).max(104),
        entry_format: z.string().optional(),
      }),
    )
    .min(1, "Agrega al menos una marca."),
  fee: z
    .object({
      base_amount: z.coerce.number().positive("El honorario debe ser mayor a cero."),
      tax_pct: z.coerce.number().min(0).max(100),
      success_fee_pct: z.coerce.number().min(0).max(100),
    })
    .nullable(),
});

export async function createProject(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload")));
  } catch {
    return { ok: false, message: "Datos del formulario inválidos." };
  }
  const parsed = projectSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const p = parsed.data;
  const palette = ["#E30613", "#1D1D1F", "#6E6E73", "#B00010"];

  const { data: projectId, error } = await supabase.rpc("create_project_from_template", {
    p_client: p.client_id,
    p_name: p.name,
    p_start: p.start_date,
    p_currency: p.currency,
    p_brands: p.brands.map((b, i) => ({ ...b, entry_format: b.entry_format || null, color: palette[i % palette.length] })),
    p_fee: p.fee ? { ...p.fee, currency: p.currency } : null,
  });
  if (error) return fail(error);
  revalidatePath("/consultor");
  redirect(`/consultor/p/${projectId}`);
}

// ---------------------------------------------------------------------------
// Marcas y pasos
// ---------------------------------------------------------------------------
export async function updateBrand(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const brandId = String(formData.get("brand_id"));
  const projectId = String(formData.get("project_id"));
  const opening = String(formData.get("first_opening_date") || "");
  const { error } = await supabase
    .from("brands")
    .update({
      entry_format: String(formData.get("entry_format") || "") || null,
      trademark_status: String(formData.get("trademark_status")),
      first_opening_date: opening || null,
      week_offset: Number(formData.get("week_offset") ?? 0),
    })
    .eq("id", brandId);
  if (error) return fail(error);
  revalidatePath(`/consultor/p/${projectId}`);
  return { ok: true, message: "Marca actualizada." };
}

export async function updateStep(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const stepId = String(formData.get("step_id"));
  const projectId = String(formData.get("project_id"));
  const ps = String(formData.get("planned_start") || "");
  const pe = String(formData.get("planned_end") || "");
  const { error } = await supabase
    .from("brand_steps")
    .update({ status: String(formData.get("status")), planned_start: ps || null, planned_end: pe || null })
    .eq("id", stepId);
  if (error) return fail(error);
  revalidatePath(`/consultor/p/${projectId}`);
  return { ok: true, message: "Paso actualizado." };
}

export async function setTaskStatus(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireStaff();
  const { error } = await supabase
    .from("tasks")
    .update({ status: String(formData.get("status")) })
    .eq("id", String(formData.get("task_id")));
  if (error) return fail(error);
  revalidatePath(`/consultor/p/${String(formData.get("project_id"))}`);
  return { ok: true };
}
