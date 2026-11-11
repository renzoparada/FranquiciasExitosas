import { cn } from "@/lib/utils";

const STYLE: Record<string, string> = {
  comprobado: "bg-ok/10 text-ok border-ok/20",
  estimacion: "bg-warn/10 text-warn border-warn/30",
  supuesto: "bg-surface-2 text-muted border-line",
};
const TEXT: Record<string, string> = { comprobado: "Dato comprobado", estimacion: "Estimación", supuesto: "Supuesto" };

/** Regla 1: toda cifra muestra su etiqueta; sin cifra → [POR CONFIRMAR]. */
export function DataLabelBadge({ label, empty = false, className }: { label: string | null | undefined; empty?: boolean; className?: string }) {
  if (empty || !label) {
    return <span className={cn("inline-flex rounded-full border border-dashed border-brand/40 px-2 py-0.5 text-[10px] font-bold text-brand", className)}>[POR CONFIRMAR]</span>;
  }
  return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold", STYLE[label], className)}>{TEXT[label] ?? label}</span>;
}

export function LabelSelect({ name, defaultValue, className }: { name: string; defaultValue?: string | null; className?: string }) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      aria-label="Etiqueta del dato"
      className={cn("h-9 rounded-lg border border-line bg-surface px-2 text-xs text-ink focus:border-brand focus:outline-none", className)}
    >
      <option value="">Etiqueta…</option>
      <option value="comprobado">Dato comprobado</option>
      <option value="estimacion">Estimación</option>
      <option value="supuesto">Supuesto</option>
    </select>
  );
}
