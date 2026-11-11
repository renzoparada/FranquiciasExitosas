import type { Metadata } from "next";
import Link from "next/link";
import { CompetitorsSection } from "@/components/analysis/competitors-section";
import { FinanceSection } from "@/components/analysis/finance-section";
import { MatrixSection } from "@/components/analysis/matrix-section";
import { requireProfile } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Diagnóstico" };

const VIEWS = [
  { id: "matriz", label: "Matriz de franquiciabilidad" },
  { id: "competidores", label: "Competidores" },
  { id: "modelo", label: "Modelo financiero" },
];

export default async function Page(props: PageProps<"/portal/[projectId]/diagnostico">) {
  const { projectId } = await props.params;
  const searchParams = await props.searchParams;
  const { supabase } = await requireProfile();
  const ver = typeof searchParams.ver === "string" && VIEWS.some((v) => v.id === searchParams.ver) ? searchParams.ver : "matriz";
  const base = `/portal/${projectId}/diagnostico`;
  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-black sm:text-3xl">Diagnóstico y modelo</h1>
        <p className="text-sm text-muted">Pasos E y S: qué tan franquiciable es tu negocio, cómo está la competencia y cuánto gana el franquiciado.</p>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1 text-sm sm:w-fit">
        {VIEWS.map((v) => (
          <Link key={v.id} href={`${base}?ver=${v.id}`} className={cn("shrink-0 rounded-full px-4 py-1.5 font-semibold", ver === v.id ? "bg-ink text-canvas" : "text-muted hover:text-ink")}>
            {v.label}
          </Link>
        ))}
      </div>
      {ver === "matriz" && (
        <MatrixSection supabase={supabase} projectId={projectId} base={`${base}?ver=matriz`} editable={false} searchParams={searchParams} gatesBase={`/portal/${projectId}/puertas`} />
      )}
      {ver === "competidores" && <CompetitorsSection supabase={supabase} projectId={projectId} path={base} editable={false} clientView />}
      {ver === "modelo" && <FinanceSection supabase={supabase} projectId={projectId} base={`${base}?ver=modelo`} editable={false} isAdmin={false} searchParams={searchParams} />}
    </main>
  );
}
