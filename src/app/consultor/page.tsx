import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Plus } from "lucide-react";
import { PageTitle } from "@/components/consultor/page-title";
import { MiniEscala } from "@/components/escala/mini-escala";
import { ProgressRing } from "@/components/escala/progress-ring";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import type { ProjectOverview } from "@/lib/escala";
import { day, money, todayLaPaz } from "@/lib/format";

export const metadata: Metadata = { title: "Cartera" };

export default async function Cartera() {
  const { supabase, profile } = await requireStaff();
  const isAdmin = profile.role === "admin";
  const today = todayLaPaz();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, start_date, clients(name, logo_url)")
    .order("created_at", { ascending: false });

  const overviews = await Promise.all(
    (projects ?? []).map(async (p) => {
      const { data } = await supabase.rpc("get_project_overview", { p_project: p.id });
      return [p.id, data as ProjectOverview] as const;
    }),
  );
  const ov: Record<string, ProjectOverview | undefined> = Object.fromEntries(overviews);

  const [{ count: overdue }, { data: dueInstallments }] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).lt("due_date", today).neq("status", "hecho"),
    isAdmin
      ? supabase
          .from("installments")
          .select("id, label, net_amount, tax_amount, due_date, status, fee_plans(currency, brands(name))")
          .neq("status", "pagada")
          .not("due_date", "is", null)
          .order("due_date")
          .limit(5)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  return (
    <>
      <PageTitle
        eyebrow={`Hola, ${profile.full_name?.split(" ")[0] ?? ""}`}
        title="Cartera de proyectos"
        description="Todos tus proyectos con el Método ESCALA®."
        actions={
          isAdmin && (
            <Button asChild>
              <Link href="/consultor/proyectos/nuevo">
                <Plus /> Nuevo proyecto
              </Link>
            </Button>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card className="flex items-center gap-4">
          <AlertTriangle className="size-6 text-brand" />
          <div>
            <p className="font-display text-2xl font-black">{overdue ?? 0}</p>
            <p className="text-sm text-muted">{profile.role === "especialista" ? "tus tareas vencidas" : "tareas vencidas en la cartera"}</p>
          </div>
        </Card>
        {isAdmin && (
          <Card>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Cobros por vencer</p>
            {dueInstallments?.length ? (
              <ul className="mt-2 space-y-1 text-sm">
                {dueInstallments.map((i) => {
                  const fp = i.fee_plans as unknown as { currency: "BOB" | "USD"; brands: { name: string } };
                  return (
                    <li key={i.id} className="flex justify-between gap-2">
                      <span className="truncate">
                        {fp.brands.name} · {i.label}
                      </span>
                      <span className="shrink-0 font-semibold">
                        {money(Number(i.net_amount) + Number(i.tax_amount), fp.currency)} · {day(i.due_date, "d MMM")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">Sin cuotas con fecha de vencimiento.</p>
            )}
          </Card>
        )}
      </div>

      {!projects?.length ? (
        <Card className="text-center">
          <p className="font-display text-xl font-black">Aún no hay proyectos</p>
          <p className="mt-1 text-sm text-muted">Crea un cliente y luego un proyecto desde la plantilla ESCALA.</p>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {projects.map((p) => {
            const o = ov[p.id];
            const client = p.clients as unknown as { name: string } | null;
            return (
              <Link key={p.id} href={`/consultor/p/${p.id}`} className="group">
                <Card className="flex h-full items-center gap-5 transition-shadow group-hover:shadow-md">
                  <ProgressRing value={o?.stats.overall_progress ?? 0} size={76} stroke={7} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <p className="truncate text-xs font-semibold text-muted">{client?.name}</p>
                      <p className="font-display truncate text-lg font-extrabold">{p.name}</p>
                    </div>
                    {o && <MiniEscala brands={o.brands} />}
                    <p className="text-xs text-muted">
                      {o?.brands.map((b) => b.name).join(" · ")}
                      {o?.stats.next_gate && ` · Próxima puerta: ${o.stats.next_gate.name.toUpperCase()} en ${o.stats.next_gate.days} días`}
                    </p>
                  </div>
                  <ArrowRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-brand" />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
