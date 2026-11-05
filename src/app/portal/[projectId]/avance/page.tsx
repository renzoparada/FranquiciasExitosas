import type { Metadata } from "next";
import { GanttSection } from "@/components/project/gantt-page";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Avance" };

export default async function PortalGantt(props: PageProps<"/portal/[projectId]/avance">) {
  const { projectId } = await props.params;
  const { supabase } = await requireProfile();
  return (
    <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-black sm:text-3xl">Avance del proyecto</h1>
        <p className="text-sm text-muted">Planificado vs. real, por marca. Los rombos son las puertas de decisión.</p>
      </div>
      <GanttSection supabase={supabase} projectId={projectId} editable={false} path={`/portal/${projectId}/avance`} />
    </main>
  );
}
