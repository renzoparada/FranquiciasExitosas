import type { Metadata } from "next";
import Link from "next/link";
import { BookText, ChevronRight, FileText, Grid3x3, ListChecks, Wallet } from "lucide-react";

export const metadata: Metadata = { title: "Más" };

export default async function Page(props: PageProps<"/portal/[projectId]/mas">) {
  const { projectId } = await props.params;
  const base = `/portal/${projectId}`;
  const items = [
    { href: `${base}/tareas`, label: "Tareas", sub: "Kanban, lista y calendario", icon: ListChecks },
    { href: `${base}/diagnostico`, label: "Diagnóstico y modelo", sub: "Matriz, competidores y modelo financiero", icon: Grid3x3 },
    { href: `${base}/reuniones`, label: "Reuniones y decisiones", sub: "Próximas reuniones, minutas y acuerdos", icon: BookText },
    { href: `${base}/informes`, label: "Informes quincenales", sub: "PDF de una página", icon: FileText },
    { href: `${base}/estado-de-cuenta`, label: "Estado de cuenta", sub: "Cuotas y fees", icon: Wallet },
  ];
  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <h1 className="font-display mb-4 text-2xl font-black">Más</h1>
      <ul className="divide-y divide-line/60 overflow-hidden rounded-3xl bg-surface">
        {items.map(({ href, label, sub, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-2">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon className="size-5" /></span>
              <span className="min-w-0 flex-1"><span className="block font-semibold">{label}</span><span className="block text-xs text-muted">{sub}</span></span>
              <ChevronRight className="size-4 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
