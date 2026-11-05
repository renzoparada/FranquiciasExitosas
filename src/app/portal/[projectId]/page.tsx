import type { Metadata } from "next";
import { CalendarClock, CheckCheck, FileSearch, FileText, Hourglass, Inbox, Video } from "lucide-react";
import { EscalaHero } from "@/components/escala/escala-hero";
import { ProgressRing } from "@/components/escala/progress-ring";
import { RealtimeRefresh } from "@/components/escala/realtime-refresh";
import { ActivityFeed, type FeedItem } from "@/components/portal/activity-feed";
import { ActionRequired, type ActionItem } from "@/components/portal/action-required";
import { StatCard } from "@/components/portal/stat-card";
import { Card, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import type { ProjectOverview } from "@/lib/escala";
import { dateTime, day, isoDaysAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Tu proyecto" };

type BrandRef = { name: string } | null;

export default async function ClientDashboard(props: PageProps<"/portal/[projectId]">) {
  const { projectId } = await props.params;
  const { supabase } = await requireProfile();
  const weekAgo = isoDaysAgo(7);
  const nowIso = isoDaysAgo(0);

  // Toda consulta del portal filtra visibility = 'cliente' (así el consultor ve
  // exactamente lo mismo que el cliente al usar "ver como cliente").
  const [project, overviewRes, feed, deliverables, minutes, requests, meeting, report] = await Promise.all([
    supabase.from("projects").select("name").eq("id", projectId).single(),
    supabase.rpc("get_project_overview", { p_project: projectId }),
    supabase
      .from("activity_feed")
      .select("id, kind, summary, step_code, created_at")
      .eq("project_id", projectId)
      .eq("visibility", "cliente")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("deliverables")
      .select("id, brand_id, title, step_code, due_date, brands!inner(name, project_id)")
      .eq("brands.project_id", projectId)
      .eq("status", "enviado")
      .eq("visibility", "cliente")
      .order("due_date"),
    supabase
      .from("gate_minutes")
      .select("id, title, brand_gates!inner(id, gate_code, brands!inner(name, project_id))")
      .eq("brand_gates.brands.project_id", projectId)
      .eq("status", "enviado"),
    supabase
      .from("info_requests")
      .select("id, brand_id, title, status, due_date, brands!inner(name, project_id)", { count: "exact" })
      .eq("brands.project_id", projectId)
      .in("status", ["pendiente", "observado"])
      .order("sort")
      .limit(6),
    supabase
      .from("meetings")
      .select("id, title, scheduled_at, location_or_link")
      .eq("project_id", projectId)
      .eq("visibility", "cliente")
      .gte("scheduled_at", nowIso)
      .order("scheduled_at")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("reports")
      .select("id, period_start, period_end, created_at")
      .eq("project_id", projectId)
      .eq("visibility", "cliente")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (overviewRes.error) throw new Error(overviewRes.error.message);
  const overview = overviewRes.data as ProjectOverview;
  const { stats, brands } = overview;

  const actions: ActionItem[] = [
    ...(minutes.data ?? []).map((m) => {
      const g = m.brand_gates as unknown as { id: string; gate_code: string; brands: BrandRef };
      return { id: m.id, type: "acta" as const, title: m.title, brand: g.brands?.name ?? "", href: `/portal/${projectId}/puertas/${g.id}` };
    }),
    ...(deliverables.data ?? []).map((d) => ({
      id: d.id,
      type: "entregable" as const,
      title: d.title,
      brand: (d.brands as unknown as BrandRef)?.name ?? "",
      step_code: d.step_code,
      due: d.due_date,
      href: `/portal/${projectId}/entregables?marca=${d.brand_id}&d=${d.id}`,
    })),
    ...(requests.data ?? []).map((r) => ({
      id: r.id,
      type: "informacion" as const,
      title: r.title,
      brand: (r.brands as unknown as BrandRef)?.name ?? "",
      observed: r.status === "observado",
      due: r.due_date,
      href: `/portal/${projectId}/informacion?marca=${r.brand_id}`,
    })),
  ];
  const actionTotal = (minutes.data?.length ?? 0) + (deliverables.data?.length ?? 0) + (requests.count ?? 0);
  const toReview = stats.deliverables_to_review + stats.minutes_to_review;
  const nextGate = stats.next_gate;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
      <RealtimeRefresh projectId={projectId} brandIds={brands.map((b) => b.id)} />

      <EscalaHero brands={brands} projectName={project.data?.name ?? ""} />

      {/* Avance */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-wrap items-center justify-around gap-x-4 gap-y-6 py-8">
          <ProgressRing value={stats.overall_progress} size={150} stroke={12} label="Avance total" />
          {brands.map((b, i) => (
            <ProgressRing
              key={b.id}
              value={b.progress}
              size={92}
              stroke={8}
              label={b.name}
              color={i % 2 === 0 ? "var(--brand)" : "var(--ink)"}
            />
          ))}
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatCard icon={<CheckCheck className="size-4" />} value={stats.tasks_done_week} label="Tareas completadas" hint="esta semana" delay={0} />
          <StatCard icon={<FileSearch className="size-4" />} value={toReview} label="Por revisar" hint="entregables y actas" accent={toReview > 0} delay={60} />
          <StatCard
            icon={<Hourglass className="size-4" />}
            value={nextGate ? Math.max(0, nextGate.days) : "—"}
            label="Días a la próxima puerta"
            hint={nextGate ? `${nextGate.name.toUpperCase()} · ${nextGate.brand}` : "Sin fecha"}
            delay={120}
          />
          <StatCard icon={<Inbox className="size-4" />} value={stats.info_pending} label="Información pendiente" hint="que necesitamos de ti" delay={180} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <ActionRequired items={actions.slice(0, 6)} total={actionTotal} />

        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-2 text-brand">
              <CalendarClock className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em]">Próxima reunión</span>
            </div>
            {meeting.data ? (
              <>
                <p className="font-display mt-2 text-lg font-extrabold">{meeting.data.title}</p>
                <p className="text-sm text-muted">{dateTime(meeting.data.scheduled_at, "EEEE d 'de' MMMM · HH:mm")} (La Paz)</p>
                {meeting.data.location_or_link?.startsWith("http") ? (
                  <a href={meeting.data.location_or_link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                    <Video className="size-4" /> Unirse a la reunión
                  </a>
                ) : (
                  meeting.data.location_or_link && <p className="mt-2 text-sm">{meeting.data.location_or_link}</p>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">Aún no hay una reunión agendada.</p>
            )}
          </Card>
          <Card>
            <div className="flex items-center gap-2 text-brand">
              <FileText className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em]">Último informe</span>
            </div>
            {report.data ? (
              <p className="mt-2 text-sm">
                Informe quincenal del <strong>{day(report.data.period_start)}</strong> al <strong>{day(report.data.period_end)}</strong>
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">El primer informe quincenal aparecerá aquí.</p>
            )}
          </Card>
        </div>
      </section>

      <Card>
        <CardTitle>Lo que hicimos por ti esta semana</CardTitle>
        <div className="mt-4">
          <ActivityFeed items={(feed.data ?? []) as FeedItem[]} />
        </div>
      </Card>
    </main>
  );
}
