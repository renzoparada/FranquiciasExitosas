import { CheckCircle2, Flag, Send, Sparkles } from "lucide-react";
import { EscalaTile } from "@/components/escala/escala-tile";
import { STEPS } from "@/lib/escala";
import { ago } from "@/lib/format";

export type FeedItem = { id: string; kind: string; summary: string; step_code: string | null; created_at: string };

const icons: Record<string, React.ReactNode> = {
  tarea_completada: <CheckCircle2 className="size-4" />,
  entregable_enviado: <Send className="size-4" />,
  entregable_aprobado: <CheckCircle2 className="size-4" />,
  puerta_superada: <Flag className="size-4" />,
};

export function ActivityFeed({ items }: { items: FeedItem[] }) {
  if (!items.length) {
    return (
      <p className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">
        Esta semana todavía no hay avances publicados. Aquí verás cada tarea que completemos por ti.
      </p>
    );
  }
  return (
    <ol className="relative space-y-1">
      {items.map((it, i) => {
        const letter = STEPS.find((s) => s.code === it.step_code)?.letter;
        return (
          <li
            key={it.id}
            className="animate-rise flex items-start gap-3 rounded-2xl p-2.5 hover:bg-surface-2"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              {icons[it.kind] ?? <Sparkles className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug">{it.summary}</p>
              <p className="text-xs text-muted">{ago(it.created_at)}</p>
            </div>
            {letter && <EscalaTile letter={letter} size="xs" />}
          </li>
        );
      })}
    </ol>
  );
}
