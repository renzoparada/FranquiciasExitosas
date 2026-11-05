import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Lock, Trash2 } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addChecklistItem, deleteChecklistItem, deleteTask, toggleChecklistItem } from "@/app/actions/project";
import { EscalaTile } from "@/components/escala/escala-tile";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import type { Profile } from "@/lib/auth";
import { getBrands, getComments, getFiles, getProjectPeople, PRIORITY_LABEL, signedFiles, TASK_STATUS_LABEL, type Task } from "@/lib/data";
import { SPECIALTY_LABEL, STEPS } from "@/lib/escala";
import { day, todayLaPaz } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Comments } from "./comments";
import { FileList } from "./file-list";
import { FileUploader } from "./file-uploader";
import { TaskForm } from "./task-form";

export async function TaskDetail({
  supabase,
  profile,
  projectId,
  taskId,
  base,
  clientView,
}: {
  supabase: SupabaseClient;
  profile: Profile;
  projectId: string;
  taskId: string;
  base: string;
  clientView: boolean;
}) {
  let q = supabase.from("tasks").select("*").eq("id", taskId).eq("project_id", projectId);
  if (clientView) q = q.eq("visibility", "cliente");
  const { data } = await q.maybeSingle();
  if (!data) notFound();
  const task = data as Task & { specialty: string | null };
  const path = `${base}/${taskId}`;
  const isAdmin = profile.role === "admin" && !clientView;
  const isStaff = profile.role !== "cliente" && !clientView;
  const canWork = isAdmin || (profile.role === "especialista" && task.assignee_id === profile.id);

  const [brands, people, checklist, files, comments] = await Promise.all([
    getBrands(supabase, projectId),
    getProjectPeople(supabase, projectId),
    supabase.from("task_checklist_items").select("id, text, done").eq("task_id", taskId).order("sort"),
    getFiles(supabase, "task", [taskId], clientView),
    getComments(supabase, "task", taskId, clientView),
  ]);
  const signed = await signedFiles(supabase, files);
  const step = STEPS.find((s) => s.code === task.step_code);
  const brand = brands.find((b) => b.id === task.brand_id);
  const assignee = people.find((p) => p.id === task.assignee_id);
  const items = checklist.data ?? [];
  const done = items.filter((i) => i.done).length;
  const overdue = task.status !== "hecho" && task.due_date && task.due_date < todayLaPaz();

  return (
    <div className="space-y-6">
      <Link href={base} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand">
        <ArrowLeft className="size-4" /> Tareas
      </Link>

      <Card>
        <div className="flex flex-wrap items-start gap-4">
          {step && <EscalaTile letter={step.letter} size="lg" title={step.name} />}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {[brand?.name, step?.name].filter(Boolean).join(" · ") || "General"}
            </p>
            <h1 className="font-display text-2xl font-black">{task.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone={task.status === "hecho" ? "ok" : task.status === "en_revision" ? "brand" : "dark"}>{TASK_STATUS_LABEL[task.status]}</Badge>
              <Badge>Prioridad {PRIORITY_LABEL[task.priority].toLowerCase()}</Badge>
              {task.visibility === "interno" && (
                <Badge tone="warn">
                  <Lock className="size-3" /> Interna
                </Badge>
              )}
            </div>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 border-t border-line/60 pt-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Responsable</dt>
            <dd className="mt-1 font-medium">
              {assignee?.full_name ?? "Equipo Franquicias Exitosas"}
              {task.specialty && <span className="text-muted"> · {SPECIALTY_LABEL[task.specialty]}</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Fecha límite</dt>
            <dd className={cn("mt-1 font-medium", overdue && "text-brand")}>
              {task.due_date ? day(task.due_date, "EEEE d 'de' MMMM") : "Por definir"} {overdue && "· vencida"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Checklist</dt>
            <dd className="mt-1 font-medium">{items.length ? `${done} de ${items.length}` : "—"}</dd>
          </div>
        </dl>
        {task.description && <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed">{task.description}</p>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Checklist</CardTitle>
          {items.length ? (
            <ul className="mt-3 space-y-1">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-surface-2">
                  {canWork ? (
                    <form action={toggleChecklistItem}>
                      <input type="hidden" name="item_id" value={i.id} />
                      <input type="hidden" name="done" value={i.done ? "0" : "1"} />
                      <input type="hidden" name="path" value={path} />
                      <button
                        className={cn(
                          "flex size-5 items-center justify-center rounded-md border-2",
                          i.done ? "border-brand bg-brand text-white" : "border-line",
                        )}
                        aria-label={i.done ? "Desmarcar" : "Marcar como hecho"}
                      >
                        {i.done && <Check className="size-3" strokeWidth={3} />}
                      </button>
                    </form>
                  ) : (
                    <span className={cn("flex size-5 items-center justify-center rounded-md border-2", i.done ? "border-brand bg-brand text-white" : "border-line")}>
                      {i.done && <Check className="size-3" strokeWidth={3} />}
                    </span>
                  )}
                  <span className={cn("flex-1 text-sm", i.done && "text-muted line-through")}>{i.text}</span>
                  {canWork && (
                    <form action={deleteChecklistItem}>
                      <input type="hidden" name="item_id" value={i.id} />
                      <input type="hidden" name="path" value={path} />
                      <button className="rounded-full p-1 text-muted hover:text-brand" aria-label="Eliminar ítem">
                        <Trash2 className="size-3.5" />
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Sin ítems.</p>
          )}
          {canWork && (
            <ActionForm action={addChecklistItem} className="mt-3 flex gap-2">
              <input type="hidden" name="task_id" value={taskId} />
              <input type="hidden" name="path" value={path} />
              <Input name="text" placeholder="Agregar ítem…" className="h-10" />
              <Button type="submit" variant="outline">Agregar</Button>
            </ActionForm>
          )}
        </Card>

        <Card>
          <CardTitle>Adjuntos</CardTitle>
          <div className="mt-3 space-y-3">
            <FileList files={signed} />
            <FileUploader
              target={{ projectId, brandId: task.brand_id, entityType: "task", entityId: taskId, visibility: "cliente" }}
              canChooseVisibility={isStaff}
              compact
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Comentarios</CardTitle>
        <div className="mt-4">
          <Comments comments={comments} projectId={projectId} entityType="task" entityId={taskId} path={path} isStaff={isStaff} />
        </div>
      </Card>

      {isAdmin && (
        <details className="group rounded-3xl bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <summary className="cursor-pointer list-none px-6 py-4 font-display font-extrabold [&::-webkit-details-marker]:hidden">
            Editar tarea
          </summary>
          <div className="space-y-4 border-t border-line/60 p-6">
            <TaskForm projectId={projectId} brands={brands} people={people} task={task} path={path} />
            <form action={deleteTask} className="border-t border-line/60 pt-4">
              <input type="hidden" name="task_id" value={taskId} />
              <input type="hidden" name="path" value={base} />
              <Button type="submit" variant="ghost" className="text-brand">
                <Trash2 /> Eliminar tarea
              </Button>
            </form>
          </div>
        </details>
      )}
    </div>
  );
}
