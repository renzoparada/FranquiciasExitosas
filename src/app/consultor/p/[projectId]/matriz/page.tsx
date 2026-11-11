import type { Metadata } from "next";
import { MatrixSection } from "@/components/analysis/matrix-section";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Matriz de franquiciabilidad" };

export default async function Page(props: PageProps<"/consultor/p/[projectId]/matriz">) {
  const { projectId } = await props.params;
  const searchParams = await props.searchParams;
  const { supabase } = await requireStaff();
  return (
    <MatrixSection supabase={supabase} projectId={projectId} base={`/consultor/p/${projectId}/matriz`} editable searchParams={searchParams} gatesBase={`/consultor/p/${projectId}/puertas`} />
  );
}
