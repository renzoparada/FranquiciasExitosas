import Link from "next/link";
import { CalendarClock, CheckCircle2, ListPlus, Lock, Plus, Trash2, Video } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addAgreement, agreementToTask, deleteDecision, deleteMeeting, saveDecision, saveMeeting } from "@/app/actions/analysis";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { getBrands, getProjectPeople } from "@/lib/data";
import { dateTime, day, isoDaysAgo, todayLaPaz } from "@/lib/format";
import { cn } from "@/lib/utils";

type Meeting = {
  id: string;
  title: string;
  scheduled_at: string;
  duration_min: number;
  location_or_link: string | null;
  minutes: string | null;
  visibility: "interno" | "cliente";
  brand_id: string | null;
  meeting_agreements: { id: string; text: string; owner_id: string | null; due_date: string | null; task_id: string | null }[];
};
type Decision = { id: string; title: string; description: string | null; decided_on: string | null; owner_id: string | null; status: string; visibility: string; brand_id: string | null };

/** Bitácora de decisiones y reuniones. `tasksBase` = ruta de tareas para enlazar los acuerdos. */
export async function LogSection({
  supabase,
  projectId,
  path,
  tasksBase,
  isAdmin,
  clientView,
}: {
  supabase: SupabaseClient;
  projectId: string;
  path: string;
  tasksBase: string;
  isAdmin: boolean;
  clientView: boolean;
}) {
  let mq = supabase
    .from("meetings")
    .select("id, title, scheduled_at, duration_min, location_or_link, minutes, visibility, brand_id, meeting_agreements(id, text, owner_id, due_date, task_id)")
    .eq("project_id", projectId)
    .order("scheduled_at", { ascending: false });
  let dq = supabase.from("decisions").select("id, title, description, decided_on, owner_id, status, visibility, brand_id").eq("project_id", projectId).order("decided_on", { ascending: false, nullsFirst: true });
  if (clientView) {
    mq = mq.eq("visibility", "cliente");
    dq = dq.eq("visibility", "cliente");
  }
  const [{ data: m }, { data: d }, brands, people] = await Promise.all([mq, dq, getBrands(supabase, projectId), getProjectPeople(supabase, projectId)]);
  const meetings = (m ?? []) as Meeting[];
  const decisions = (d ?? []) as Decision[];
  const nameOf = (id: string | null) => people.find((p) => p.id === id)?.full_name ?? null;
  const brandOf = (id: string | null) => brands.find((b) => b.id === id)?.name ?? null;
  const now = Date.parse(isoDaysAgo(0));
  const upcoming = meetings.filter((x) => Date.parse(x.scheduled_at) >= now).reverse();
  const past = meetings.filter((x) => Date.parse(x.scheduled_at) < now);

  const meetingCard = (mt: Meeting, isPast: boolean) => (
    <li key={mt.id} className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-start gap-3">
        <span className={cn("flex size-10 shrink-0 flex-col items-center justify-center rounded-xl text-center leading-none", isPast ? "bg-surface-2" : "bg-brand text-white")}>
          <span className="text-[10px] font-bold uppercase">{dateTime(mt.scheduled_at, "MMM")}</span>
          <span className="font-display text-base font-black">{dateTime(mt.scheduled_at, "d")}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {mt.title} {mt.visibility === "interno" && <Badge tone="warn"><Lock className="size-3" /> Interna</Badge>}
          </p>
          <p className="text-xs text-muted">
            {dateTime(mt.scheduled_at, "EEEE d 'de' MMMM · HH:mm")} (La Paz) · {mt.duration_min} min{brandOf(mt.brand_id) ? ` · ${brandOf(mt.brand_id)}` : ""}
          </p>
          {mt.location_or_link &&
            (mt.location_or_link.startsWith("http") ? (
              <a href={mt.location_or_link} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand"><Video className="size-3.5" /> Unirse</a>
            ) : (
              <p className="text-xs">{mt.location_or_link}</p>
            ))}
        </div>
        {isAdmin && (
          <form action={deleteMeeting}>
            <input type="hidden" name="meeting_id" value={mt.id} /><input type="hidden" name="path" value={path} />
            <button className="rounded-full p-1.5 text-muted hover:text-brand" aria-label="Eliminar reunión"><Trash2 className="size-4" /></button>
          </form>
        )}
      </div>

      {mt.minutes && (
        <div className="rounded-2xl bg-surface-2 p-3 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Minuta</p>
          <p className="whitespace-pre-wrap">{mt.minutes}</p>
        </div>
      )}

      {(mt.meeting_agreements.length > 0 || isAdmin) && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Acuerdos</p>
          <ul className="space-y-1.5">
            {mt.meeting_agreements.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line/60 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">{a.text}</span>
                <span className="text-xs text-muted">{[nameOf(a.owner_id), a.due_date && day(a.due_date, "d MMM")].filter(Boolean).join(" · ")}</span>
                {a.task_id ? (
                  <Link href={`${tasksBase}/${a.task_id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-ok"><CheckCircle2 className="size-3.5" /> Tarea creada</Link>
                ) : (
                  isAdmin && (
                    <ActionForm action={agreementToTask}>
                      <input type="hidden" name="agreement_id" value={a.id} /><input type="hidden" name="path" value={path} />
                      <Button type="submit" size="sm" variant="outline"><ListPlus /> Convertir en tarea</Button>
                    </ActionForm>
                  )
                )}
              </li>
            ))}
          </ul>
          {isAdmin && (
            <ActionForm action={addAgreement} className="mt-2 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <input type="hidden" name="meeting_id" value={mt.id} /><input type="hidden" name="path" value={path} />
              <Input name="text" placeholder="Nuevo acuerdo" className="h-9 text-sm" required />
              <Select name="owner_id" defaultValue="" className="h-9 py-1 text-sm" aria-label="Responsable">
                <option value="">Responsable</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
              </Select>
              <Input name="due_date" type="date" className="h-9 text-sm" aria-label="Fecha" />
              <Button type="submit" size="sm" variant="ghost"><Plus /> Agregar</Button>
            </ActionForm>
          )}
        </div>
      )}

      {isAdmin && (
        <details>
          <summary className="cursor-pointer list-none text-xs font-semibold text-muted hover:text-ink [&::-webkit-details-marker]:hidden">Editar reunión y minuta</summary>
          <MeetingForm projectId={projectId} path={path} brands={brands} meeting={mt} />
        </details>
      )}
    </li>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <Card className="p-0">
          <div className="flex items-center gap-2 border-b border-line/60 px-5 py-4">
            <CalendarClock className="size-5 text-brand" />
            <CardTitle>Próximas reuniones</CardTitle>
          </div>
          {upcoming.length ? <ul className="divide-y divide-line/50">{upcoming.map((x) => meetingCard(x, false))}</ul> : <p className="px-5 py-6 text-sm text-muted">No hay reuniones agendadas.</p>}
          {isAdmin && (
            <details className="border-t border-line/60 px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden"><Plus className="size-4 text-brand" /> Agendar reunión</summary>
              <MeetingForm projectId={projectId} path={path} brands={brands} />
            </details>
          )}
        </Card>
        <Card className="p-0">
          <div className="border-b border-line/60 px-5 py-4"><CardTitle>Reuniones anteriores y minutas</CardTitle></div>
          {past.length ? <ul className="divide-y divide-line/50">{past.map((x) => meetingCard(x, true))}</ul> : <p className="px-5 py-6 text-sm text-muted">Sin reuniones registradas.</p>}
        </Card>
      </div>

      <Card className="h-fit p-0">
        <div className="border-b border-line/60 px-5 py-4">
          <CardTitle>Bitácora de decisiones</CardTitle>
          <CardDescription>Fecha, responsable y respaldo de cada decisión del proyecto.</CardDescription>
        </div>
        <ul className="divide-y divide-line/50">
          {decisions.map((dc) => (
            <li key={dc.id} className="space-y-1 px-5 py-4 text-sm">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 font-semibold">{dc.title}</p>
                <Badge tone={dc.status === "tomada" ? "ok" : "brand"}>{dc.status === "tomada" ? "Tomada" : "Pendiente"}</Badge>
              </div>
              {dc.description && <p className="whitespace-pre-wrap text-muted">{dc.description}</p>}
              <p className="text-xs text-muted">
                {[dc.decided_on ? day(dc.decided_on) : "Sin fecha", nameOf(dc.owner_id), brandOf(dc.brand_id)].filter(Boolean).join(" · ")}
                {dc.visibility === "interno" && " · interna"}
              </p>
              {isAdmin && (
                <div className="flex gap-3 pt-1">
                  {dc.status !== "tomada" && (
                    <ActionForm action={saveDecision}>
                      {Object.entries({ decision_id: dc.id, path, title: dc.title, description: dc.description ?? "", decided_on: todayLaPaz(), owner_id: dc.owner_id ?? "", brand_id: dc.brand_id ?? "", status: "tomada", visibility: dc.visibility }).map(([k, v]) => (
                        <input key={k} type="hidden" name={k} value={v} />
                      ))}
                      <button className="text-xs font-semibold text-ok hover:underline">Marcar como tomada hoy</button>
                    </ActionForm>
                  )}
                  <form action={deleteDecision}>
                    <input type="hidden" name="decision_id" value={dc.id} /><input type="hidden" name="path" value={path} />
                    <button className="text-xs font-semibold text-muted hover:text-brand">Eliminar</button>
                  </form>
                </div>
              )}
            </li>
          ))}
          {!decisions.length && <li className="px-5 py-6 text-sm text-muted">Sin decisiones registradas.</li>}
        </ul>
        {isAdmin && (
          <ActionForm action={saveDecision} className="space-y-3 border-t border-line/60 px-5 py-4">
            <input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="path" value={path} />
            <p className="text-sm font-semibold">Registrar decisión</p>
            <Input name="title" placeholder="¿Qué se decidió o qué hay que decidir?" required />
            <Textarea name="description" placeholder="Respaldo: datos, documento o reunión que la sustenta" className="min-h-16" />
            <div className="grid grid-cols-2 gap-2">
              <Input name="decided_on" type="date" aria-label="Fecha" />
              <Select name="owner_id" defaultValue="" aria-label="Responsable">
                <option value="">Responsable</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
              </Select>
              <Select name="status" defaultValue="pendiente" aria-label="Estado"><option value="pendiente">Pendiente</option><option value="tomada">Tomada</option></Select>
              <Select name="visibility" defaultValue="cliente" aria-label="Visibilidad"><option value="cliente">Visible para el cliente</option><option value="interno">Interna</option></Select>
              {brands.length > 1 && (
                <Select name="brand_id" defaultValue="" aria-label="Marca" className="col-span-2">
                  <option value="">Todas las marcas</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              )}
            </div>
            <Button type="submit">Registrar</Button>
          </ActionForm>
        )}
      </Card>
    </div>
  );
}

function MeetingForm({ projectId, path, brands, meeting }: { projectId: string; path: string; brands: { id: string; name: string }[]; meeting?: Meeting }) {
  const local = meeting ? new Date(Date.parse(meeting.scheduled_at) - 4 * 3600e3).toISOString() : null; // La Paz = UTC−4
  return (
    <ActionForm action={saveMeeting} resetOnSuccess={!meeting} className="mt-3 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="path" value={path} />
      {meeting && <input type="hidden" name="meeting_id" value={meeting.id} />}
      <div className="sm:col-span-2"><Field label="Título"><Input name="title" required defaultValue={meeting?.title} placeholder="Reunión de avance quincenal" /></Field></div>
      <Field label="Fecha"><Input name="date" type="date" required defaultValue={local?.slice(0, 10)} /></Field>
      <Field label="Hora (La Paz)"><Input name="time" type="time" required defaultValue={local?.slice(11, 16) ?? "10:00"} /></Field>
      <Field label="Duración (min)"><Input name="duration_min" type="number" min={15} step={15} defaultValue={meeting?.duration_min ?? 60} /></Field>
      <Field label="Lugar o enlace"><Input name="location_or_link" defaultValue={meeting?.location_or_link ?? ""} placeholder="https://meet… o dirección" /></Field>
      <Field label="Visibilidad">
        <Select name="visibility" defaultValue={meeting?.visibility ?? "cliente"}><option value="cliente">Visible para el cliente</option><option value="interno">Interna</option></Select>
      </Field>
      {brands.length > 1 && (
        <Field label="Marca">
          <Select name="brand_id" defaultValue={meeting?.brand_id ?? ""}>
            <option value="">Todas</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
      )}
      <div className="sm:col-span-2"><Field label="Minuta"><Textarea name="minutes" defaultValue={meeting?.minutes ?? ""} placeholder="Temas tratados y conclusiones" /></Field></div>
      <div><Button type="submit">{meeting ? "Guardar reunión" : "Agendar"}</Button></div>
    </ActionForm>
  );
}
