import { ArrowRight, FileCheck2, FileUp, Stamp } from "lucide-react";
import { EscalaTile } from "@/components/escala/escala-tile";
import { STEPS } from "@/lib/escala";
import { day } from "@/lib/format";

export type ActionItem = {
  id: string;
  type: "acta" | "entregable" | "informacion";
  title: string;
  brand: string;
  step_code?: string | null;
  due?: string | null;
  observed?: boolean;
};

const meta = {
  acta: { icon: <Stamp className="size-4" />, verb: "Aprobar acta" },
  entregable: { icon: <FileCheck2 className="size-4" />, verb: "Revisar entregable" },
  informacion: { icon: <FileUp className="size-4" />, verb: "Enviar información" },
};

export function ActionRequired({ items, total }: { items: ActionItem[]; total: number }) {
  return (
    <section className="rounded-[2rem] bg-ink p-6 text-canvas sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Acción requerida de tu parte</p>
          <h2 className="font-display mt-1 text-2xl font-black">
            {total === 0 ? "¡Estás al día!" : `${total} ${total === 1 ? "pendiente" : "pendientes"} para avanzar`}
          </h2>
        </div>
        {total > 0 && (
          <span className="font-display flex size-12 items-center justify-center rounded-2xl bg-brand text-2xl font-black text-white">
            {total}
          </span>
        )}
      </div>
      {total === 0 ? (
        <p className="mt-3 text-sm text-canvas/70">No tienes nada pendiente. Nosotros seguimos avanzando.</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {items.map((it) => {
            const letter = STEPS.find((s) => s.code === it.step_code)?.letter;
            return (
              <li key={`${it.type}-${it.id}`} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                  {meta[it.type].icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{it.title}</p>
                  <p className="text-xs text-canvas/60">
                    {meta[it.type].verb} · {it.brand}
                    {it.observed && " · Observado"}
                    {it.due && ` · vence ${day(it.due, "d MMM")}`}
                  </p>
                </div>
                {letter ? <EscalaTile letter={letter} size="xs" /> : <ArrowRight className="size-4 text-canvas/40" />}
              </li>
            );
          })}
          {total > items.length && <li className="pt-1 text-xs text-canvas/60">y {total - items.length} más…</li>}
        </ul>
      )}
    </section>
  );
}
