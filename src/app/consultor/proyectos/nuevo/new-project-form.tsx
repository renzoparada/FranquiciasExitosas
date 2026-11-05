"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { EscalaTile } from "@/components/escala/escala-tile";
import { ENTRY_FORMAT_LABEL } from "@/lib/escala";
import { money } from "@/lib/format";
import { createProject } from "../../actions";

type Brand = { name: string; week_offset: number; entry_format: string };

export function NewProjectForm({ clients, today }: { clients: { id: string; name: string }[]; today: string }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [name, setName] = useState("");
  const [start, setStart] = useState(today);
  const [currency, setCurrency] = useState<"BOB" | "USD">("BOB");
  const [brands, setBrands] = useState<Brand[]>([{ name: "", week_offset: 0, entry_format: "" }]);
  const [withFee, setWithFee] = useState(true);
  const [fee, setFee] = useState({ base_amount: 35000, tax_pct: 16, success_fee_pct: 10 });

  const update = (i: number, patch: Partial<Brand>) => setBrands((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const payload = JSON.stringify({ client_id: clientId, name, start_date: start, currency, brands, fee: withFee ? fee : null });
  const total = fee.base_amount * (1 + fee.tax_pct / 100);

  return (
    <ActionForm action={createProject} resetOnSuccess={false} className="space-y-6">
      <input type="hidden" name="payload" value={payload} />
      <Card className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente" htmlFor="client">
          <Select id="client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Nombre del proyecto" htmlFor="pname">
          <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Franquiciamiento …" required />
        </Field>
        <Field label="Fecha de inicio (semana 1)" htmlFor="start">
          <Input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
        </Field>
        <Field label="Moneda" htmlFor="currency">
          <Select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value as "BOB" | "USD")}>
            <option value="BOB">Bolivianos (Bs)</option>
            <option value="USD">Dólares (USD)</option>
          </Select>
        </Field>
      </Card>

      <Card>
        <CardTitle>Marcas</CardTitle>
        <CardDescription>
          El desfase mueve todo el calendario de la marca. Ej.: Vaca Lechera con 4 semanas empieza E en la semana 5.
        </CardDescription>
        <div className="mt-4 space-y-3">
          {brands.map((b, i) => (
            <div key={i} className="grid items-end gap-3 rounded-2xl bg-surface-2 p-4 sm:grid-cols-[1.4fr_0.8fr_1fr_auto]">
              <Field label={`Marca ${i + 1}`}>
                <Input value={b.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Nombre de la marca" required />
              </Field>
              <Field label="Desfase (semanas)">
                <Input type="number" min={0} max={104} value={b.week_offset} onChange={(e) => update(i, { week_offset: Number(e.target.value) })} />
              </Field>
              <Field label="Formato de entrada (regla 3)">
                <Select value={b.entry_format} onChange={(e) => update(i, { entry_format: e.target.value })}>
                  <option value="">Por definir en S</option>
                  {Object.entries(ENTRY_FORMAT_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Quitar marca"
                disabled={brands.length === 1}
                onClick={() => setBrands((bs) => bs.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => setBrands((bs) => [...bs, { name: "", week_offset: (bs.at(-1)?.week_offset ?? 0) + 4, entry_format: "" }])}
        >
          <Plus /> Agregar marca
        </Button>
      </Card>

      <Card>
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={withFee} onChange={(e) => setWithFee(e.target.checked)} className="size-4 accent-[var(--brand)]" />
          <span className="font-display text-lg font-extrabold">Honorarios por marca</span>
        </label>
        {withFee && (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label={`Honorario fijo (${currency === "BOB" ? "Bs" : "USD"})`}>
              <Input type="number" min={0} step="0.01" value={fee.base_amount} onChange={(e) => setFee({ ...fee, base_amount: Number(e.target.value) })} />
            </Field>
            <Field label="Impuestos (%)" hint="IVA 13 % + IT 3 %">
              <Input type="number" min={0} max={100} step="0.01" value={fee.tax_pct} onChange={(e) => setFee({ ...fee, tax_pct: Number(e.target.value) })} />
            </Field>
            <Field label="Fee de éxito (%)" hint="Sobre el derecho de entrada de cada franquicia vendida">
              <Input type="number" min={0} max={100} step="0.01" value={fee.success_fee_pct} onChange={(e) => setFee({ ...fee, success_fee_pct: Number(e.target.value) })} />
            </Field>
            <p className="text-sm text-muted sm:col-span-3">
              Total por marca con impuestos: <strong className="text-ink">{money(total, currency)}</strong>. Cuotas 40 / 30 / 30 %: firma del contrato, puerta RENTABLE y puerta REPLICABLE.
            </p>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg">
          Crear proyecto ESCALA
        </Button>
        <span className="flex gap-1" aria-hidden>
          {["E", "S", "C", "A", "L", "A"].map((l, i) => (
            <EscalaTile key={i} letter={l} size="xs" />
          ))}
        </span>
      </div>
    </ActionForm>
  );
}
