"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { importFinancial, type ImportRow } from "@/app/actions/analysis";
import { Button } from "@/components/ui/button";
import { FIN_METRICS, SCENARIOS, type FinMetric } from "@/lib/finance";

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

function toMetric(v: unknown): FinMetric | null {
  const n = norm(v);
  return FIN_METRICS.find((m) => m.key === n || norm(m.label) === n)?.key ?? null;
}
function toScenario(v: unknown) {
  const n = norm(v);
  return SCENARIOS.find((s) => s.key === n)?.key ?? null;
}
function toLabel(v: unknown) {
  const n = norm(v);
  if (n.startsWith("comprob") || n === "dato comprobado") return "comprobado";
  if (n.startsWith("estim")) return "estimacion";
  if (n.startsWith("supuest")) return "supuesto";
  return null;
}
function toNumber(v: unknown): number | null {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/[^\d,.\-]/g, "");
  if (!s) return null;
  const n = Number(/,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}
function parseCsv(text: string) {
  const sep = text.split("\n")[0].includes(";") ? ";" : ",";
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, "").trim()));
}

/** Importa el modelo financiero desde Excel (.xlsx) o CSV en formato largo: métrica · escenario · valor · etiqueta. */
export function FinanceImport({ brandId, currency, path }: { brandId: string; currency: "BOB" | "USD"; path: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [pending, start] = useTransition();

  function template() {
    const lines = ["metrica;escenario;valor;etiqueta"];
    FIN_METRICS.forEach((m) => SCENARIOS.forEach((s) => lines.push(`${m.key};${s.key};;`)));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "plantilla-modelo-financiero-escala.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      let data: unknown[][];
      if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import("read-excel-file/browser");
        data = (await readSheet(file)) as unknown[][];
      } else {
        data = parseCsv(await file.text());
      }
      const out: ImportRow[] = [];
      let bad = 0;
      for (const r of data) {
        const metric = toMetric(r[0]);
        const scenario = toScenario(r[1]);
        if (!metric || !scenario) {
          bad++;
          continue;
        }
        out.push({ metric, scenario, value: toNumber(r[2]), label: toLabel(r[3]) });
      }
      setSkipped(Math.max(0, bad - 1)); // la primera fila es el encabezado
      setRows(out.filter((r) => r.value !== null));
      if (!out.length) toast.error("No se encontraron filas válidas. Usa la plantilla.");
    } catch (e) {
      toast.error(`No se pudo leer el archivo: ${(e as Error).message}`);
    }
  }

  function save() {
    if (!rows) return;
    start(async () => {
      const r = await importFinancial(brandId, currency, rows, path);
      if (r?.ok) {
        toast.success(r.message);
        setRows(null);
        router.refresh();
      } else toast.error(r?.message ?? "No se pudo importar.");
    });
  }

  const missingLabels = rows?.filter((r) => !r.label).length ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold hover:bg-surface-2">
          <FileSpreadsheet className="size-4 text-brand" /> Importar Excel o CSV
          <input type="file" accept=".xlsx,.csv" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={template}>
          <Download /> Descargar plantilla
        </Button>
      </div>
      {rows && (
        <div className="rounded-2xl bg-surface-2 p-4 text-sm">
          <p>
            <strong>{rows.length}</strong> cifras listas para importar{skipped ? ` · ${skipped} filas ignoradas` : ""}.
            {missingLabels > 0 && <span className="font-semibold text-brand"> {missingLabels} sin etiqueta: complétalas en el archivo (regla 1).</span>}
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" onClick={save} disabled={pending || missingLabels > 0}>
              {pending ? "Importando…" : "Confirmar importación"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRows(null)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
