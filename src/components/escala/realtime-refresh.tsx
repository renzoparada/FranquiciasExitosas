"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCelebration } from "./celebration";
import { GATES } from "@/lib/escala";

const TABLES = ["tasks", "deliverables", "brand_steps", "brand_gates", "gate_minutes", "activity_feed", "info_requests"];

/**
 * Escucha cambios en tiempo real (Supabase Realtime respeta RLS) y refresca la
 * página. Si una puerta pasa a "superada", lanza la celebración.
 */
export function RealtimeRefresh({ projectId, brandIds }: { projectId: string; brandIds: string[] }) {
  const router = useRouter();
  const { celebrate } = useCelebration();
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => router.refresh(), 400);
    };
    const channel = supabase.channel(`project-${projectId}`);
    for (const table of TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        const row = (payload.new ?? {}) as Record<string, unknown>;
        if ("project_id" in row && row.project_id !== projectId) return;
        if ("brand_id" in row && !brandIds.includes(String(row.brand_id))) return;
        if (table === "brand_gates" && row.status === "superada" && (payload.old as Record<string, unknown>)?.status !== "superada") {
          const gate = GATES.find((g) => g.code === row.gate_code);
          if (gate) celebrate(gate.name, String(row.id));
        }
        refresh();
      });
    }
    channel.subscribe();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [projectId, brandIds, router, celebrate]);

  return null;
}
