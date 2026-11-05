import type { Metadata } from "next";
import { TasksSection } from "@/components/project/tasks-section";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Tareas" };

export default async function Page(props: PageProps<"/portal/[projectId]/tareas">) {
  const { projectId } = await props.params;
  const searchParams = await props.searchParams;
  const { supabase, profile } = await requireProfile();
  return (
    <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6"><h1 className="font-display text-2xl font-black sm:text-3xl">Tareas del proyecto</h1>
      <TasksSection supabase={supabase} profile={profile} projectId={projectId} base={`/portal/${projectId}/tareas`} clientView={true} searchParams={searchParams} />
    </main>
  );
}
