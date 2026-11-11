import { FileDown, FileText, Lock, Trash2 } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteReport, generateReport } from "@/app/actions/analysis";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/form";
import { dateTime, day } from "@/lib/format";

export async function ReportsSection({ supabase, projectId, path, isAdmin, clientView }: { supabase: SupabaseClient; projectId: string; path: string; isAdmin: boolean; clientView: boolean }) {
  let q = supabase.from("reports").select("id, period_start, period_end, visibility, created_at, snapshot").eq("project_id", projectId).order("created_at", { ascending: false });
  if (clientView) q = q.eq("visibility", "cliente");
  const { data } = await q;
  const reports = data ?? [];

  return (
    <div className="space-y-6">
      {isAdmin && (
        <Card>
          <CardTitle>Informe quincenal</CardTitle>
          <CardDescription>Una página con la palabra ESCALA y el avance, lo que hicimos, lo que sigue, los riesgos y las decisiones pendientes de los últimos 15 días. Solo incluye información visible para el cliente.</CardDescription>
          <ActionForm action={generateReport} className="mt-4 space-y-3">
            <input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="path" value={path} />
            <Textarea name="note" placeholder="Comentario del consultor (opcional)" className="min-h-16" />
            <div className="flex flex-wrap items-center gap-3">
              <Select name="visibility" defaultValue="cliente" className="w-auto" aria-label="Visibilidad">
                <option value="cliente">Publicar para el cliente</option>
                <option value="interno">Solo interno</option>
              </Select>
              <Button type="submit"><FileText /> Generar informe quincenal</Button>
            </div>
          </ActionForm>
        </Card>
      )}
      <Card className="p-0">
        <CardTitle className="border-b border-line/60 px-5 py-4">Informes</CardTitle>
        <ul className="divide-y divide-line/50">
          {reports.map((r) => {
            const snap = r.snapshot as { overall?: number; done?: unknown[] };
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 text-sm">
                <FileText className="size-5 text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Del {day(r.period_start)} al {day(r.period_end)}</p>
                  <p className="text-xs text-muted">Generado {dateTime(r.created_at)} · avance {snap.overall ?? 0} % · {snap.done?.length ?? 0} tareas cerradas</p>
                </div>
                {r.visibility === "interno" && <Badge tone="warn"><Lock className="size-3" /> Interno</Badge>}
                <Button asChild size="sm" variant="outline">
                  <a href={`/api/pdf/informe/${r.id}`} target="_blank" rel="noreferrer"><FileDown /> PDF</a>
                </Button>
                {isAdmin && (
                  <form action={deleteReport}>
                    <input type="hidden" name="report_id" value={r.id} /><input type="hidden" name="path" value={path} />
                    <button className="rounded-full p-1.5 text-muted hover:text-brand" aria-label="Eliminar informe"><Trash2 className="size-4" /></button>
                  </form>
                )}
              </li>
            );
          })}
          {!reports.length && <li className="px-5 py-6 text-sm text-muted">Todavía no hay informes.</li>}
        </ul>
      </Card>
    </div>
  );
}
