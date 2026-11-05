import type { Metadata } from "next";
import { GanttSection } from "@/components/project/gantt-page";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Gantt" };

export default async function ConsoleGantt(props: PageProps<"/consultor/p/[projectId]/gantt">) {
  const { projectId } = await props.params;
  const { supabase, profile } = await requireStaff();
  return (
    <GanttSection
      supabase={supabase}
      projectId={projectId}
      editable={profile.role === "admin"}
      path={`/consultor/p/${projectId}/gantt`}
    />
  );
}
