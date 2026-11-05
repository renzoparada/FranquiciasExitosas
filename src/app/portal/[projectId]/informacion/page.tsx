import type { Metadata } from "next";
import { InfoRequestsSection } from "@/components/project/info-requests-section";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Información" };

export default async function Page(props: PageProps<"/portal/[projectId]/informacion">) {
  const { projectId } = await props.params;
  const searchParams = await props.searchParams;
  const { supabase, profile } = await requireProfile();
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6"><div><h1 className="font-display text-2xl font-black sm:text-3xl">Información que necesitamos</h1><p className="text-sm text-muted">Sube cada documento y márcalo como enviado. Te avisaremos si falta algo.</p></div>
      <InfoRequestsSection supabase={supabase} profile={profile} projectId={projectId} base={`/portal/${projectId}/informacion`} clientView={true} searchParams={searchParams} />
    </main>
  );
}
