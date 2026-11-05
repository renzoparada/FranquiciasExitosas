import type { Metadata } from "next";
import { DeliverablesSection } from "@/components/project/deliverables-section";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Entregables" };

export default async function Page(props: PageProps<"/portal/[projectId]/entregables">) {
  const { projectId } = await props.params;
  const searchParams = await props.searchParams;
  const { supabase, profile } = await requireProfile();
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6"><div><h1 className="font-display text-2xl font-black sm:text-3xl">Entregables</h1><p className="text-sm text-muted">Revisa, aprueba u observa cada entregable. Puedes descargarlo cuando su cuota esté pagada.</p></div>
      <DeliverablesSection supabase={supabase} profile={profile} projectId={projectId} base={`/portal/${projectId}/entregables`} clientView={true} searchParams={searchParams} />
    </main>
  );
}
