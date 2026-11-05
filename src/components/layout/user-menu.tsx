import { LogOut } from "lucide-react";
import { ROLE_LABEL, type AppRole } from "@/lib/escala";

export function UserMenu({ name, email, role }: { name: string | null; email: string; role: AppRole }) {
  const initials = (name ?? email)
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-ink text-xs font-bold text-canvas">{initials}</span>
        <span className="hidden text-left text-xs leading-tight sm:block">
          <span className="block font-semibold">{name ?? email}</span>
          <span className="block text-muted">{ROLE_LABEL[role]}</span>
        </span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-60 rounded-2xl border border-line bg-surface p-2 shadow-xl">
        <div className="px-3 py-2 text-xs text-muted">{email}</div>
        <form action="/auth/signout" method="post">
          <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-surface-2">
            <LogOut className="size-4" /> Cerrar sesión
          </button>
        </form>
      </div>
    </details>
  );
}
