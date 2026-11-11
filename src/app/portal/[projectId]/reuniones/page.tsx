import type { Metadata } from "next";
import { LogSection } from "@/components/analysis/log-section";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Reuniones y decisiones" };

export default async function Page(props: PageProps<"/portal/[projectId]/reuniones">) {
  const { projectId } = await props.params;
  const { supabase } = await requireProfile();
  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <h1 className="font-display text-2xl font-black sm:text-3xl">Reuniones y decisiones</h1>
      <LogSection supabase={supabase} projectId={projectId} path={`/portal/${projectId}/reuniones`} tasksBase={`/portal/${projectId}/tareas`} isAdmin={false} clientView />
    </main>
  );
}
