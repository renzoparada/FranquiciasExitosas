"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

export type ActionResult = { ok: boolean; message?: string } | null;

/**
 * Formulario que llama a una Server Action y muestra el resultado como aviso.
 * Se envía con onSubmit (no con la prop `action`) para que React no vacíe los
 * campos cuando la acción devuelve un error: el usuario corrige y reenvía.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = true,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (state.message) toast.success(state.message);
      if (resetOnSuccess) ref.current?.reset();
    } else {
      toast.error(state.message ?? "No se pudo guardar.");
    }
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      className={className}
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const fd = new FormData(e.currentTarget, submitter);
        startTransition(() => formAction(fd));
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
