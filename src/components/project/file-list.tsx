import { Download, FileText, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { dateTime } from "@/lib/format";

export type SignedFile = { id: string; name: string; url: string | null; created_at: string; visibility: "interno" | "cliente" };

export function FileList({ files, empty = "Sin archivos todavía." }: { files: SignedFile[]; empty?: string }) {
  if (!files.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
          <FileText className="size-4 shrink-0 text-brand" />
          <span className="min-w-0 flex-1 truncate">{f.name}</span>
          {f.visibility === "interno" && (
            <Badge>
              <Lock className="size-3" /> Interno
            </Badge>
          )}
          <span className="hidden text-xs text-muted sm:inline">{dateTime(f.created_at, "d MMM")}</span>
          {f.url && (
            <a href={f.url} className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-brand" aria-label={`Descargar ${f.name}`}>
              <Download className="size-4" />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
