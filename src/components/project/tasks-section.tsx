import { Plus } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RealtimeRefresh } from "@/components/escala/realtime-refresh";
import { EscalaTile } from "@/components/escala/escala-tile";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getBrands, getProjectPeople, getTasks, TASK_STATUS_LABEL, type TaskFilters as F } from "@/lib/data";
import type { Profile } from "@/lib/auth";
import { STEPS } from "@/lib/escala";
import { day, todayLaPaz } from "@/lib/format";
import { cn } from "@/lib/utils";
import { KanbanBoard } from "./kanban-board";
import { TaskCalendar } from "./task-calendar";
import { TaskFilters } from "./task-filters";
import { TaskForm } from "./task-form";
import Link from "next/link";

export async function TasksSection({
  supabase,
  profile,
  projectId,
  base,
  clientView,
  searchParams,
}: {
  supabase: SupabaseClient;
  profile: Profile;
  projectId: string;
  base: string; // ruta de la lista de tareas
  clientView: boolean;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const sp = Object.fromEntries(Object.entries(searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) as F & {
    vista?: string;
    mes?: string;
  };
  const today = todayLaPaz();
  const [brands, people, tasks] = await Promise.all([
    getBrands(supabase, projectId),
    getProjectPeople(supabase, projectId),
    getTasks(supabase, projectId, sp, { clientView, today }),
  ]);
  const brandName = new Map(brands.map((b) => [b.id, b.name]));
  const personName = new Map(people.map((p) => [p.id, p.full_name ?? p.email]));
  const isAdmin = profile.role === "admin" && !clientView;
  const cards = tasks.map((t) => ({
    ...t,
    brandName: t.brand_id ? brandName.get(t.brand_id) : undefined,
    assigneeName: t.assignee_id ? personName.get(t.assignee_id) : null,
    movable: isAdmin || (profile.role === "especialista" && t.assignee_id === profile.id),
  }));
  const vista = sp.vista ?? "kanban";
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `${base}?${p.toString()}`;
  };

  return (
    <div className="space-y-4">
      <RealtimeRefresh projectId={projectId} brandIds={brands.map((b) => b.id)} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TaskFilters brands={brands} people={people.filter((p) => p.role !== "cliente")} showPeople={!clientView} />
        <span className="text-xs text-muted">{tasks.length} tareas</span>
      </div>

      {isAdmin && (
        <details className="group rounded-3xl bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-6 py-4 font-display font-extrabold [&::-webkit-details-marker]:hidden">
            <Plus className="size-4 text-brand transition-transform group-open:rotate-45" /> Nueva tarea
          </summary>
          <div className="border-t border-line/60 p-6">
            <TaskForm projectId={projectId} brands={brands} people={people} path={base} />
          </div>
        </details>
      )}

      {vista === "lista" ? (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line/60 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3">Tarea</th>
                <th className="px-3 py-3">Marca</th>
                <th className="px-3 py-3">Responsable</th>
                <th className="px-3 py-3">Vence</th>
                <th className="px-5 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/50">
              {cards.map((t) => {
                const letter = STEPS.find((s) => s.code === t.step_code)?.letter;
                const overdue = t.status !== "hecho" && t.due_date && t.due_date < today;
                return (
                  <tr key={t.id} className="hover:bg-surface-2/60">
                    <td className="px-5 py-3">
                      <Link href={`${base}/${t.id}`} className="flex items-center gap-2 font-semibold hover:text-brand">
                        {letter && <EscalaTile letter={letter} size="xs" />}
                        {t.title}
                        {t.visibility === "interno" && <Badge tone="warn">Interna</Badge>}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-muted">{t.brandName ?? "—"}</td>
                    <td className="px-3 py-3 text-muted">{t.assigneeName ?? "—"}</td>
                    <td className={cn("px-3 py-3", overdue ? "font-bold text-brand" : "text-muted")}>{t.due_date ? day(t.due_date, "d MMM") : "—"}</td>
                    <td className="px-5 py-3">
                      <Badge tone={t.status === "hecho" ? "ok" : t.status === "en_revision" ? "brand" : "neutral"}>{TASK_STATUS_LABEL[t.status]}</Badge>
                    </td>
                  </tr>
                );
              })}
              {!cards.length && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-muted">No hay tareas con estos filtros.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      ) : vista === "calendario" ? (
        <TaskCalendar
          tasks={cards}
          month={sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : today.slice(0, 7)}
          today={today}
          hrefBase={base}
          monthHref={(m) => qs({ mes: m })}
        />
      ) : (
        <KanbanBoard
          key={cards.map((c) => c.id + c.status).join()}
          tasks={cards}
          hrefBase={base}
          today={today}
          movable={!clientView && profile.role !== "cliente"}
          path={base}
        />
      )}
    </div>
  );
}
