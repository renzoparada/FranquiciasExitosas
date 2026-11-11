import "server-only";

/** Envío de correo con Resend (API REST). Sin RESEND_API_KEY no se envía nada. */
export async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false as const, skipped: true as const };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  return { ok: res.ok, skipped: false as const, status: res.status };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Resumen de avisos con la marca Franquicias Exitosas. */
export function digestHtml(name: string, items: { title: string; body: string | null; link: string | null }[], siteUrl: string) {
  const rows = items
    .map(
      (n) => `<tr><td style="padding:12px 0;border-bottom:1px solid #eee">
        <div style="font-weight:700;color:#1D1D1F">${esc(n.title)}</div>
        ${n.body ? `<div style="color:#6E6E73;font-size:14px;margin-top:2px">${esc(n.body)}</div>` : ""}
        ${n.link ? `<a href="${siteUrl}${n.link}" style="color:#E30613;font-size:13px;font-weight:600;text-decoration:none">Ver en el portal →</a>` : ""}
      </td></tr>`,
    )
    .join("");
  const tiles = ["E", "S", "C", "A", "L", "A"]
    .map((l) => `<span style="display:inline-block;width:22px;height:22px;line-height:22px;margin-right:3px;background:#E30613;color:#fff;font-weight:900;text-align:center;border-radius:4px;font-family:Arial">${l}</span>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#F5F5F7;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;padding:28px">
    <tr><td><div style="font-weight:900;font-size:16px;color:#1D1D1F">Franquicias Exitosas</div><div style="color:#6E6E73;font-size:12px">Método ESCALA®</div>
    <div style="margin:18px 0 6px">${tiles}</div>
    <h1 style="font-size:20px;color:#1D1D1F;margin:12px 0 4px">Hola ${esc(name)}, tienes ${items.length} ${items.length === 1 ? "aviso nuevo" : "avisos nuevos"}</h1></td></tr>
    <tr><td><table width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
    <tr><td style="padding-top:18px;color:#6E6E73;font-size:12px">Recibes este correo porque participas en un proyecto del Portal ESCALA.</td></tr>
  </table></td></tr></table></body></html>`;
}
