import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { ReportDocument } from "@/lib/pdf/report-document";
import type { ReportSnapshot } from "@/lib/report";

export async function GET(_req: Request, ctx: RouteContext<"/api/pdf/informe/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  // RLS: el cliente solo ve informes visibles de sus proyectos.
  const { data } = await supabase.from("reports").select("snapshot, period_end").eq("id", id).maybeSingle();
  if (!data) return new Response("Informe no encontrado", { status: 404 });
  const pdf = await renderToBuffer(createElement(ReportDocument, { r: data.snapshot as ReportSnapshot }) as Parameters<typeof renderToBuffer>[0]);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Informe-quincenal-${data.period_end}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
