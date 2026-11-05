import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { PageTitle } from "@/components/consultor/page-title";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { requireAdmin } from "@/lib/auth";
import { ROLE_LABEL, SPECIALTY_LABEL, type AppRole } from "@/lib/escala";
import { inviteStaff } from "../actions";

export const metadata: Metadata = { title: "Equipo" };

export default async function EquipoPage() {
  const { supabase } = await requireAdmin();
  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, specialty")
    .in("role", ["admin", "especialista"])
    .order("role")
    .order("full_name");

  return (
    <>
      <PageTitle
        eyebrow="Equipo"
        title="Consultores y especialistas"
        description="Los especialistas solo ven las tareas que se les asignan y nunca ven las finanzas."
      />
      <Card className="mb-6">
        <CardTitle>Invitar al equipo</CardTitle>
        <ActionForm action={inviteStaff} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Nombre completo" htmlFor="full_name">
            <Input id="full_name" name="full_name" required />
          </Field>
          <Field label="Correo" htmlFor="email">
            <Input id="email" name="email" type="email" required />
          </Field>
          <Field label="Rol" htmlFor="role">
            <Select id="role" name="role" defaultValue="especialista">
              <option value="especialista">Especialista</option>
              <option value="admin">Consultor (acceso total)</option>
            </Select>
          </Field>
          <Field label="Especialidad" htmlFor="specialty">
            <Select id="specialty" name="specialty" defaultValue="">
              <option value="">—</option>
              {Object.entries(SPECIALTY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit">
              <UserPlus /> Enviar invitación
            </Button>
          </div>
        </ActionForm>
      </Card>

      <Card className="p-0">
        <ul className="divide-y divide-line/60">
          {staff?.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
              <div>
                <p className="font-semibold">{s.full_name}</p>
                <p className="text-sm text-muted">{s.email}</p>
              </div>
              <div className="flex gap-2">
                {s.specialty && <Badge>{SPECIALTY_LABEL[s.specialty]}</Badge>}
                <Badge tone={s.role === "admin" ? "brand" : "neutral"}>{ROLE_LABEL[s.role as AppRole]}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
