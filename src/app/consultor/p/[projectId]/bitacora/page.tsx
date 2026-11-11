import type { Metadata } from "next";
import { LogSection } from "@/components/analysis/log-section";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Bitácora" };

export default async function Page(props: PageProps<"/consultor/p/[projectId]/bitacora">) {
  const { projectId } = await props.params;
  const { supabase, profile } = await requireStaff();
  return (
    <LogSection supabase={supabase} projectId={projectId} path={`/consultor/p/${projectId}/bitacora`} tasksBase={`/consultor/p/${projectId}/tareas`} isAdmin={profile.role === "admin"} clientView={false} />
  );
}
