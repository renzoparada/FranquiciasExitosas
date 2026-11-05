"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { moveTask } from "@/app/actions/project";
import { cn } from "@/lib/utils";
import { TaskCard, type TaskCardData } from "./task-card";

const COLUMNS = [
  { id: "por_hacer", label: "Por hacer" },
  { id: "en_curso", label: "En curso" },
  { id: "en_revision", label: "En revisión" },
  { id: "hecho", label: "Hecho" },
];

export function KanbanBoard({
  tasks: initial,
  hrefBase,
  today,
  movable,
  path,
}: {
  tasks: (TaskCardData & { movable?: boolean })[];
  hrefBase: string;
  today: string;
  movable: boolean;
  path: string;
}) {
  const [tasks, setTasks] = useState(initial);
  const [over, setOver] = useState<string | null>(null);
  const [, start] = useTransition();

  function drop(status: string, id: string) {
    const t = tasks.find((x) => x.id === id);
    if (!t || t.status === status) return;
    const prev = t.status;
    setTasks((all) => all.map((x) => (x.id === id ? { ...x, status } : x)));
    start(async () => {
      const r = await moveTask(id, status, path);
      if (!r?.ok) {
        toast.error(r?.message ?? "No se pudo mover la tarea.");
        setTasks((all) => all.map((x) => (x.id === id ? { ...x, status: prev } : x)));
      }
    });
  }

  return (
    <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 xl:grid-cols-4">
      {COLUMNS.map((c) => {
        const items = tasks.filter((t) => t.status === c.id);
        return (
          <section
            key={c.id}
            onDragOver={(e) => {
              if (!movable) return;
              e.preventDefault();
              setOver(c.id);
            }}
            onDragLeave={() => setOver((o) => (o === c.id ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              drop(c.id, e.dataTransfer.getData("text/plain"));
            }}
            className={cn(
              "w-[80vw] shrink-0 snap-start rounded-3xl bg-surface-2/80 p-3 transition-colors sm:w-auto",
              over === c.id && "bg-brand-soft ring-2 ring-brand/40",
            )}
          >
            <header className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-sm font-black">{c.label}</h3>
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-bold text-muted">{items.length}</span>
            </header>
            <div className="space-y-2">
              {items.map((t) => (
                <div
                  key={t.id}
                  draggable={movable && t.movable !== false}
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                  className={cn(movable && t.movable !== false && "cursor-grab active:cursor-grabbing")}
                >
                  <TaskCard t={t} href={`${hrefBase}/${t.id}`} today={today} />
                </div>
              ))}
              {!items.length && <p className="px-1 py-6 text-center text-xs text-muted">Sin tareas</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
