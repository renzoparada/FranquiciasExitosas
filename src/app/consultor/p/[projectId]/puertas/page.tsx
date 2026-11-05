import type { Metadata } from "next";
import { GatesSection } from "@/components/project/gates-section";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Puertas" };

export default async function Page(props: PageProps<"/consultor/p/[projectId]/puertas">) {
  const { projectId } = await props.params;
  const { supabase } = await requireStaff();
  return (
    <>
      <GatesSection supabase={supabase} projectId={projectId} base={`/consultor/p/${projectId}/puertas`} clientView={false} />
    </>
  );
}
