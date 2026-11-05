import { notFound } from "next/navigation";
import Link from "next/link";
import { Eye } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
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
      <AppHeader profile={profile} href={`/portal/${projectId}`} clientLogo={client?.logo_url} clientName={client?.name} />
      {props.children}
    </CelebrationProvider>
  );
}
