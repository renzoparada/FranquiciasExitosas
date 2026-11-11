import { Globe, MapPin, Plus, Trash2 } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addLocation, addPrice, deleteCompetitor, deleteLocation, deletePrice, saveCompetitor } from "@/app/actions/analysis";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FileUploader } from "@/components/project/file-uploader";
import { getFiles, signedFiles } from "@/lib/data";
import { ENTRY_FORMAT_LABEL } from "@/lib/escala";
import { day, money } from "@/lib/format";
import { CompetitorMap, type MapPoint } from "./competitor-map";
import { DataLabelBadge, LabelSelect } from "./data-label-badge";

type Competitor = {
  id: string;
  name: string;
  format: string | null;
  format_notes: string | null;
  digital_presence: { instagram?: string | null; facebook?: string | null; tiktok?: string | null; web?: string | null; seguidores?: string | null };
  source: string | null;
  observed_on: string | null;
  confidence: string | null;
  notes: string | null;
  competitor_locations: { id: string; address: string | null; city: string | null; lat: number | null; lng: number | null }[];
  competitor_prices: { id: string; size_name: string; price: number | null; currency: "BOB" | "USD"; grams: number | null; service_time_sec: number | null; data_label: string | null }[];
};

const COLORS = ["#E30613", "#1D1D1F", "#6E6E73", "#B00010", "#FF6B72", "#3A3A3F"];
const PC = <span className="text-[11px] font-bold text-brand">[POR CONFIRMAR]</span>;

export async function CompetitorsSection({ supabase, projectId, path, editable, clientView }: { supabase: SupabaseClient; projectId: string; path: string; editable: boolean; clientView: boolean }) {
  let q = supabase
    .from("competitors")
    .select("id, name, format, format_notes, digital_presence, source, observed_on, confidence, notes, competitor_locations(id, address, city, lat, lng), competitor_prices(id, size_name, price, currency, grams, service_time_sec, data_label)")
    .eq("project_id", projectId)
    .order("name");
  if (clientView) q = q.eq("visibility", "cliente");
  const { data } = await q;
  const comps = (data ?? []) as Competitor[];
  const photos = await signedFiles(supabase, await getFiles(supabase, "competitor", comps.map((c) => c.id), clientView));
  const points: MapPoint[] = comps.flatMap((c, i) =>
    c.competitor_locations.filter((l) => l.lat !== null && l.lng !== null).map((l) => ({ lat: l.lat!, lng: l.lng!, name: c.name, address: [l.address, l.city].filter(Boolean).join(", ") || null, color: COLORS[i % COLORS.length] })),
  );
  const sizes = [...new Set(comps.flatMap((c) => c.competitor_prices.map((p) => p.size_name)))];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardTitle>Mapa de ubicaciones</CardTitle>
          <CardDescription>{points.length ? `${points.length} ubicaciones con coordenadas.` : "Agrega coordenadas a cada ubicación para verla en el mapa."}</CardDescription>
          <div className="mt-4">
            <CompetitorMap points={points} />
          </div>
        </Card>
        <Card>
          <CardTitle>Competidores</CardTitle>
          <ul className="mt-3 space-y-2 text-sm">
            {comps.map((c, i) => (
              <li key={c.id} className="flex items-center gap-2">
                <span className="size-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <a href={`#c-${c.id}`} className="font-semibold hover:text-brand">{c.name}</a>
                <span className="text-muted">· {c.competitor_locations.length} ubic. · {c.competitor_prices.length} precios</span>
              </li>
            ))}
          </ul>
          {editable && (
            <details className="mt-5 border-t border-line/60 pt-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                <Plus className="size-4 text-brand" /> Agregar competidor
              </summary>
              <ActionForm action={saveCompetitor} className="mt-3 flex gap-2">
                <input type="hidden" name="project_id" value={projectId} />
                <input type="hidden" name="path" value={path} />
                <Input name="name" placeholder="Nombre" required />
                <Button type="submit" variant="outline">Agregar</Button>
              </ActionForm>
            </details>
          )}
        </Card>
      </div>

      {/* Tabla comparativa */}
      <Card className="overflow-x-auto p-0">
        <div className="px-5 py-4">
          <CardTitle>Tabla comparativa</CardTitle>
          <CardDescription>Precio · gramaje · tiempo de servicio por tamaño. Lo que falta se muestra como [POR CONFIRMAR].</CardDescription>
        </div>
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-y border-line/60 bg-surface-2/60 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3">Competidor</th>
              <th className="px-3 py-3">Formato</th>
              {sizes.map((s) => <th key={s} className="px-3 py-3">{s}</th>)}
              <th className="px-3 py-3">Presencia digital</th>
              <th className="px-5 py-3">Fuente · fecha · confianza</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/50">
            {comps.map((c) => (
              <tr key={c.id} className="align-top">
                <td className="px-5 py-3 font-semibold">{c.name}</td>
                <td className="px-3 py-3">{c.format ? ENTRY_FORMAT_LABEL[c.format] : PC}</td>
                {sizes.map((s) => {
                  const p = c.competitor_prices.find((x) => x.size_name === s);
                  return (
                    <td key={s} className="px-3 py-3 text-xs">
                      {p ? (
                        <div className="space-y-0.5">
                          <div className="font-semibold">{p.price !== null ? money(Number(p.price), p.currency) : PC}</div>
                          <div className="text-muted">{p.grams !== null ? `${Number(p.grams)} g` : "— g"} · {p.service_time_sec !== null ? `${p.service_time_sec} s` : "— s"}</div>
                          <DataLabelBadge label={p.data_label} empty={p.price === null && p.grams === null} />
                        </div>
                      ) : PC}
                    </td>
                  );
                })}
                <td className="px-3 py-3 text-xs">
                  {Object.entries(c.digital_presence ?? {}).filter(([, v]) => v).map(([k, v]) => <div key={k}><span className="text-muted">{k}:</span> {String(v)}</div>)}
                  {!Object.values(c.digital_presence ?? {}).some(Boolean) && PC}
                </td>
                <td className="px-5 py-3 text-xs">
                  <div>{c.source ?? PC}</div>
                  <div className="text-muted">{c.observed_on ? day(c.observed_on) : "Sin fecha"}</div>
                  <DataLabelBadge label={c.confidence} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Fichas */}
      {comps.map((c) => {
        const ph = photos.filter((p) => p.entity_id === c.id);
        return (
          <Card key={c.id} id={`c-${c.id}`} className="scroll-mt-24 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-xl font-black">{c.name}</h3>
                <p className="text-sm text-muted">{[c.format && ENTRY_FORMAT_LABEL[c.format], c.format_notes].filter(Boolean).join(" · ") || "Formato por confirmar"}</p>
              </div>
              <DataLabelBadge label={c.confidence} />
            </div>

            {ph.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {ph.map((p) =>
                  p.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a key={p.id} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.name} className="h-28 w-40 shrink-0 rounded-xl object-cover" /></a>
                  ) : null,
                )}
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><MapPin className="size-3.5" /> Ubicaciones</p>
                <ul className="space-y-1 text-sm">
                  {c.competitor_locations.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-1.5">
                      <span className="flex-1">{[l.address, l.city].filter(Boolean).join(", ") || "Sin dirección"}{l.lat !== null && <span className="text-xs text-muted"> · {l.lat}, {l.lng}</span>}</span>
                      {editable && (
                        <form action={deleteLocation}><input type="hidden" name="location_id" value={l.id} /><input type="hidden" name="path" value={path} />
                          <button className="text-muted hover:text-brand" aria-label="Quitar ubicación"><Trash2 className="size-3.5" /></button></form>
                      )}
                    </li>
                  ))}
                  {!c.competitor_locations.length && <li className="text-muted">{PC}</li>}
                </ul>
                {editable && (
                  <ActionForm action={addLocation} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                    <input type="hidden" name="competitor_id" value={c.id} /><input type="hidden" name="path" value={path} />
                    <Input name="address" placeholder="Dirección" className="col-span-2 h-9 text-xs sm:col-span-1" />
                    <Input name="city" placeholder="Ciudad" className="h-9 text-xs" />
                    <Input name="lat" placeholder="Latitud" className="h-9 text-xs" />
                    <Input name="lng" placeholder="Longitud" className="h-9 text-xs" />
                    <Button type="submit" size="sm" variant="outline">Agregar</Button>
                    <p className="col-span-2 text-[11px] text-muted sm:col-span-5">Tip: en Google Maps, clic derecho sobre el local → copia las coordenadas.</p>
                  </ActionForm>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Precios por tamaño</p>
                <ul className="space-y-1 text-sm">
                  {c.competitor_prices.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-1.5">
                      <span className="font-semibold">{p.size_name}</span>
                      <span>{p.price !== null ? money(Number(p.price), p.currency) : PC}</span>
                      <span className="text-xs text-muted">{p.grams !== null ? `${Number(p.grams)} g` : ""} {p.service_time_sec !== null ? `· ${p.service_time_sec} s` : ""}</span>
                      <DataLabelBadge label={p.data_label} empty={p.price === null && p.grams === null} />
                      {editable && (
                        <form action={deletePrice} className="ml-auto"><input type="hidden" name="price_id" value={p.id} /><input type="hidden" name="path" value={path} />
                          <button className="text-muted hover:text-brand" aria-label="Quitar precio"><Trash2 className="size-3.5" /></button></form>
                      )}
                    </li>
                  ))}
                  {!c.competitor_prices.length && <li className="text-muted">{PC}</li>}
                </ul>
                {editable && (
                  <ActionForm action={addPrice} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_1fr_auto]">
                    <input type="hidden" name="competitor_id" value={c.id} /><input type="hidden" name="path" value={path} />
                    <Input name="size_name" placeholder="Tamaño" required className="h-9 text-xs" />
                    <Input name="price" placeholder="Precio Bs" className="h-9 text-xs" />
                    <Input name="grams" placeholder="Gramos" className="h-9 text-xs" />
                    <Input name="service_time_sec" placeholder="Seg." className="h-9 text-xs" />
                    <LabelSelect name="data_label" />
                    <Button type="submit" size="sm" variant="outline">Agregar</Button>
                  </ActionForm>
                )}
              </div>
            </div>

            {editable && (
              <details className="border-t border-line/60 pt-4">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden"><Globe className="size-4 text-brand" /> Editar ficha, presencia digital y fotos</summary>
                <ActionForm action={saveCompetitor} resetOnSuccess={false} className="mt-4 grid gap-3 sm:grid-cols-3">
                  <input type="hidden" name="competitor_id" value={c.id} /><input type="hidden" name="path" value={path} />
                  <Field label="Nombre"><Input name="name" defaultValue={c.name} required /></Field>
                  <Field label="Formato">
                    <Select name="format" defaultValue={c.format ?? ""}>
                      <option value="">Por confirmar</option>
                      {Object.entries(ENTRY_FORMAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </Select>
                  </Field>
                  <Field label="Detalle del formato"><Input name="format_notes" defaultValue={c.format_notes ?? ""} /></Field>
                  <Field label="Instagram"><Input name="instagram" defaultValue={c.digital_presence?.instagram ?? ""} /></Field>
                  <Field label="Facebook"><Input name="facebook" defaultValue={c.digital_presence?.facebook ?? ""} /></Field>
                  <Field label="TikTok"><Input name="tiktok" defaultValue={c.digital_presence?.tiktok ?? ""} /></Field>
                  <Field label="Web"><Input name="web" defaultValue={c.digital_presence?.web ?? ""} /></Field>
                  <Field label="Seguidores (con fecha)"><Input name="seguidores" defaultValue={c.digital_presence?.seguidores ?? ""} placeholder="Ej.: 12 mil IG, nov 2026" /></Field>
                  <Field label="Fuente"><Input name="source" defaultValue={c.source ?? ""} placeholder="Visita, web, redes…" /></Field>
                  <Field label="Fecha de observación"><Input name="observed_on" type="date" defaultValue={c.observed_on ?? ""} /></Field>
                  <Field label="Confianza"><LabelSelect name="confidence" defaultValue={c.confidence} className="h-11 w-full rounded-xl text-sm" /></Field>
                  <div className="sm:col-span-3"><Field label="Notas"><Textarea name="notes" defaultValue={c.notes ?? ""} className="min-h-16" /></Field></div>
                  <div className="sm:col-span-3"><Button type="submit">Guardar ficha</Button></div>
                </ActionForm>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <FileUploader target={{ projectId, entityType: "competitor", entityId: c.id, visibility: "cliente" }} label="Subir fotos del local o del producto" compact />
                  <form action={deleteCompetitor}>
                    <input type="hidden" name="competitor_id" value={c.id} /><input type="hidden" name="path" value={path} />
                    <Button type="submit" variant="ghost" className="text-brand"><Trash2 /> Eliminar competidor</Button>
                  </form>
                </div>
              </details>
            )}
            {c.notes && !editable && <p className="text-sm text-muted">{c.notes}</p>}
          </Card>
        );
      })}
    </div>
  );
}
