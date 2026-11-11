"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { markNotificationsRead } from "@/app/actions/analysis";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type Notice = { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string; type: string };

function ago(ts: string) {
  const m = Math.round((Date.now() - Date.parse(ts)) / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

/** Campana de avisos en la app (tiempo real con Supabase Realtime). */
export function NotificationBell({ userId, initial }: { userId: string; initial: Notice[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => !n.read_at).length;

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`notif-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (p) =>
        setItems((all) => [p.new as Notice, ...all].slice(0, 20)),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function read(ids?: string[]) {
    const now = new Date().toISOString();
    setItems((all) => all.map((n) => (!ids || ids.includes(n.id) ? { ...n, read_at: n.read_at ?? now } : n)));
    start(() => markNotificationsRead(ids));
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        aria-label={`Notificaciones${unread ? `: ${unread} sin leer` : ""}`}
        aria-expanded={open}
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-16 z-40 rounded-2xl border border-line bg-surface shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-96">
          <div className="flex items-center justify-between border-b border-line/60 px-4 py-3">
            <p className="font-display font-black">Avisos</p>
            {unread > 0 && (
              <button onClick={() => read()} className="flex items-center gap-1 text-xs font-semibold text-brand">
                <CheckCheck className="size-3.5" /> Marcar todo como leído
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto py-1">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => {
                    read([n.id]);
                    setOpen(false);
                    if (n.link) router.push(n.link);
                  }}
                  className={cn("flex w-full gap-3 px-4 py-2.5 text-left hover:bg-surface-2", !n.read_at && "bg-brand-soft/40")}
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-brand")} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{n.title}</span>
                    {n.body && <span className="line-clamp-2 block text-xs text-muted">{n.body}</span>}
                    <span className="block text-[11px] text-muted">{ago(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
            {!items.length && <li className="px-4 py-8 text-center text-sm text-muted">No tienes avisos.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
