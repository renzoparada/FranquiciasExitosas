import Link from "next/link";
import { CheckCircle2, Download, Lock, MessageSquareWarning, Plus, Send } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createDeliverable, reviewDeliverable, sendDeliverable } from "@/app/actions/project";
import { EscalaTile } from "@/components/escala/escala-tile";
import { RealtimeRefresh } from "@/components/escala/realtime-refresh";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import type { Profile } from "@/lib/auth";
import { getBrands, getComments, getFiles, REVIEW_LABEL, signedFiles, type ReviewStatus } from "@/lib/data";
import { STEPS } from "@/lib/escala";
import { dateTime, day } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Comments } from "./comments";
import { VersionUploader } from "./version-uploader";

type Deliverable = {
  id: string;
  brand_id: string;
  step_code: string;
  title: string;
  status: ReviewStatus;
  visibility: "interno" | "cliente";
  current_version: number;
  release_trigger: string;
  due_date: string | null;
};
type Version = {
  id: string;
  deliverable_id: string;
  version: number;
  file_id: string | null;
  notes: string | null;
  submitted_at: string | null;
  review_status: ReviewStatus;
  review_comment: string | null;
  reviewed_at: string | null;
};

const TONE: Record<ReviewStatus, "neutral" | "brand" | "warn" | "ok"> = {
  borrador: "neutral",
  enviado: "brand",
  observado: "warn",
  aprobado: "ok",
};
const RELEASE_LABEL: Record<string, string> = {
  firma: "cuota de la firma del contrato",
  RENTABLE: "cuota de la puerta RENTABLE",
  REPLICABLE: "cuota de la puerta REPLICABLE",
};

export async function DeliverablesSection({
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
  const open = typeof searchParams.d === "string" ? searchParams.d : null;
  const brand = brands.find((b) => b.id === marca) ?? brands[0];
  const isAdmin = profile.role === "admin" && !clientView;

  let dq = supabase
    .from("deliverables")
    .select("id, brand_id, step_code, title, status, visibility, current_version, release_trigger, due_date")
    .eq("brand_id", brand?.id ?? "")
    .order("sort");
  if (clientView) dq = dq.eq("visibility", "cliente").neq("status", "borrador");
  const { data: dels } = await dq;
  const deliverables = (dels ?? []) as Deliverable[];

  const { data: vers } = deliverables.length
    ? await supabase
        .from("deliverable_versions")
        .select("id, deliverable_id, version, file_id, notes, submitted_at, review_status, review_comment, reviewed_at")
        .in("deliverable_id", deliverables.map((d) => d.id))
        .order("version", { ascending: false })
    : { data: [] };
  const versions = ((vers ?? []) as Version[]).filter((v) => !clientView || v.submitted_at);
  const files = await signedFiles(supabase, await getFiles(supabase, "deliverable_version", versions.map((v) => v.id), clientView));
  const fileByVersion = new Map(files.map((f) => [f.entity_id, f]));
  const openComments = open ? await getComments(supabase, "deliverable", open, clientView) : [];

  const byStep = STEPS.map((s) => ({ step: s, items: deliverables.filter((d) => d.step_code === s.code) })).filter(
    (g) => g.items.length || isAdmin,
  );
  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { marca: brand?.id ?? null, d: open, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    return `${base}?${p.toString()}`;
  };

  return (
    <div className="space-y-4">
      <RealtimeRefresh projectId={projectId} brandIds={brands.map((b) => b.id)} />
      {brands.length > 1 && (
        <div className="flex gap-1 rounded-full border border-line bg-surface p-1 text-sm sm:w-fit">
          {brands.map((b) => (
            <Link
              key={b.id}
              href={href({ marca: b.id, d: null })}
              className={cn("flex-1 rounded-full px-4 py-1.5 text-center font-semibold", b.id === brand?.id ? "bg-ink text-canvas" : "text-muted hover:text-ink")}
            >
              {b.name}
            </Link>
          ))}
        </div>
      )}

      {byStep.map(({ step, items }) => (
        <Card key={step.code} className="p-0">
          <div className="flex items-center gap-3 border-b border-line/60 px-5 py-4">
            <EscalaTile letter={step.letter} size="md" />
            <div>
              <h3 className="font-display font-black">{step.name}</h3>
              <p className="text-xs text-muted">{items.length} entregables</p>
            </div>
          </div>
          <ul className="divide-y divide-line/50">
            {items.map((d) => {
              const vs = versions.filter((v) => v.deliverable_id === d.id);
              const current = vs.find((v) => v.version === d.current_version) ?? vs[0];
              const currentFile = current ? fileByVersion.get(current.id) : undefined;
              const locked = clientView && current?.file_id && !currentFile;
              const isOpen = open === d.id;
              const nextVersion = (vs[0]?.version ?? 0) + 1;
              const pendingSend = isAdmin && vs[0] && !vs[0].submitted_at;
              return (
                <li key={d.id} id={`d-${d.id}`}>
                  <Link href={href({ d: isOpen ? null : d.id })} scroll={false} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-surface-2/60">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{d.title}</span>
                      <span className="text-xs text-muted">
                        {d.current_version ? `Versión ${d.current_version}` : "Sin versión enviada"}
                        {d.due_date && ` · entrega ${day(d.due_date, "d MMM")}`}
                        {d.visibility === "interno" && " · interno"}
                      </span>
                    </span>
                    {pendingSend && <Badge tone="dark">v{vs[0].version} sin enviar</Badge>}
                    {locked && (
                      <Badge>
                        <Lock className="size-3" /> Descarga bloqueada
                      </Badge>
                    )}
                    <Badge tone={TONE[d.status]}>{REVIEW_LABEL[d.status]}</Badge>
                  </Link>

                  {isOpen && (
                    <div className="space-y-5 bg-surface-2/40 px-5 pb-6 pt-2">
                      {/* Descarga */}
                      {current && (
                        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-4">
                          {currentFile?.url ? (
                            <Button asChild variant="dark" size="sm">
                              <a href={currentFile.url}>
                                <Download /> Descargar v{current.version}
                              </a>
                            </Button>
                          ) : locked ? (
                            <p className="flex items-center gap-2 text-sm">
                              <Lock className="size-4 text-brand" /> Disponible para descarga al pagar la{" "}
                              <strong>{RELEASE_LABEL[d.release_trigger] ?? d.release_trigger}</strong>.
                            </p>
                          ) : (
                            <p className="text-sm text-muted">La versión aún no tiene archivo.</p>
                          )}
                          {current.notes && <p className="text-sm text-muted">“{current.notes}”</p>}
                        </div>
                      )}

                      {/* Revisión del cliente */}
                      {d.status === "enviado" && clientView && profile.role === "cliente" && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <ActionForm action={reviewDeliverable} className="rounded-2xl border border-ok/30 bg-ok/5 p-4">
                            <input type="hidden" name="deliverable_id" value={d.id} />
                            <input type="hidden" name="decision" value="aprobado" />
                            <input type="hidden" name="path" value={base} />
                            <p className="text-sm font-semibold">¿Todo en orden?</p>
                            <Textarea name="comment" placeholder="Comentario (opcional)" className="mt-2 min-h-16" />
                            <Button type="submit" className="mt-2 bg-ok text-white">
                              <CheckCircle2 /> Aprobar entregable
                            </Button>
                          </ActionForm>
                          <ActionForm action={reviewDeliverable} className="rounded-2xl border border-warn/40 bg-warn/5 p-4">
                            <input type="hidden" name="deliverable_id" value={d.id} />
                            <input type="hidden" name="decision" value="observado" />
                            <input type="hidden" name="path" value={base} />
                            <p className="text-sm font-semibold">¿Algo por ajustar?</p>
                            <Textarea name="comment" placeholder="Cuéntanos qué cambiar" className="mt-2 min-h-16" required />
                            <Button type="submit" variant="outline" className="mt-2">
                              <MessageSquareWarning /> Enviar observación
                            </Button>
                          </ActionForm>
                        </div>
                      )}

                      {/* Consultor: nueva versión y envío */}
                      {isAdmin && (
                        <div className="space-y-3 rounded-2xl bg-surface p-4">
                          <VersionUploader projectId={projectId} brandId={d.brand_id} deliverableId={d.id} nextVersion={nextVersion} />
                          {pendingSend && (
                            <ActionForm action={sendDeliverable}>
                              <input type="hidden" name="deliverable_id" value={d.id} />
                              <input type="hidden" name="path" value={base} />
                              <Button type="submit">
                                <Send /> Enviar v{vs[0].version} al cliente para revisión
                              </Button>
                            </ActionForm>
                          )}
                        </div>
                      )}

                      {/* Historial */}
                      {vs.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Historial de versiones</p>
                          <ol className="space-y-1.5 text-sm">
                            {vs.map((v) => {
                              const f = fileByVersion.get(v.id);
                              return (
                                <li key={v.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface px-3 py-2">
                                  <span className="font-bold">v{v.version}</span>
                                  <span className="text-muted">{v.submitted_at ? `enviada ${dateTime(v.submitted_at, "d MMM")}` : "borrador"}</span>
                                  {v.submitted_at && <Badge tone={TONE[v.review_status]}>{REVIEW_LABEL[v.review_status]}</Badge>}
                                  {v.review_comment && <span className="text-muted">“{v.review_comment}”</span>}
                                  {f?.url && (
                                    <a href={f.url} className="ml-auto text-brand" aria-label={`Descargar v${v.version}`}>
                                      <Download className="size-4" />
                                    </a>
                                  )}
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      )}

                      <Comments comments={openComments} projectId={projectId} entityType="deliverable" entityId={d.id} path={base} isStaff={!clientView && profile.role !== "cliente"} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {isAdmin && brand && (
            <details className="border-t border-line/60">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-semibold text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
                <Plus className="size-4" /> Agregar entregable a {step.letter}
              </summary>
              <ActionForm action={createDeliverable} className="grid gap-3 px-5 pb-5 sm:grid-cols-[2fr_1fr_1fr_auto]">
                <input type="hidden" name="brand_id" value={brand.id} />
                <input type="hidden" name="step_code" value={step.code} />
                <input type="hidden" name="path" value={base} />
                <Field label="Nombre">
                  <Input name="title" required />
                </Field>
                <Field label="Se libera con (regla 7)">
                  <Select name="release_trigger" defaultValue="firma">
                    <option value="firma">Cuota de firma</option>
                    <option value="RENTABLE">Cuota RENTABLE</option>
                    <option value="REPLICABLE">Cuota REPLICABLE</option>
                  </Select>
                </Field>
                <Field label="Visibilidad">
                  <Select name="visibility" defaultValue="cliente">
                    <option value="cliente">Visible para el cliente</option>
                    <option value="interno">Interno</option>
                  </Select>
                </Field>
                <div className="flex items-end">
                  <Button type="submit" variant="outline">Agregar</Button>
                </div>
              </ActionForm>
            </details>
          )}
        </Card>
      ))}
      {!byStep.length && <Card className="text-sm text-muted">Todavía no hay entregables enviados para esta marca.</Card>}
    </div>
  );
}
