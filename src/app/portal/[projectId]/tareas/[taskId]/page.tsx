import type { Metadata } from "next";
import { TaskDetail } from "@/components/project/task-detail";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Tarea" };

export default async function Page(props: PageProps<"/portal/[projectId]/tareas/[taskId]">) {
  const { projectId, taskId } = await props.params;
  const { supabase, profile } = await requireProfile();
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <TaskDetail supabase={supabase} profile={profile} projectId={projectId} taskId={taskId} base={`/portal/${projectId}/tareas`} clientView={true} />
    </main>
  );
}
