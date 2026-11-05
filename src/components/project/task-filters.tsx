"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Columns3, List } from "lucide-react";
import { Select } from "@/components/ui/form";
import { STEPS } from "@/lib/escala";
import { cn } from "@/lib/utils";

export function TaskFilters({
  brands,
  people,
  showPeople,
}: {
  brands: { id: string; name: string }[];
  people: { id: string; full_name: string | null; email: string }[];
  showPeople: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const vista = sp.get("vista") ?? "kanban";

  function set(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const views = [
    { id: "kanban", label: "Kanban", icon: Columns3 },
    { id: "lista", label: "Lista", icon: List },
    { id: "calendario", label: "Calendario", icon: CalendarDays },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-full border border-line bg-surface p-1">
        {views.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => set("vista", id === "kanban" ? "" : id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
              vista === id ? "bg-ink text-canvas" : "text-muted hover:text-ink",
            )}
          >
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>
      {brands.length > 1 && (
        <Select className="h-9 w-auto py-1 text-xs" value={sp.get("marca") ?? ""} onChange={(e) => set("marca", e.target.value)} aria-label="Marca">
          <option value="">Todas las marcas</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </Select>
      )}
      <Select className="h-9 w-auto py-1 text-xs" value={sp.get("letra") ?? ""} onChange={(e) => set("letra", e.target.value)} aria-label="Letra ESCALA">
        <option value="">Todas las letras</option>
        {STEPS.map((s) => (
          <option key={s.code} value={s.code}>{s.letter} · {s.name}</option>
        ))}
      </Select>
      {showPeople && (
        <Select className="h-9 w-auto py-1 text-xs" value={sp.get("responsable") ?? ""} onChange={(e) => set("responsable", e.target.value)} aria-label="Responsable">
          <option value="">Todos los responsables</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
          ))}
        </Select>
      )}
      <label className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3 text-xs font-semibold">
        <input
          type="checkbox"
          checked={sp.get("vencidas") === "1"}
          onChange={(e) => set("vencidas", e.target.checked ? "1" : "")}
          className="accent-[var(--brand)]"
        />
        Solo vencidas
      </label>
    </div>
  );
}
