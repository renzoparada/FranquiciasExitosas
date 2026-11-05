"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Building2, FolderKanban, PlusCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/consultor", label: "Cartera", icon: FolderKanban, exact: true },
  { href: "/consultor/clientes", label: "Clientes", icon: Building2 },
  { href: "/consultor/proyectos/nuevo", label: "Nuevo proyecto", icon: PlusCircle, admin: true },
  { href: "/consultor/equipo", label: "Equipo", icon: Users, admin: true },
  { href: "/consultor/plantilla", label: "Plantilla ESCALA", icon: BookOpen },
];

export function ConsultorNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
      {items
        .filter((i) => isAdmin || !i.admin)
        .map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? path === href : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-ink text-canvas" : "text-muted hover:bg-surface hover:text-ink",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
    </nav>
  );
}
