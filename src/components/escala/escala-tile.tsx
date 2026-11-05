import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LetterState } from "@/lib/escala";

const sizes = {
  xs: "size-5 rounded-[5px] text-[11px]",
  sm: "size-7 rounded-md text-sm",
  md: "size-10 rounded-lg text-xl",
  lg: "size-14 rounded-xl text-3xl sm:size-16 sm:text-4xl",
  xl: "size-[3.25rem] rounded-xl text-[2rem] sm:size-24 sm:rounded-2xl sm:text-6xl lg:size-28 lg:text-7xl",
} as const;

/** Ficha cuadrada roja con la letra ESCALA en blanco. */
export function EscalaTile({
  letter,
  state = "done",
  size = "sm",
  className,
  title,
}: {
  letter: string;
  state?: LetterState;
  size?: keyof typeof sizes;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center font-display font-black leading-none transition-colors duration-500",
        sizes[size],
        state === "done" && "bg-brand text-brand-ink",
        state === "current" && "bg-brand text-brand-ink animate-escala-pulse",
        (state === "pending" || state === "locked") && "bg-pending-tile text-pending-ink",
        className,
      )}
    >
      {letter}
      {state === "locked" && (
        <Lock className="absolute -right-1 -top-1 size-4 rounded-full bg-ink p-0.5 text-canvas" aria-label="Bloqueado" />
      )}
    </span>
  );
}
