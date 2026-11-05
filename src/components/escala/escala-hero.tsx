"use client";

import { useEffect, useMemo, useState } from "react";
import { EscalaTile } from "./escala-tile";
import { GateDiamond } from "./gate-diamond";
import { useCelebration } from "./celebration";
import {
  GATES,
  GATE_STATUS_LABEL,
  LEMA,
  STEP_STATUS_LABEL,
  gateState,
  letterStates,
  type OverviewBrand,
} from "@/lib/escala";
import { day } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Palabra E·S·C·A·L·A gigante + 5 puertas. */
export function EscalaHero({ brands, projectName }: { brands: OverviewBrand[]; projectName: string }) {
  // Por defecto, la marca más avanzada (así las letras ya cerradas se ven en rojo).
  const [selected, setSelected] = useState<string>(
    () => [...brands].sort((a, b) => b.progress - a.progress)[0]?.id ?? "todas",
  );
  const { celebrate } = useCelebration();

  const scope = useMemo(
    () => (selected === "todas" ? brands : brands.filter((b) => b.id === selected)),
    [brands, selected],
  );
  const letters = letterStates(scope);
  const current = letters.find((l) => l.state === "current");

  // Celebra las puertas superadas en los últimos 14 días (una vez por navegador).
  useEffect(() => {
    const recent = brands
      .flatMap((b) => b.gates)
      .filter((g) => g.status === "superada" && g.passed_at && Date.now() - Date.parse(g.passed_at) < 14 * 864e5)
      .sort((a, b) => Date.parse(a.passed_at!) - Date.parse(b.passed_at!));
    recent.forEach((g) => celebrate(g.name, g.id));
  }, [brands, celebrate]);

  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-surface px-4 py-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:px-10 sm:py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Método ESCALA®</p>
          <h1 className="font-display mt-1 text-2xl font-black sm:text-3xl">{projectName}</h1>
          <p className="mt-1 text-sm text-muted">{LEMA}</p>
        </div>
        {brands.length > 1 && (
          <div className="flex rounded-full border border-line bg-surface-2 p-1 text-sm" role="tablist">
            {[{ id: "todas", name: "Todas" }, ...brands].map((b) => (
              <button
                key={b.id}
                role="tab"
                aria-selected={selected === b.id}
                onClick={() => setSelected(b.id)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 font-semibold transition-colors",
                  selected === b.id ? "bg-ink text-canvas" : "text-muted hover:text-ink",
                )}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* La palabra */}
      <div className="mt-8 flex justify-center gap-1.5 sm:mt-12 sm:gap-4" aria-label="Avance por letra ESCALA">
        {letters.map(({ step, state }) => {
          const detail = scope
            .map((b) => {
              const s = b.steps.find((x) => x.code === step.code);
              return s ? `${b.name}: ${s.locked ? "Bloqueado (registro de marca)" : STEP_STATUS_LABEL[s.status]}` : "";
            })
            .join(" · ");
          return (
            <div key={step.code} className="flex flex-col items-center gap-2">
              <EscalaTile letter={step.letter} state={state} size="xl" title={`${step.name} — ${detail}`} />
              <span
                className={cn(
                  "hidden max-w-24 text-center text-[11px] font-semibold leading-tight sm:block",
                  state === "pending" || state === "locked" ? "text-muted" : "text-ink",
                )}
              >
                {step.name}
              </span>
            </div>
          );
        })}
      </div>

      {current && (
        <p className="mt-6 text-center text-sm sm:hidden">
          Paso actual: <strong>{current.step.name}</strong>
        </p>
      )}

      {/* Puertas */}
      <div className="mx-auto mt-10 grid max-w-3xl grid-cols-5 gap-2 border-t border-line/60 pt-8">
        {GATES.map((g) => {
          const status = gateState(scope, g.code);
          const planned = scope
            .map((b) => b.gates.find((x) => x.code === g.code)?.planned_date)
            .filter(Boolean)
            .sort()[0];
          return (
            <div key={g.code} className="flex flex-col items-center gap-2 text-center" title={g.criterion}>
              <GateDiamond status={status} size="lg" />
              <span
                className={cn(
                  "mt-1 w-full truncate text-[9px] font-black tracking-tight sm:text-xs sm:uppercase sm:tracking-wide",
                  status === "superada" ? "text-brand" : "text-ink",
                )}
              >
                {g.name}
              </span>
              <span className="hidden text-[11px] text-muted sm:block">
                {status === "superada" ? GATE_STATUS_LABEL.superada : status === "pendiente" ? day(planned ?? null, "d MMM") : GATE_STATUS_LABEL[status]}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
