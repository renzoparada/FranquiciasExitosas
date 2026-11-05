import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { EscalaTile } from "@/components/escala/escala-tile";
import { STEPS } from "@/lib/escala";
import { cn } from "@/lib/utils";
import type { TaskCardData } from "./task-card";

export function TaskCalendar({
  tasks,
  month,
  today,
  hrefBase,
  monthHref,
}: {
  tasks: TaskCardData[];
  month: string; // yyyy-MM
  today: string;
  hrefBase: string;
  monthHref: (m: string) => string;
}) {
  const first = parseISO(`${month}-01`);
  const gridStart = startOfWeek(startOfMonth(first), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(first), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);
  const byDay = new Map<string, TaskCardData[]>();
  tasks.forEach((t) => {
    if (!t.due_date) return;
    byDay.set(t.due_date, [...(byDay.get(t.due_date) ?? []), t]);
  });
  const noDate = tasks.filter((t) => !t.due_date).length;

  return (
    <div className="rounded-3xl bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href={monthHref(format(addMonths(first, -1), "yyyy-MM"))} className="rounded-full p-2 hover:bg-surface-2" aria-label="Mes anterior">
          <ChevronLeft className="size-4" />
        </Link>
        <h3 className="font-display text-lg font-black capitalize">{format(first, "MMMM yyyy", { locale: es })}</h3>
        <Link href={monthHref(format(addMonths(first, 1), "yyyy-MM"))} className="rounded-full p-2 hover:bg-surface-2" aria-label="Mes siguiente">
          <ChevronRight className="size-4" />
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-line/60 bg-line/60 text-xs">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div key={d} className="bg-surface-2 px-2 py-1.5 text-center font-semibold text-muted">{d}</div>
        ))}
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const items = byDay.get(key) ?? [];
          return (
            <div key={key} className={cn("min-h-20 bg-surface p-1.5 sm:min-h-28", !isSameMonth(d, first) && "bg-surface-2/60 text-muted")}>
              <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-[11px] font-semibold", key === today && "bg-brand text-white")}>
                {format(d, "d")}
              </span>
              <div className="mt-1 space-y-1">
                {items.slice(0, 3).map((t) => {
                  const letter = STEPS.find((s) => s.code === t.step_code)?.letter;
                  const overdue = t.status !== "hecho" && key < today;
                  return (
                    <Link
                      key={t.id}
                      href={`${hrefBase}/${t.id}`}
                      title={t.title}
                      className={cn(
                        "flex items-center gap-1 truncate rounded-md px-1 py-0.5 text-[10px] font-medium hover:bg-surface-2 sm:text-[11px]",
                        t.status === "hecho" && "text-muted line-through",
                        overdue && "text-brand",
                      )}
                    >
                      {letter && <EscalaTile letter={letter} size="xs" className="hidden size-3.5 text-[8px] sm:inline-flex" />}
                      <span className="truncate">{t.title}</span>
                    </Link>
                  );
                })}
                {items.length > 3 && <span className="px-1 text-[10px] text-muted">+{items.length - 3} más</span>}
              </div>
            </div>
          );
        })}
      </div>
      {noDate > 0 && <p className="mt-3 text-xs text-muted">{noDate} tareas sin fecha (inician con la primera apertura).</p>}
    </div>
  );
}
