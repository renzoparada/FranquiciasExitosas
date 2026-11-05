import type { Metadata } from "next";
import { Building2, UserPlus } from "lucide-react";
import { PageTitle } from "@/components/consultor/page-title";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { requireStaff } from "@/lib/auth";
import { createClientAction, inviteClientUser, updateClientLogo } from "../actions";

export const metadata: Metadata = { title: "Clientes" };

type Member = { is_primary: boolean; profiles: { full_name: string | null; email: string } | null };

export default async function ClientesPage() {
  const { supabase, profile } = await requireStaff();
  const isAdmin = profile.role === "admin";
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, legal_name, nit, city, logo_url, client_members(is_primary, profiles(full_name, email)), projects(id, name)")
    .order("name");

  return (
    <>
      <PageTitle eyebrow="Clientes" title="Clientes" description="Empresas, sus usuarios con acceso al portal y su logo." />

      {isAdmin && (
        <Card className="mb-6">
          <CardTitle>Nuevo cliente</CardTitle>
          <ActionForm action={createClientAction} className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Nombre comercial" htmlFor="name">
              <Input id="name" name="name" required placeholder="Ej.: Kfresas y Vaca Lechera" />
            </Field>
            <Field label="Razón social" htmlFor="legal_name">
              <Input id="legal_name" name="legal_name" />
            </Field>
            <Field label="NIT" htmlFor="nit">
              <Input id="nit" name="nit" />
            </Field>
            <Field label="Ciudad" htmlFor="city">
              <Input id="city" name="city" placeholder="Santa Cruz de la Sierra" />
            </Field>
            <Field label="Logo (opcional)" htmlFor="logo" hint="PNG o SVG, menos de 2 MB. Se muestra junto al de Franquicias Exitosas.">
              <Input id="logo" name="logo" type="file" accept="image/*" className="py-2" />
            </Field>
            <div className="flex items-end">
              <Button type="submit">Crear cliente</Button>
            </div>
          </ActionForm>
        </Card>
      )}

      <div className="space-y-4">
        {clients?.map((c) => {
          const members = (c.client_members ?? []) as unknown as Member[];
          return (
            <Card key={c.id}>
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-surface-2">
                  {c.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.logo_url} alt={c.name} className="size-full object-contain p-1.5" />
                  ) : (
                    <Building2 className="size-6 text-muted" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-extrabold">{c.name}</p>
                  <p className="text-sm text-muted">{[c.legal_name, c.nit && `NIT ${c.nit}`, c.city].filter(Boolean).join(" · ") || "Sin datos fiscales"}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(c.projects ?? []).map((p: { id: string; name: string }) => (
                      <Badge key={p.id} tone="brand">{p.name}</Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-6 border-t border-line/60 pt-5 lg:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Usuarios del portal</p>
                  {members.length ? (
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {members.map((m, i) => (
                        <li key={i}>
                          <span className="font-semibold">{m.profiles?.full_name}</span>{" "}
                          <span className="text-muted">{m.profiles?.email}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted">Nadie del cliente tiene acceso todavía.</p>
                  )}
                </div>
                {isAdmin && (
                  <div className="space-y-4">
                    <ActionForm action={inviteClientUser} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <input type="hidden" name="client_id" value={c.id} />
                      <Input name="full_name" placeholder="Nombre completo" required aria-label="Nombre completo" />
                      <Input name="email" type="email" placeholder="correo@cliente.com" required aria-label="Correo" />
                      <Button type="submit" variant="dark">
                        <UserPlus /> Invitar
                      </Button>
                    </ActionForm>
                    <ActionForm action={updateClientLogo} className="flex gap-2">
                      <input type="hidden" name="client_id" value={c.id} />
                      <Input name="logo" type="file" accept="image/*" className="py-2" aria-label="Logo" />
                      <Button type="submit" variant="outline">Cambiar logo</Button>
                    </ActionForm>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
