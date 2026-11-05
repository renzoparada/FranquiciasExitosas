import type { Metadata } from "next";
import { TaskDetail } from "@/components/project/task-detail";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Tarea" };

export default async function Page(props: PageProps<"/consultor/p/[projectId]/tareas/[taskId]">) {
  const { projectId, taskId } = await props.params;
  const { supabase, profile } = await requireStaff();
  return (
    <>
      <TaskDetail supabase={supabase} profile={profile} projectId={projectId} taskId={taskId} base={`/consultor/p/${projectId}/tareas`} clientView={false} />
    </>
  );
}
