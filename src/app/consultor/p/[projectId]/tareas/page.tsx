import type { Metadata } from "next";
import { TasksSection } from "@/components/project/tasks-section";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Tareas" };

export default async function Page(props: PageProps<"/consultor/p/[projectId]/tareas">) {
  const { projectId } = await props.params;
  const searchParams = await props.searchParams;
  const { supabase, profile } = await requireStaff();
  return (
    <>
      <TasksSection supabase={supabase} profile={profile} projectId={projectId} base={`/consultor/p/${projectId}/tareas`} clientView={false} searchParams={searchParams} />
    </>
  );
}
