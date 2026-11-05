import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EscalaTile } from "@/components/escala/escala-tile";
import { BrandLockup } from "@/components/escala/brand-lockup";
import { getSession, homeFor } from "@/lib/auth";
import { LEMA } from "@/lib/escala";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { profile } = await getSession();
  if (profile) redirect(homeFor(profile.role));
  const { next, error } = await props.searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <BrandLockup className="justify-center" />
        <div className="mt-10 flex justify-center gap-1.5 sm:gap-2" aria-hidden>
          {["E", "S", "C", "A", "L", "A"].map((l, i) => (
            <EscalaTile key={i} letter={l} size="lg" state="done" className="animate-rise" />
          ))}
        </div>
        <p className="mt-4 text-center text-sm font-medium text-muted">{LEMA}</p>

        <div className="mt-10 rounded-3xl bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-8">
          <h1 className="font-display text-2xl font-black">Portal ESCALA</h1>
          <p className="mt-1 text-sm text-muted">
            Te enviaremos un enlace de acceso a tu correo. Sin contraseñas.
          </p>
          {error && (
            <p className="mt-4 rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand">
              El enlace no es válido o ya venció. Pide uno nuevo.
            </p>
          )}
          <LoginForm next={typeof next === "string" ? next : undefined} />
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          ¿No tienes acceso? Pídeselo a tu consultor de Franquicias Exitosas.
        </p>
      </div>
    </main>
  );
}
