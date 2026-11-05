"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/client";
import { uploadProjectFile } from "./file-uploader";

/** El consultor sube una nueva versión (archivo + notas) de un entregable. */
export function VersionUploader({
  projectId,
  brandId,
  deliverableId,
  nextVersion,
}: {
  projectId: string;
  brandId: string;
  deliverableId: string;
  nextVersion: number;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Elige el archivo de la versión.");
    setBusy(true);
    const supabase = createClient();
    try {
      const { data: v, error } = await supabase
        .from("deliverable_versions")
        .insert({ deliverable_id: deliverableId, version: nextVersion, notes: notes || null })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const fileId = await uploadProjectFile(file, {
        projectId,
        brandId,
        entityType: "deliverable_version",
        entityId: v.id,
        visibility: "cliente",
      });
      const { error: e2 } = await supabase.from("deliverable_versions").update({ file_id: fileId }).eq("id", v.id);
      if (e2) throw new Error(e2.message);
      toast.success(`Versión ${nextVersion} cargada. Ahora puedes enviarla al cliente.`);
      setNotes("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <Input ref={fileRef} type="file" className="py-2" aria-label="Archivo" disabled={busy} />
      <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={`Notas de la versión ${nextVersion}`} disabled={busy} />
      <Button type="submit" variant="dark" disabled={busy}>
        <Upload /> {busy ? "Subiendo…" : `Subir v${nextVersion}`}
      </Button>
    </form>
  );
}
