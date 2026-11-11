import type { Metadata } from "next";
import { CompetitorsSection } from "@/components/analysis/competitors-section";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Competidores" };

export default async function Page(props: PageProps<"/consultor/p/[projectId]/competidores">) {
  const { projectId } = await props.params;
  const { supabase } = await requireStaff();
  return <CompetitorsSection supabase={supabase} projectId={projectId} path={`/consultor/p/${projectId}/competidores`} editable clientView={false} />;
}
