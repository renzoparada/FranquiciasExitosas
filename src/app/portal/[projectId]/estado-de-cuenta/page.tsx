import type { Metadata } from "next";
import { AccountStatement } from "@/components/analysis/account-statement";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Estado de cuenta" };

export default async function Page(props: PageProps<"/portal/[projectId]/estado-de-cuenta">) {
  const { projectId } = await props.params;
  const { supabase } = await requireProfile();
  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-black sm:text-3xl">Estado de cuenta</h1>
        <p className="text-sm text-muted">Honorarios por marca en cuotas ligadas a las puertas, más el fee de éxito por franquicia vendida.</p>
      </div>
      <AccountStatement supabase={supabase} projectId={projectId} />
    </main>
  );
}
