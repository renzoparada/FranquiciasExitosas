"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { addDays, differenceInCalendarDays, format, parseISO, startOfMonth, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { updateStepDates } from "@/app/actions/project";
import { EscalaTile } from "@/components/escala/escala-tile";
import { GateDiamond } from "@/components/escala/gate-diamond";
import { GATES, PILLARS, STEPS, STEP_STATUS_LABEL, type StepCode } from "@/lib/escala";
import { cn } from "@/lib/utils";

type Step = {
  id: string;
  brand_id: string;
  step_code: StepCode;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: "pendiente" | "en_curso" | "en_revision" | "cerrado";
};
type Gate = { id: string; brand_id: string; gate_code: string; planned_date: string | null; status: "pendiente" | "acta_enviada" | "observada" | "superada" };

const ROW = 44;
const LABEL_W = 176;
const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function GanttChart({
  brands,
  steps: initialSteps,
  gates,
  today,
  editable,
  path,
}: {
  brands: { id: string; name: string }[];
  steps: Step[];
  gates: Gate[];
  today: string;
  editable: boolean;
  path: string;
}) {
  const [steps, setSteps] = useState(initialSteps);
  const [pxDay, setPxDay] = useState(7);
  const [, start] = useTransition();
  const drag = useRef<{ id: string; mode: "move" | "resize"; x0: number; s0: string; e0: string } | null>(null);
  const [preview, setPreview] = useState<{ id: string; s: string; e: string } | null>(null);

  // Rango visible: desde el primer inicio (o hoy) hasta la última fecha + margen.
  const { origin, days } = useMemo(() => {
    const dates = [
      today,
      ...steps.flatMap((s) => [s.planned_start, s.planned_end, s.actual_start, s.actual_end]),
      ...gates.map((g) => g.planned_date),
    ].filter(Boolean) as string[];
    const min = startOfMonth(parseISO(dates.reduce((a, b) => (a < b ? a : b))));
    const max = addDays(parseISO(dates.reduce((a, b) => (a > b ? a : b))), 21);
    return { origin: min, days: differenceInCalendarDays(max, min) + 1 };
  }, [steps, gates, today]);

  const x = (d: string) => differenceInCalendarDays(parseISO(d), origin) * pxDay;
  const width = days * pxDay;
  const todayX = x(today);

  const months: { label: string; left: number }[] = [];
  for (let m = origin; differenceInCalendarDays(m, origin) < days; m = addMonths(m, 1)) {
    months.push({ label: format(m, "MMM yyyy", { locale: es }), left: differenceInCalendarDays(m, origin) * pxDay });
  }
  const weeks = Array.from({ length: Math.ceil(days / 7) }, (_, i) => i * 7 * pxDay);

  function onPointerDown(e: React.PointerEvent, s: Step, mode: "move" | "resize") {
    if (!editable || !s.planned_start || !s.planned_end) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: s.id, mode, x0: e.clientX, s0: s.planned_start, e0: s.planned_end };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const delta = Math.round((e.clientX - d.x0) / pxDay);
    const s = d.mode === "move" ? iso(addDays(parseISO(d.s0), delta)) : d.s0;
    let en = iso(addDays(parseISO(d.e0), delta));
    if (en < s) en = s;
    setPreview({ id: d.id, s, e: en });
  }
  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d || !preview || preview.id !== d.id || (preview.s === d.s0 && preview.e === d.e0)) {
      setPreview(null);
      return;
    }
    const p = preview;
    setSteps((all) => all.map((s) => (s.id === p.id ? { ...s, planned_start: p.s, planned_end: p.e } : s)));
    setPreview(null);
    start(async () => {
      const r = await updateStepDates(p.id, p.s, p.e, path);
      if (!r?.ok) {
        toast.error(r?.message ?? "No se pudo mover la barra.");
        setSteps((all) => all.map((s) => (s.id === p.id ? { ...s, planned_start: d.s0, planned_end: d.e0 } : s)));
      } else toast.success(`${format(parseISO(p.s), "d MMM", { locale: es })} – ${format(parseISO(p.e), "d MMM yyyy", { locale: es })}`);
    });
  }

  return (
    <div className="rounded-3xl bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {/* Leyenda y zoom */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 px-5 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          {Object.values(PILLARS).map((p) => (
            <span key={p.name} className="flex items-center gap-1.5">
              <span className="h-2.5 w-5 rounded-full" style={{ background: p.color }} /> {p.name}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-5 rounded-full bg-ok" /> Real
          </span>
          <span className="flex items-center gap-1.5">
            <GateDiamond status="pendiente" size="sm" /> Puerta
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 bg-brand" /> Hoy
          </span>
        </div>
        <div className="flex items-center gap-1">
          {editable && <span className="mr-2 hidden text-muted md:inline">Arrastra una barra para moverla o su borde derecho para alargarla.</span>}
          <button className="rounded-full p-1.5 hover:bg-surface-2" onClick={() => setPxDay((p) => Math.max(3, p - 2))} aria-label="Alejar">
            <ZoomOut className="size-4" />
          </button>
          <button className="rounded-full p-1.5 hover:bg-surface-2" onClick={() => setPxDay((p) => Math.min(18, p + 2))} aria-label="Acercar">
            <ZoomIn className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex overflow-hidden rounded-b-3xl">
        {/* Etiquetas */}
        <div className="shrink-0 border-r border-line/60 bg-surface" style={{ width: LABEL_W }}>
          <div className="h-12 border-b border-line/60" />
          {brands.map((b) => (
            <div key={b.id}>
              <div className="flex h-9 items-center bg-surface-2 px-4 text-xs font-black uppercase tracking-wide">{b.name}</div>
              {STEPS.map((st) => (
                <div key={st.code} className="flex items-center gap-2 px-3" style={{ height: ROW }}>
                  <EscalaTile letter={st.letter} size="xs" />
                  <span className="truncate text-xs font-medium">{st.name}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Línea de tiempo */}
        <div className="min-w-0 flex-1 overflow-x-auto" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <div className="relative" style={{ width }}>
            {/* Encabezado de meses y semanas */}
            <div className="sticky top-0 h-12 border-b border-line/60 bg-surface">
              {months.map((m) => (
                <span key={m.left} className="absolute top-2 border-l border-line pl-1.5 text-[11px] font-semibold capitalize text-muted" style={{ left: m.left }}>
                  {m.label}
                </span>
              ))}
              {weeks.map((w) => (
                <span key={w} className="absolute bottom-0 h-2 border-l border-line/70" style={{ left: w }} />
              ))}
            </div>

            {/* Cuadrícula semanal */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 top-12">
              {weeks.map((w) => (
                <span key={w} className="absolute inset-y-0 border-l border-line/30" style={{ left: w }} />
              ))}
            </div>

            {brands.map((b) => (
              <div key={b.id} className="relative">
                <div className="h-9 bg-surface-2/70" />
                {STEPS.map((st) => {
                  const s0 = steps.find((s) => s.brand_id === b.id && s.step_code === st.code);
                  if (!s0) return <div key={st.code} style={{ height: ROW }} />;
                  const pv = preview?.id === s0.id ? preview : null;
                  const ps = pv?.s ?? s0.planned_start;
                  const pe = pv?.e ?? s0.planned_end;
                  const gateDef = GATES.find((g) => g.step === st.code);
                  const gate = gateDef && gates.find((g) => g.brand_id === b.id && g.gate_code === gateDef.code);
                  const late = s0.status !== "cerrado" && pe && today > pe;
                  const lateDays = late && pe ? differenceInCalendarDays(parseISO(today), parseISO(pe)) : 0;
                  const overrun = s0.status === "cerrado" && s0.actual_end && pe && s0.actual_end > pe
                    ? differenceInCalendarDays(parseISO(s0.actual_end), parseISO(pe))
                    : 0;
                  const actualEnd = s0.actual_end ?? (s0.actual_start && s0.status !== "pendiente" ? today : null);
                  const color = PILLARS[st.pillar].color;
                  return (
                    <div key={st.code} className="relative" style={{ height: ROW }}>
                      {ps && pe ? (
                        <>
                          <div
                            title={`${st.name} · ${STEP_STATUS_LABEL[s0.status]} · ${ps} → ${pe}`}
                            onPointerDown={(e) => onPointerDown(e, s0, "move")}
                            className={cn(
                              "group absolute top-2 flex h-6 items-center gap-1.5 overflow-hidden rounded-full pl-1 pr-3 text-[11px] font-bold text-white shadow-sm transition-[box-shadow]",
                              editable && "cursor-grab active:cursor-grabbing",
                              s0.status === "pendiente" && "opacity-55",
                              late && "ring-2 ring-brand ring-offset-1 ring-offset-surface",
                            )}
                            style={{ left: x(ps), width: Math.max(pxDay, x(pe) - x(ps) + pxDay), background: color }}
                          >
                            <span className="flex size-4 shrink-0 items-center justify-center rounded bg-white/20 text-[10px] font-black">{st.letter}</span>
                            <span className="truncate">{s0.status === "cerrado" ? "Cerrado" : STEP_STATUS_LABEL[s0.status]}</span>
                            {editable && (
                              <span
                                onPointerDown={(e) => onPointerDown(e, s0, "resize")}
                                className="absolute inset-y-0 right-0 w-2.5 cursor-ew-resize bg-white/0 hover:bg-white/30"
                                aria-label="Cambiar fin"
                              />
                            )}
                          </div>
                          {s0.actual_start && actualEnd && (
                            <div
                              className="absolute top-[34px] h-1.5 rounded-full bg-ok"
                              style={{ left: x(s0.actual_start), width: Math.max(pxDay, x(actualEnd) - x(s0.actual_start) + pxDay) }}
                              title={`Real: ${s0.actual_start} → ${s0.actual_end ?? "en curso"}`}
                            />
                          )}
                          {(late || overrun > 0) && (
                            <span
                              className="absolute top-2.5 flex items-center gap-1 whitespace-nowrap text-[10px] font-bold text-brand"
                              style={{ left: x(pe) + pxDay + 18 }}
                            >
                              <AlertTriangle className="size-3" /> {late ? `${lateDays} d de retraso` : `+${overrun} d`}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="absolute left-3 top-3 text-[11px] italic text-muted">
                          {st.code === "L" || st.code === "A2" ? "Inicia con la 1.ª apertura" : "Sin fechas"}
                        </span>
                      )}
                      {gate?.planned_date && gateDef && (
                        <span className="absolute top-2.5" style={{ left: x(pv?.e ?? gate.planned_date) + pxDay + 2 }} title={`Puerta ${gateDef.name.toUpperCase()}`}>
                          <GateDiamond status={gate.status} size="md" />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Hoy */}
            {todayX >= 0 && todayX <= width && (
              <div className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-brand" style={{ left: todayX + pxDay / 2 }}>
                <span className="absolute -left-4 top-12 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">Hoy</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
