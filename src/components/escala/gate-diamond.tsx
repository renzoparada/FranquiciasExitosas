import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GateStatus } from "@/lib/escala";

const sizes = { sm: "size-3", md: "size-5", lg: "size-8" } as const;

/** Puerta de decisión: rombo rojo. */
export function GateDiamond({ status, size = "md", className }: { status: GateStatus; size?: keyof typeof sizes; className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 rotate-45 items-center justify-center rounded-[3px] border-2 transition-colors duration-500",
        sizes[size],
        status === "superada" && "border-brand bg-brand",
        status === "acta_enviada" && "border-brand bg-brand-soft animate-escala-pulse",
        status === "observada" && "border-warn bg-warn/20",
        status === "pendiente" && "border-line bg-surface",
        className,
      )}
      aria-label={status}
    >
      {status === "superada" && size !== "sm" && <Check className="size-[70%] -rotate-45 text-brand-ink" strokeWidth={3} />}
    </span>
  );
}
