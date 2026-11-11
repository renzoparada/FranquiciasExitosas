"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookText, CalendarRange, FileCheck2, FileText, Grid3x3, Home, Inbox, LineChart, ListChecks, Menu, Stamp, Store, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  home: Home,
  gantt: CalendarRange,
  tasks: ListChecks,
  deliverables: FileCheck2,
  gates: Stamp,
  info: Inbox,
  matrix: Grid3x3,
  competitors: Store,
  finance: LineChart,
  log: BookText,
  fees: Wallet,
  reports: FileText,
  more: Menu,
};
export type TabIcon = keyof typeof ICONS;
export type Tab = { href: string; label: string; icon: TabIcon; badge?: number; exact?: boolean };

function useActive() {
  const path = usePathname();
  return (t: Tab) => (t.exact ? path === t.href : path === t.href || path.startsWith(t.href + "/"));
}

/** Pestañas horizontales (escritorio y consola). */
export function ProjectTabs({ tabs, className }: { tabs: Tab[]; className?: string }) {
  const isActive = useActive();
  return (
    <nav className={cn("flex gap-1 overflow-x-auto", className)} aria-label="Secciones del proyecto">
      {tabs.map((t) => {
        const Icon = ICONS[t.icon];
        const active = isActive(t);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              active ? "bg-ink text-canvas" : "text-muted hover:bg-surface hover:text-ink",
            )}
          >
            <Icon className="size-4" />
            {t.label}
            {!!t.badge && (
              <span className="flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
                {t.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barra inferior fija para el celular (portal del cliente). */
export function BottomNav({ tabs }: { tabs: Tab[] }) {
  const isActive = useActive();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line/60 bg-canvas/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden"
      aria-label="Navegación"
    >
      <div className="grid grid-cols-6">
        {tabs.map((t) => {
          const Icon = ICONS[t.icon];
          const active = isActive(t);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn("relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold", active ? "text-brand" : "text-muted")}
            >
              <Icon className="size-5" />
              {t.label}
              {!!t.badge && <span className="absolute right-[22%] top-1 size-2 rounded-full bg-brand" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
