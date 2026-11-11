import type { Metadata } from "next";
import { ReportsSection } from "@/components/analysis/reports-section";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Informes" };

export default async function Page(props: PageProps<"/portal/[projectId]/informes">) {
  const { projectId } = await props.params;
  const { supabase } = await requireProfile();
  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <h1 className="font-display text-2xl font-black sm:text-3xl">Informes quincenales</h1>
      <ReportsSection supabase={supabase} projectId={projectId} path={`/portal/${projectId}/informes`} isAdmin={false} clientView />
    </main>
  );
}
