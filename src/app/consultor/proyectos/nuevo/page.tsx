import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/consultor/page-title";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { todayLaPaz } from "@/lib/format";
import { NewProjectForm } from "./new-project-form";

export const metadata: Metadata = { title: "Nuevo proyecto" };

export default async function NuevoProyectoPage() {
  const { supabase } = await requireAdmin();
  const { data: clients } = await supabase.from("clients").select("id, name").order("name");

  return (
    <>
      <PageTitle
        eyebrow="Nuevo proyecto"
        title="Crear desde la plantilla ESCALA"
        description="Se copian los 6 pasos, las 5 puertas, las tareas, los entregables y la información a solicitar para cada marca, con fechas calculadas."
      />
      {!clients?.length ? (
        <Card className="text-sm">
          Primero crea el cliente en{" "}
          <Link href="/consultor/clientes" className="font-semibold text-brand">
            Clientes
          </Link>
          .
        </Card>
      ) : (
        <NewProjectForm clients={clients} today={todayLaPaz()} />
      )}
    </>
  );
}
