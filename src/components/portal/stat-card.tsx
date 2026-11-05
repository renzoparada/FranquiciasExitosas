import { cn } from "@/lib/utils";

export function StatCard({
  icon,
  value,
  label,
  hint,
  accent = false,
  delay = 0,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  hint?: string;
  accent?: boolean;
  delay?: number;
}) {
  return (
    <div
      className={cn(
        "animate-rise rounded-3xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        accent ? "bg-brand text-brand-ink" : "bg-surface",
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={cn("flex size-9 items-center justify-center rounded-xl", accent ? "bg-white/15" : "bg-surface-2 text-brand")}>
        {icon}
      </div>
      <div className="font-display mt-4 text-4xl font-black tabular-nums">{value}</div>
      <div className="mt-1 text-sm font-semibold">{label}</div>
      {hint && <div className={cn("mt-0.5 text-xs", accent ? "text-white/75" : "text-muted")}>{hint}</div>}
    </div>
  );
}
