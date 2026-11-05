import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { ActaDocument, type ActaData } from "@/lib/pdf/acta-document";
import { GATES, STEPS } from "@/lib/escala";
import { dateTime } from "@/lib/format";

const DECISION: Record<string, string> = { franquiciar: "Franquiciar", ajustar: "Ajustar antes de franquiciar", no_franquiciar: "Todavía no franquiciar" };

export async function GET(_req: Request, ctx: RouteContext<"/api/pdf/acta/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  // RLS: el cliente solo ve actas enviadas de sus proyectos.
  const { data: m } = await supabase
    .from("gate_minutes")
    .select("id, title, content, status, sent_at, approved_by_name, approved_at, content_hash, brand_gates!inner(gate_code, brand_id, brands!inner(name, project_id, projects!inner(name, clients(name))))")
    .eq("id", id)
    .maybeSingle();
  if (!m) return new Response("Acta no encontrada", { status: 404 });

  const g = m.brand_gates as unknown as {
    gate_code: string;
    brand_id: string;
    brands: { name: string; project_id: string; projects: { name: string; clients: { name: string } | null } };
  };
  const def = GATES.find((x) => x.code === g.gate_code)!;
  const step = STEPS.find((x) => x.code === def.step)!;
  const { data: steps } = await supabase.from("brand_steps").select("step_code, status").eq("brand_id", g.brand_id);
  const completed = STEPS.findIndex((st) => steps?.find((x) => x.step_code === st.code)?.status !== "cerrado");
  const c = (m.content ?? {}) as Record<string, string>;

  const data: ActaData = {
    title: m.title,
    clientName: g.brands.projects.clients?.name ?? "",
    projectName: g.brands.projects.name,
    brandName: g.brands.name,
    gateName: def.name,
    criterion: def.criterion,
    stepLetter: step.letter,
    stepName: step.name,
    sections: [
      { label: "Antecedentes", text: c.antecedentes },
      { label: "Resultados", text: c.resultados },
      { label: "Decisión", text: [c.decision && DECISION[c.decision], c.decision_texto].filter(Boolean).join(". ") },
      { label: "Próximos pasos", text: c.proximos_pasos },
    ].filter((x) => x.text) as { label: string; text: string }[],
    status: m.status,
    approvedBy: m.approved_by_name,
    approvedAt: m.approved_at ? dateTime(m.approved_at, "d 'de' MMMM 'de' yyyy, HH:mm") : null,
    hash: m.content_hash,
    sentAt: m.sent_at ? dateTime(m.sent_at, "d 'de' MMMM 'de' yyyy") : null,
    completedLetters: completed === -1 ? 6 : completed,
  };

  const pdf = await renderToBuffer(createElement(ActaDocument, { d: data }) as Parameters<typeof renderToBuffer>[0]);
  const filename = `Acta-${def.name}-${g.brands.name}.pdf`.replace(/\s+/g, "-");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
