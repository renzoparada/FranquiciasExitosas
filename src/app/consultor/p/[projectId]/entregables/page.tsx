import type { Metadata } from "next";
import { DeliverablesSection } from "@/components/project/deliverables-section";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Entregables" };

export default async function Page(props: PageProps<"/consultor/p/[projectId]/entregables">) {
  const { projectId } = await props.params;
  const searchParams = await props.searchParams;
  const { supabase, profile } = await requireStaff();
  return (
    <>
      <DeliverablesSection supabase={supabase} profile={profile} projectId={projectId} base={`/consultor/p/${projectId}/entregables`} clientView={false} searchParams={searchParams} />
    </>
  );
}
