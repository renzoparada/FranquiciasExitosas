import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/escala";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  specialty: string | null;
  avatar_url: string | null;
};

/** Usuario y perfil de la sesión actual (memorizado por solicitud). */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, specialty, avatar_url")
    .eq("id", user.id)
    .single<Profile>();
  return { supabase, user, profile };
});

export async function requireProfile() {
  const s = await getSession();
  if (!s.user || !s.profile) redirect("/login");
  return { supabase: s.supabase, user: s.user, profile: s.profile };
}

export async function requireStaff() {
  const s = await requireProfile();
  if (s.profile.role === "cliente") redirect("/portal");
  return s;
}

export async function requireAdmin() {
  const s = await requireProfile();
  if (s.profile.role !== "admin") redirect(s.profile.role === "cliente" ? "/portal" : "/consultor");
  return s;
}

export function homeFor(role: AppRole) {
  return role === "cliente" ? "/portal" : "/consultor";
}
