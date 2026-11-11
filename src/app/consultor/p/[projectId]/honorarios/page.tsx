import type { Metadata } from "next";
import { FeesSection } from "@/components/analysis/fees-section";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Honorarios" };

export default async function Page(props: PageProps<"/consultor/p/[projectId]/honorarios">) {
  const { projectId } = await props.params;
  const { supabase } = await requireAdmin();
  return <FeesSection supabase={supabase} projectId={projectId} path={`/consultor/p/${projectId}/honorarios`} />;
}
