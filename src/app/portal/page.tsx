import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";

export default async function PortalIndex() {
  const { supabase, profile } = await requireProfile();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, clients(name, logo_url)")
    .order("created_at", { ascending: false });

  if (projects?.length === 1 && profile.role === "cliente") redirect(`/portal/${projects[0].id}`);

  return (
    <>
      <AppHeader profile={profile} href="/portal" />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-black">Tus proyectos</h1>
        {!projects?.length ? (
          <Card className="mt-6 text-sm text-muted">
            Todavía no tienes proyectos asignados. Tu consultor te avisará cuando esté listo.
          </Card>
        ) : (
          <div className="mt-6 space-y-3">
            {projects.map((p) => (
              <Link key={p.id} href={`/portal/${p.id}`} className="block">
                <Card className="flex items-center justify-between transition-shadow hover:shadow-md">
                  <div>
                    <p className="font-display text-lg font-extrabold">{p.name}</p>
                    <p className="text-sm text-muted">{(p.clients as unknown as { name: string } | null)?.name}</p>
                  </div>
                  <ArrowRight className="size-5 text-brand" />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
