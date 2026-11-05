"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MAX_MB = 25;

export type UploadTarget = {
  projectId: string;
  brandId?: string | null;
  entityType: string;
  entityId: string;
  visibility?: "interno" | "cliente";
};

/** Sube un archivo a Storage (project-files/<proyecto>/...) y registra su fila en public.files. */
export async function uploadProjectFile(file: File, t: UploadTarget) {
  if (file.size > MAX_MB * 1024 * 1024) throw new Error(`El archivo supera ${MAX_MB} MB.`);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tu sesión venció. Vuelve a ingresar.");
  const safe = file.name.normalize("NFD").replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `${t.projectId}/${t.entityType}/${t.entityId}/${crypto.randomUUID()}-${safe}`;
  const { error: upErr } = await supabase.storage.from("project-files").upload(path, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (upErr) throw new Error(upErr.message);
  const { data, error } = await supabase
    .from("files")
    .insert({
      project_id: t.projectId,
      brand_id: t.brandId ?? null,
      entity_type: t.entityType,
      entity_id: t.entityId,
      bucket: "project-files",
      path,
      name: file.name,
      mime: file.type,
      size: file.size,
      visibility: t.visibility ?? "cliente",
      uploaded_by: user.id,
    })
    .select("id")
    .single();
  if (error) {
    await supabase.storage.from("project-files").remove([path]);
    throw new Error(error.message);
  }
  return data.id as string;
}

export function FileUploader({
  target,
  label = "Adjuntar archivos",
  canChooseVisibility = false,
  compact = false,
}: {
  target: UploadTarget;
  label?: string;
  canChooseVisibility?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [visibility, setVisibility] = useState<"interno" | "cliente">(target.visibility ?? "cliente");

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) await uploadProjectFile(f, { ...target, visibility });
      toast.success(files.length === 1 ? "Archivo subido." : `${files.length} archivos subidos.`);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handle(e.dataTransfer.files);
        }}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
        className={cn(
          "flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm font-medium transition-colors",
          compact ? "px-3 py-2.5" : "px-4 py-6",
          drag ? "border-brand bg-brand-soft text-brand" : "border-line text-muted hover:border-brand/50 hover:text-ink",
          busy && "pointer-events-none opacity-60",
        )}
      >
        {compact ? <Paperclip className="size-4" /> : <Upload className="size-5" />}
        {busy ? "Subiendo…" : label}
        <input ref={input} type="file" multiple hidden onChange={(e) => handle(e.target.files)} />
      </div>
      {canChooseVisibility && (
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={visibility === "interno"}
            onChange={(e) => setVisibility(e.target.checked ? "interno" : "cliente")}
            className="accent-[var(--brand)]"
          />
          Archivo interno (el cliente no lo ve)
        </label>
      )}
    </div>
  );
}
