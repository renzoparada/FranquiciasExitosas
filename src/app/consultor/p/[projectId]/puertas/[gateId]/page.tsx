import type { Metadata } from "next";
import { GateDetail } from "@/components/project/gate-detail";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Acta de puerta" };

export default async function Page(props: PageProps<"/consultor/p/[projectId]/puertas/[gateId]">) {
  const { projectId, gateId } = await props.params;
  const { supabase, profile } = await requireStaff();
  return (
    <>
      <GateDetail supabase={supabase} profile={profile} projectId={projectId} gateId={gateId} base={`/consultor/p/${projectId}/puertas`} clientView={false} />
    </>
  );
}
