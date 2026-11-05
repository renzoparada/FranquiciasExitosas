import type { Metadata } from "next";
import { GateDetail } from "@/components/project/gate-detail";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Acta de puerta" };

export default async function Page(props: PageProps<"/portal/[projectId]/puertas/[gateId]">) {
  const { projectId, gateId } = await props.params;
  const { supabase, profile } = await requireProfile();
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <GateDetail supabase={supabase} profile={profile} projectId={projectId} gateId={gateId} base={`/portal/${projectId}/puertas`} clientView={true} />
    </main>
  );
}
