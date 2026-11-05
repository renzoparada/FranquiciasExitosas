import type { Metadata } from "next";
import { InfoRequestsSection } from "@/components/project/info-requests-section";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Información" };

export default async function Page(props: PageProps<"/consultor/p/[projectId]/informacion">) {
  const { projectId } = await props.params;
  const searchParams = await props.searchParams;
  const { supabase, profile } = await requireStaff();
  return (
    <>
      <InfoRequestsSection supabase={supabase} profile={profile} projectId={projectId} base={`/consultor/p/${projectId}/informacion`} clientView={false} searchParams={searchParams} />
    </>
  );
}
