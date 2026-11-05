import { Lock, Send } from "lucide-react";
import { addComment } from "@/app/actions/project";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { ago } from "@/lib/format";
import { cn } from "@/lib/utils";

type Comment = {
  id: string;
  body: string;
  visibility: "interno" | "cliente";
  created_at: string;
  author: { full_name: string | null; email: string; role: string } | null;
};

export function Comments({
  comments,
  projectId,
  entityType,
  entityId,
  path,
  isStaff,
}: {
  comments: Comment[];
  projectId: string;
  entityType: string;
  entityId: string;
  path: string;
  isStaff: boolean;
}) {
  return (
    <div className="space-y-4">
      {comments.length === 0 ? (
        <p className="text-sm text-muted">Todavía no hay comentarios.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => {
            const team = c.author?.role !== "cliente";
            return (
              <li key={c.id} className={cn("flex gap-3", !team && "flex-row-reverse text-right")}>
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    team ? "bg-brand text-white" : "bg-ink text-canvas",
                  )}
                >
                  {(c.author?.full_name ?? c.author?.email ?? "?").slice(0, 1).toUpperCase()}
                </span>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                    c.visibility === "interno" ? "border border-dashed border-warn/50 bg-warn/5" : "bg-surface-2",
                  )}
                >
                  <p className="text-xs font-semibold">
                    {c.author?.full_name ?? c.author?.email}{" "}
                    <span className="font-normal text-muted">· {ago(c.created_at)}</span>
                    {c.visibility === "interno" && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-warn">
                        <Lock className="size-3" /> interno
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-left">{c.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ActionForm action={addComment} className="space-y-2">
        <input type="hidden" name="project_id" value={projectId} />
        <input type="hidden" name="entity_type" value={entityType} />
        <input type="hidden" name="entity_id" value={entityId} />
        <input type="hidden" name="path" value={path} />
        <Textarea name="body" placeholder="Escribe un comentario…" required className="min-h-20" />
        <div className="flex items-center justify-between gap-3">
          {isStaff ? (
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" name="visibility" value="interno" className="accent-[var(--brand)]" />
              Nota interna (el cliente no la ve)
            </label>
          ) : (
            <span />
          )}
          <Button type="submit" size="sm">
            <Send /> Comentar
          </Button>
        </div>
      </ActionForm>
    </div>
  );
}
