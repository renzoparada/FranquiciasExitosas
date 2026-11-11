import { notFound } from "next/navigation";
import Link from "next/link";
import { Eye } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav, ProjectTabs, type Tab } from "@/components/layout/project-tabs";
import { CelebrationProvider } from "@/components/escala/celebration";
import { requireProfile } from "@/lib/auth";

export default async function PortalProjectLayout(props: LayoutProps<"/portal/[projectId]">) {
  const { projectId } = await props.params;
  const { supabase, profile } = await requireProfile();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, clients(name, logo_url)")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();
  const client = project.clients as unknown as { name: string; logo_url: string | null } | null;

  const { data: ov } = await supabase.rpc("get_project_overview", { p_project: projectId });
  const stats = (ov as { stats?: { deliverables_to_review: number; minutes_to_review: number; info_pending: number } } | null)?.stats;

  const base = `/portal/${projectId}`;
  const tabs: Tab[] = [
    { href: base, label: "Inicio", icon: "home", exact: true },
    { href: `${base}/avance`, label: "Avance", icon: "gantt" },
    { href: `${base}/tareas`, label: "Tareas", icon: "tasks" },
    { href: `${base}/entregables`, label: "Entregables", icon: "deliverables", badge: stats?.deliverables_to_review },
    { href: `${base}/puertas`, label: "Puertas", icon: "gates", badge: stats?.minutes_to_review },
    { href: `${base}/informacion`, label: "Información", icon: "info", badge: stats?.info_pending },
    { href: `${base}/diagnostico`, label: "Diagnóstico", icon: "matrix" },
    { href: `${base}/reuniones`, label: "Reuniones", icon: "log" },
    { href: `${base}/informes`, label: "Informes", icon: "reports" },
    { href: `${base}/estado-de-cuenta`, label: "Estado de cuenta", icon: "fees" },
  ];
  const mobile: Tab[] = [
    tabs[0],
    tabs[1],
    { ...tabs[3], label: "Entregas" },
    tabs[4],
    { ...tabs[5], label: "Info" },
    { href: `${base}/mas`, label: "Más", icon: "more" },
  ];

  return (
    <CelebrationProvider>
      {profile.role !== "cliente" && (
        <div className="bg-ink text-canvas">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 text-xs sm:px-6">
            <span className="flex items-center gap-2">
              <Eye className="size-3.5" /> Estás viendo el portal como lo ve el cliente.
            </span>
            <Link href={`/consultor/p/${projectId}`} className="font-semibold underline-offset-4 hover:underline">
              Volver a la consola
            </Link>
          </div>
        </div>
      )}
      <AppHeader profile={profile} href={base} clientLogo={client?.logo_url} clientName={client?.name} />
      <div className="mx-auto hidden max-w-7xl px-4 pt-4 sm:block sm:px-6">
        <ProjectTabs tabs={tabs} />
      </div>
      <div className="pb-20 sm:pb-0">{props.children}</div>
      <BottomNav tabs={mobile} />
    </CelebrationProvider>
  );
}
