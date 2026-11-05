"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();
    const redirect = new URL("/auth/callback", window.location.origin);
    if (next?.startsWith("/")) redirect.searchParams.set("next", next);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      // Solo entran usuarios invitados por el consultor.
      options: { shouldCreateUser: false, emailRedirectTo: redirect.toString() },
    });
    if (error) {
      setState("error");
      setMessage(
        error.message.toLowerCase().includes("signups not allowed") || error.status === 422
          ? "Este correo no tiene acceso al portal. Consulta a tu consultor."
          : "No pudimos enviar el enlace. Intenta de nuevo en un minuto.",
      );
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="mt-6 flex items-start gap-3 rounded-2xl bg-surface-2 p-4">
        <MailCheck className="mt-0.5 size-5 text-brand" />
        <div className="text-sm">
          <p className="font-semibold">Revisa tu correo</p>
          <p className="text-muted">
            Enviamos un enlace de acceso a <strong className="text-ink">{email}</strong>. Ábrelo desde este dispositivo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {state === "error" && <p className="text-sm text-brand">{message}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={state === "sending"}>
        {state === "sending" ? "Enviando…" : "Enviarme el enlace"}
      </Button>
    </form>
  );
}
