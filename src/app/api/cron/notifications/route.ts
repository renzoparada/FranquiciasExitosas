import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { digestHtml, sendEmail } from "@/lib/email/send";

/**
 * Cron diario (Vercel Cron, ver vercel.json):
 * 1) genera avisos por fecha (tareas vencidas, puerta próxima, cuota por vencer, información pendiente);
 * 2) envía por correo un resumen de los avisos aún no enviados a quien tenga activado el correo.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: created, error } = await admin.rpc("generate_due_notifications");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const since = new Date(Date.now() - 3 * 864e5).toISOString();
  const { data: pending } = await admin
    .from("notifications")
    .select("id, user_id, title, body, link, profiles!inner(email, full_name, notify_email)")
    .is("emailed_at", null)
    .is("read_at", null)
    .gte("created_at", since)
    .order("created_at");

  const byUser = new Map<string, { email: string; name: string; items: { id: string; title: string; body: string | null; link: string | null }[] }>();
  for (const n of pending ?? []) {
    const p = n.profiles as unknown as { email: string; full_name: string | null; notify_email: boolean };
    if (!p.notify_email) continue;
    const u = byUser.get(n.user_id) ?? { email: p.email, name: p.full_name?.split(" ")[0] ?? "", items: [] };
    u.items.push({ id: n.id, title: n.title, body: n.body, link: n.link });
    byUser.set(n.user_id, u);
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  let sent = 0;
  let skipped = 0;
  for (const u of byUser.values()) {
    const subject = u.items.length === 1 ? `Portal ESCALA · ${u.items[0].title}` : `Portal ESCALA · ${u.items.length} avisos nuevos`;
    const r = await sendEmail(u.email, subject, digestHtml(u.name, u.items.slice(0, 15), site));
    if (r.skipped) {
      skipped++;
      continue;
    }
    if (r.ok) {
      sent++;
      await admin.from("notifications").update({ emailed_at: new Date().toISOString() }).in("id", u.items.map((i) => i.id));
    }
  }
  return NextResponse.json({ created, recipients: byUser.size, sent, skipped_without_email_provider: skipped });
}
