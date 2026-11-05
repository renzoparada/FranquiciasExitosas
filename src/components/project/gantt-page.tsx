import { GanttChart } from "./gantt-chart";
import { RealtimeRefresh } from "@/components/escala/realtime-refresh";
import { getBrands, getGantt } from "@/lib/data";
import { todayLaPaz } from "@/lib/format";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function GanttSection({
  supabase,
  projectId,
  editable,
  path,
}: {
  supabase: SupabaseClient;
  projectId: string;
  editable: boolean;
  path: string;
}) {
  const brands = await getBrands(supabase, projectId);
  const { steps, gates } = await getGantt(supabase, brands.map((b) => b.id));
  return (
    <>
      <RealtimeRefresh projectId={projectId} brandIds={brands.map((b) => b.id)} />
      {/* key: reinicia el estado local cuando cambian los datos del servidor */}
      <GanttChart
        key={steps.map((s) => `${s.id}${s.planned_start}${s.planned_end}${s.status}`).join("|")}
        brands={brands}
        steps={steps}
        gates={gates}
        today={todayLaPaz()}
        editable={editable}
        path={path}
      />
    </>
  );
}
