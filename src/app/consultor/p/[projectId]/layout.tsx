import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectTabs, type Tab } from "@/components/layout/project-tabs";
import { requireStaff } from "@/lib/auth";

export default async function ConsoleProjectLayout(props: LayoutProps<"/consultor/p/[projectId]">) {
  const { projectId } = await props.params;
  const { supabase } = await requireStaff();
  const { data: project } = await supabase.from("projects").select("id, name").eq("id", projectId).maybeSingle();
  if (!project) notFound();
  const base = `/consultor/p/${projectId}`;
  const tabs: Tab[] = [
    { href: base, label: "Resumen", icon: "home", exact: true },
    { href: `${base}/gantt`, label: "Gantt", icon: "gantt" },
    { href: `${base}/tareas`, label: "Tareas", icon: "tasks" },
    { href: `${base}/entregables`, label: "Entregables", icon: "deliverables" },
    { href: `${base}/puertas`, label: "Puertas y actas", icon: "gates" },
    { href: `${base}/informacion`, label: "Información", icon: "info" },
  ];
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href={base} className="text-xs font-semibold uppercase tracking-[0.16em] text-muted hover:text-brand">
          {project.name}
        </Link>
        <ProjectTabs tabs={tabs} className="-mx-1 px-1 pb-1" />
      </div>
      {props.children}
    </div>
  );
}
