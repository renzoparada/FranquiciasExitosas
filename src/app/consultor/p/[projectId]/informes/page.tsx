import type { Metadata } from "next";
import { ReportsSection } from "@/components/analysis/reports-section";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Informes" };

export default async function Page(props: PageProps<"/consultor/p/[projectId]/informes">) {
  const { projectId } = await props.params;
  const { supabase, profile } = await requireStaff();
  return <ReportsSection supabase={supabase} projectId={projectId} path={`/consultor/p/${projectId}/informes`} isAdmin={profile.role === "admin"} clientView={false} />;
}
