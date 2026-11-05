import type { Metadata } from "next";
import { GatesSection } from "@/components/project/gates-section";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Puertas" };

export default async function Page(props: PageProps<"/portal/[projectId]/puertas">) {
  const { projectId } = await props.params;
  const { supabase } = await requireProfile();
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6"><div><h1 className="font-display text-2xl font-black sm:text-3xl">Puertas de decisión</h1><p className="text-sm text-muted">Ningún paso avanza sin su acta aprobada.</p></div>
      <GatesSection supabase={supabase} projectId={projectId} base={`/portal/${projectId}/puertas`} clientView={true} />
    </main>
  );
}
