import Link from "next/link";
import { CalendarClock, Lock } from "lucide-react";
import { EscalaTile } from "@/components/escala/escala-tile";
import { STEPS } from "@/lib/escala";
import { day } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TaskCardData = {
  id: string;
  title: string;
  step_code: string | null;
  status: string;
  priority: string;
  visibility: string;
  due_date: string | null;
  brandName?: string;
  assigneeName?: string | null;
};

const PRIORITY_DOT: Record<string, string> = {
  baja: "bg-line",
  media: "bg-muted",
  alta: "bg-warn",
  urgente: "bg-brand",
};

export function TaskCard({ t, href, today, compact = false }: { t: TaskCardData; href: string; today: string; compact?: boolean }) {
  const letter = STEPS.find((s) => s.code === t.step_code)?.letter;
  const overdue = t.status !== "hecho" && t.due_date && t.due_date < today;
  return (
    <Link
      href={href}
      draggable={false}
      className={cn(
        "block rounded-2xl border border-line/60 bg-surface p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-md",
        t.status === "hecho" && "opacity-70",
      )}
    >
      <div className="flex items-start gap-2">
        {letter && <EscalaTile letter={letter} size="xs" className="mt-0.5" />}
        <p className={cn("min-w-0 flex-1 text-sm font-semibold leading-snug", t.status === "hecho" && "line-through decoration-muted/60")}>
          {t.title}
        </p>
        {t.visibility === "interno" && <Lock className="size-3.5 shrink-0 text-warn" aria-label="Interna" />}
      </div>
      {!compact && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <span className={cn("size-2 rounded-full", PRIORITY_DOT[t.priority])} /> {t.priority}
          </span>
          {t.brandName && <span>{t.brandName}</span>}
          {t.due_date && (
            <span className={cn("flex items-center gap-1", overdue && "font-bold text-brand")}>
              <CalendarClock className="size-3" /> {day(t.due_date, "d MMM")}
              {overdue && " · vencida"}
            </span>
          )}
          {t.assigneeName && <span className="ml-auto font-medium text-ink">{t.assigneeName}</span>}
        </div>
      )}
    </Link>
  );
}
