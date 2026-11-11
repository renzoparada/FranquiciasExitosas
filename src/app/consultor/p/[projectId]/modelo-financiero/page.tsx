import type { Metadata } from "next";
import { FinanceSection } from "@/components/analysis/finance-section";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Modelo financiero" };

export default async function Page(props: PageProps<"/consultor/p/[projectId]/modelo-financiero">) {
  const { projectId } = await props.params;
  const searchParams = await props.searchParams;
  const { supabase, profile } = await requireStaff();
  return (
    <FinanceSection supabase={supabase} projectId={projectId} base={`/consultor/p/${projectId}/modelo-financiero`} editable isAdmin={profile.role === "admin"} searchParams={searchParams} />
  );
}
