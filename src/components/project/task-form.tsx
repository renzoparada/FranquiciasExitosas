import { saveTask } from "@/app/actions/project";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { PRIORITY_LABEL, TASK_STATUS_LABEL, type Person, type Task } from "@/lib/data";
import { STEPS } from "@/lib/escala";

export function TaskForm({
  projectId,
  brands,
  people,
  task,
  path,
}: {
  projectId: string;
  brands: { id: string; name: string }[];
  people: Person[];
  task?: Task;
  path: string;
}) {
  const staff = people.filter((p) => p.role !== "cliente");
  return (
    <ActionForm action={saveTask} resetOnSuccess={!task} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="path" value={path} />
      {task && <input type="hidden" name="task_id" value={task.id} />}
      <div className="sm:col-span-2 lg:col-span-4">
        <Field label="Título">
          <Input name="title" required defaultValue={task?.title} placeholder="¿Qué hay que hacer?" />
        </Field>
      </div>
      <Field label="Marca">
        <Select name="brand_id" defaultValue={task?.brand_id ?? brands[0]?.id ?? ""}>
          <option value="">General del proyecto</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Letra ESCALA">
        <Select name="step_code" defaultValue={task?.step_code ?? "E"}>
          <option value="">Sin letra</option>
          {STEPS.map((s) => (
            <option key={s.code} value={s.code}>{s.letter} · {s.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Responsable">
        <Select name="assignee_id" defaultValue={task?.assignee_id ?? ""}>
          <option value="">Sin asignar</option>
          {staff.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
          ))}
        </Select>
      </Field>
      <Field label="Fecha límite">
        <Input name="due_date" type="date" defaultValue={task?.due_date ?? ""} />
      </Field>
      <Field label="Prioridad">
        <Select name="priority" defaultValue={task?.priority ?? "media"}>
          {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
      </Field>
      <Field label="Visibilidad">
        <Select name="visibility" defaultValue={task?.visibility ?? "cliente"}>
          <option value="cliente">Visible para el cliente</option>
          <option value="interno">Interna</option>
        </Select>
      </Field>
      <Field label="Estado">
        <Select name="status" defaultValue={task?.status ?? "por_hacer"}>
          {Object.entries(TASK_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-2 lg:col-span-4">
        <Field label="Descripción">
          <Textarea name="description" defaultValue={task?.description ?? ""} />
        </Field>
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <Button type="submit">{task ? "Guardar cambios" : "Crear tarea"}</Button>
      </div>
    </ActionForm>
  );
}
