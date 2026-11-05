import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EscalaTile } from "@/components/escala/escala-tile";
import { GateDiamond } from "@/components/escala/gate-diamond";
import { RealtimeRefresh } from "@/components/escala/realtime-refresh";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getBrands, REVIEW_LABEL, type ReviewStatus } from "@/lib/data";
import { GATES, GATE_STATUS_LABEL, STEPS, type GateStatus } from "@/lib/escala";
import { dateTime, day } from "@/lib/format";

export async function GatesSection({ supabase, projectId, base, clientView }: { supabase: SupabaseClient; projectId: string; base: string; clientView: boolean }) {
  const brands = await getBrands(supabase, projectId);
  const { data: gates } = await supabase
    .from("brand_gates")
    .select("id, brand_id, gate_code, status, planned_date, passed_at, gate_minutes(id, status, version, approved_by_name, approved_at)")
    .in("brand_id", brands.map((b) => b.id));

  return (
    <div className="space-y-6">
      <RealtimeRefresh projectId={projectId} brandIds={brands.map((b) => b.id)} />
      {brands.map((b) => (
        <Card key={b.id} className="p-0">
          <h3 className="border-b border-line/60 px-5 py-4 font-display text-lg font-black">{b.name}</h3>
          <ul className="divide-y divide-line/50">
            {GATES.map((g) => {
              const row = gates?.find((x) => x.brand_id === b.id && x.gate_code === g.code);
              if (!row) return null;
              const minutes = ((row.gate_minutes ?? []) as { id: string; status: ReviewStatus; version: number; approved_by_name: string | null; approved_at: string | null }[])
                .filter((m) => !clientView || m.status !== "borrador")
                .sort((a, c) => c.version - a.version)[0];
              const step = STEPS.find((s) => s.code === g.step)!;
              return (
                <li key={g.code}>
                  <Link href={`${base}/${row.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-surface-2/60">
                    <GateDiamond status={row.status as GateStatus} size="lg" className="mx-1" />
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-black uppercase tracking-wide">{g.name}</p>
                      <p className="text-xs text-muted">{g.criterion}</p>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      Cierra <EscalaTile letter={step.letter} size="xs" />
                    </span>
                    <span className="w-32 text-right text-xs text-muted">
                      {row.status === "superada"
                        ? `Superada ${dateTime(row.passed_at, "d MMM yyyy")}`
                        : row.planned_date
                          ? `Prevista ${day(row.planned_date, "d MMM yyyy")}`
                          : "Con la apertura"}
                    </span>
                    <Badge tone={row.status === "superada" ? "ok" : row.status === "acta_enviada" ? "brand" : row.status === "observada" ? "warn" : "neutral"}>
                      {minutes ? `Acta: ${minutes.status === "enviado" ? "por aprobar" : REVIEW_LABEL[minutes.status].toLowerCase()}` : GATE_STATUS_LABEL[row.status as GateStatus]}
                    </Badge>
                    <ArrowRight className="size-4 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}
