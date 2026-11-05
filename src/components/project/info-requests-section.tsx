import Link from "next/link";
import { CheckCircle2, KeyRound, MessageSquareWarning, Plus, Send } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reviewInfoRequest, saveInfoRequest, submitInfoRequest } from "@/app/actions/project";
import { RealtimeRefresh } from "@/components/escala/realtime-refresh";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import type { Profile } from "@/lib/auth";
import { getBrands, getFiles, REQUEST_LABEL, signedFiles, type RequestStatus } from "@/lib/data";
import { day, todayLaPaz } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FileList } from "./file-list";
import { FileUploader } from "./file-uploader";

type Req = {
  id: string;
  brand_id: string;
  category: string;
  title: string;
  description: string | null;
  status: RequestStatus;
  is_trademark: boolean;
  due_date: string | null;
  observation: string | null;
  submitted_at: string | null;
};
const TONE: Record<RequestStatus, "neutral" | "brand" | "warn" | "ok"> = { pendiente: "neutral", recibido: "brand", observado: "warn", validado: "ok" };

export async function InfoRequestsSection({
  supabase,
  profile,
  projectId,
  base,
  clientView,
  searchParams,
}: {
  supabase: SupabaseClient;
  profile: Profile;
  projectId: string;
  base: string;
  clientView: boolean;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const brands = await getBrands(supabase, projectId);
  const marca = typeof searchParams.marca === "string" ? searchParams.marca : brands[0]?.id;
  const brand = brands.find((b) => b.id === marca) ?? brands[0];
  const isAdmin = profile.role === "admin" && !clientView;
  const isClient = profile.role === "cliente";
  const today = todayLaPaz();

  const { data } = await supabase
    .from("info_requests")
    .select("id, brand_id, category, title, description, status, is_trademark, due_date, observation, submitted_at")
    .eq("brand_id", brand?.id ?? "")
    .order("sort");
  const reqs = (data ?? []) as Req[];
  const files = await signedFiles(supabase, await getFiles(supabase, "info_request", reqs.map((r) => r.id), clientView));
  const validated = reqs.filter((r) => r.status === "validado").length;
  const pct = reqs.length ? Math.round((100 * validated) / reqs.length) : 0;
  const categories = [...new Set(reqs.map((r) => r.category))];

  return (
    <div className="space-y-4">
      <RealtimeRefresh projectId={projectId} brandIds={brands.map((b) => b.id)} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {brands.length > 1 ? (
          <div className="flex gap-1 rounded-full border border-line bg-surface p-1 text-sm">
            {brands.map((b) => (
              <Link
                key={b.id}
                href={`${base}?marca=${b.id}`}
                className={cn("rounded-full px-4 py-1.5 font-semibold", b.id === brand?.id ? "bg-ink text-canvas" : "text-muted hover:text-ink")}
              >
                {b.name}
              </Link>
            ))}
          </div>
        ) : (
          <span />
        )}
        <div className="flex min-w-56 items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-line/60">
            <div className="h-full rounded-full bg-brand transition-[width] duration-1000" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm font-semibold tabular-nums">
            {validated}/{reqs.length} validadas
          </span>
        </div>
      </div>

      {categories.map((cat) => (
        <Card key={cat} className="p-0">
          <h3 className="border-b border-line/60 px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-muted">{cat}</h3>
          <ul className="divide-y divide-line/50">
            {reqs
              .filter((r) => r.category === cat)
              .map((r) => {
                const rf = files.filter((f) => f.entity_id === r.id);
                const overdue = r.due_date && r.due_date < today && (r.status === "pendiente" || r.status === "observado");
                const canSend = isClient && (r.status === "pendiente" || r.status === "observado");
                return (
                  <li key={r.id} className="space-y-3 px-5 py-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-semibold">
                          {r.title}
                          {r.is_trademark && (
                            <Badge tone="dark">
                              <KeyRound className="size-3" /> Regla 5 · desbloquea Atraer
                            </Badge>
                          )}
                        </p>
                        {r.description && <p className="text-sm text-muted">{r.description}</p>}
                        {r.due_date && (
                          <p className={cn("mt-0.5 text-xs", overdue ? "font-bold text-brand" : "text-muted")}>
                            Fecha límite: {day(r.due_date)} {overdue && "· vencida"}
                          </p>
                        )}
                      </div>
                      <Badge tone={TONE[r.status]}>{REQUEST_LABEL[r.status]}</Badge>
                    </div>

                    {r.status === "observado" && r.observation && (
                      <p className="flex items-start gap-2 rounded-xl bg-warn/10 px-3 py-2 text-sm">
                        <MessageSquareWarning className="mt-0.5 size-4 shrink-0 text-warn" /> {r.observation}
                      </p>
                    )}

                    {rf.length > 0 && <FileList files={rf} />}

                    {(canSend || (!isClient && !clientView && r.status !== "validado")) && (
                      <FileUploader
                        target={{ projectId, brandId: r.brand_id, entityType: "info_request", entityId: r.id, visibility: "cliente" }}
                        label={isClient ? "Arrastra aquí tus archivos o haz clic para subirlos" : "Adjuntar archivo"}
                        compact={!isClient || rf.length > 0}
                      />
                    )}

                    {canSend && (
                      <ActionForm action={submitInfoRequest}>
                        <input type="hidden" name="request_id" value={r.id} />
                        <input type="hidden" name="path" value={base} />
                        <Button type="submit" size="sm" disabled={!rf.length}>
                          <Send /> {r.status === "observado" ? "Reenviar al consultor" : "Listo, enviar al consultor"}
                        </Button>
                      </ActionForm>
                    )}

                    {isAdmin && (r.status === "recibido" || r.status === "observado" || r.status === "pendiente") && (
                      <div className="flex flex-wrap items-start gap-2 rounded-2xl bg-surface-2 p-3">
                        <ActionForm action={reviewInfoRequest}>
                          <input type="hidden" name="request_id" value={r.id} />
                          <input type="hidden" name="decision" value="validado" />
                          <input type="hidden" name="path" value={base} />
                          <Button type="submit" size="sm" className="bg-ok text-white">
                            <CheckCircle2 /> Validar
                          </Button>
                        </ActionForm>
                        <ActionForm action={reviewInfoRequest} className="flex min-w-64 flex-1 gap-2">
                          <input type="hidden" name="request_id" value={r.id} />
                          <input type="hidden" name="decision" value="observado" />
                          <input type="hidden" name="path" value={base} />
                          <Input name="observation" placeholder="¿Qué falta o qué hay que corregir?" className="h-8 text-xs" />
                          <Button type="submit" size="sm" variant="outline">Observar</Button>
                        </ActionForm>
                        <ActionForm action={saveInfoRequest} resetOnSuccess={false} className="flex gap-2">
                          <input type="hidden" name="request_id" value={r.id} />
                          <input type="hidden" name="path" value={base} />
                          <Input name="due_date" type="date" defaultValue={r.due_date ?? ""} className="h-8 w-40 text-xs" aria-label="Fecha límite" />
                          <Button type="submit" size="sm" variant="ghost">Fecha</Button>
                        </ActionForm>
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </Card>
      ))}

      {isAdmin && brand && (
        <Card>
          <details>
            <summary className="flex cursor-pointer list-none items-center gap-2 font-display font-extrabold [&::-webkit-details-marker]:hidden">
              <Plus className="size-4 text-brand" /> Nueva solicitud para {brand.name}
            </summary>
            <ActionForm action={saveInfoRequest} className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_1fr]">
              <input type="hidden" name="brand_id" value={brand.id} />
              <input type="hidden" name="path" value={base} />
              <Field label="Categoría">
                <Input name="category" placeholder="Finanzas, Legal…" />
              </Field>
              <Field label="¿Qué necesitas?">
                <Input name="title" required />
              </Field>
              <Field label="Fecha límite">
                <Input name="due_date" type="date" />
              </Field>
              <div className="sm:col-span-3">
                <Field label="Detalle">
                  <Textarea name="description" className="min-h-16" />
                </Field>
              </div>
              <div>
                <Button type="submit">Agregar solicitud</Button>
              </div>
            </ActionForm>
          </details>
        </Card>
      )}
    </div>
  );
}
