"use client";

import { useActionState, useEffect } from "react";
import { Stamp } from "lucide-react";
import { toast } from "sonner";
import { approveMinutes } from "@/app/actions/project";
import { useCelebration } from "@/components/escala/celebration";
import type { ActionResult } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

/** Aprobación digital del acta: nombre completo + conformidad → confeti. */
export function ApproveMinutesForm({
  minutesId,
  projectId,
  gateId,
  gateName,
  defaultName,
  path,
}: {
  minutesId: string;
  projectId: string;
  gateId: string;
  gateName: string;
  defaultName: string;
  path: string;
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(approveMinutes, null);
  const { celebrate } = useCelebration();

  useEffect(() => {
    if (!state) return;
    if (state.ok) celebrate(gateName, gateId);
    else toast.error(state.message ?? "No se pudo aprobar el acta.");
  }, [state, celebrate, gateName, gateId]);

  return (
    <form action={action} className="space-y-4 rounded-3xl border-2 border-brand/30 bg-brand-soft/40 p-5 sm:p-6">
      <input type="hidden" name="minutes_id" value={minutesId} />
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="path" value={path} />
      <div>
        <p className="font-display text-lg font-black">Aprobación del acta</p>
        <p className="text-sm text-muted">
          Al aprobar, quedan registrados tu nombre, la fecha y la hora (La Paz). El paso se cierra y el proyecto avanza a la siguiente letra.
        </p>
      </div>
      <Field label="Nombre completo">
        <Input name="full_name" required defaultValue={defaultName} autoComplete="name" />
      </Field>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="acepto" value="1" required className="mt-1 size-4 accent-[var(--brand)]" />
        <span>
          Leí el acta y apruebo la puerta <strong>{gateName.toUpperCase()}</strong> en nombre de mi empresa.
        </span>
      </label>
      <Button type="submit" size="lg" disabled={pending}>
        <Stamp /> {pending ? "Aprobando…" : "Aprobar acta"}
      </Button>
    </form>
  );
}
