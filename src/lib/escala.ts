// Constantes del Método ESCALA® (espejo de la plantilla en la base de datos).

export type StepCode = "E" | "S" | "C" | "A1" | "L" | "A2";
export type GateCode = "FRANQUICIABLE" | "RENTABLE" | "REPLICABLE" | "VENDIBLE" | "AUTONOMA";
export type StepStatus = "pendiente" | "en_curso" | "en_revision" | "cerrado";
export type GateStatus = "pendiente" | "acta_enviada" | "observada" | "superada";
export type Pillar = "estructuracion" | "desarrollo" | "expansion";
export type AppRole = "admin" | "especialista" | "cliente";

export const LEMA = "Estructura · Desarrolla · Expande";

export const STEPS: { code: StepCode; letter: string; name: string; stage: string; pillar: Pillar; ref: string }[] = [
  { code: "E", letter: "E", name: "Evaluar la franquiciabilidad", stage: "Diagnóstico", pillar: "estructuracion", ref: "3-5 semanas" },
  { code: "S", letter: "S", name: "Sustentar el modelo", stage: "Diseño del modelo", pillar: "estructuracion", ref: "4-6 semanas" },
  { code: "C", letter: "C", name: "Codificar el know-how", stage: "Sistema operativo", pillar: "desarrollo", ref: "6-10 semanas" },
  { code: "A1", letter: "A", name: "Atraer franquiciados", stage: "Expansión comercial", pillar: "expansion", ref: "4-6 semanas" },
  { code: "L", letter: "L", name: "Lanzar unidades", stage: "Aperturas", pillar: "expansion", ref: "desde la 1.ª apertura" },
  { code: "A2", letter: "A", name: "Acompañar la red", stage: "Supervisión", pillar: "expansion", ref: "6-12 meses" },
];

export const GATES: { code: GateCode; name: string; step: StepCode; criterion: string }[] = [
  { code: "FRANQUICIABLE", name: "Franquiciable", step: "E", criterion: "Decisión escrita de franquiciar, ajustar o no franquiciar." },
  { code: "RENTABLE", name: "Rentable", step: "S", criterion: "Payback del franquiciado validado." },
  { code: "REPLICABLE", name: "Replicable", step: "C", criterion: "Turno piloto aprobado usando solo el manual." },
  { code: "VENDIBLE", name: "Vendible", step: "A1", criterion: "Primer contrato de franquicia firmado." },
  { code: "AUTONOMA", name: "Autónoma", step: "A2", criterion: "La red opera sin el consultor." },
];

export const PILLARS: Record<Pillar, { name: string; color: string }> = {
  estructuracion: { name: "Estructuración", color: "#E30613" },
  desarrollo: { name: "Desarrollo", color: "#1D1D1F" },
  expansion: { name: "Expansión", color: "#6E6E73" },
};

export const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  en_revision: "En revisión",
  cerrado: "Cerrado",
};

export const GATE_STATUS_LABEL: Record<GateStatus, string> = {
  pendiente: "Pendiente",
  acta_enviada: "Acta por aprobar",
  observada: "Acta observada",
  superada: "Superada",
};

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Consultor",
  especialista: "Especialista",
  cliente: "Cliente",
};

export const SPECIALTY_LABEL: Record<string, string> = {
  financiero: "Financiero",
  alimentos: "Chef / Ing. de alimentos",
  legal: "Abogado",
  marketing: "Marketing",
  operaciones: "Operaciones",
  tecnologia: "Tecnología",
};

export const ENTRY_FORMAT_LABEL: Record<string, string> = {
  kiosco: "Kiosco",
  isla: "Isla",
  local_pequeno: "Local pequeño",
  dark_kitchen: "Dark kitchen",
  modulo_movil: "Módulo móvil",
  otro: "Otro",
};

export const TRADEMARK_LABEL: Record<string, string> = {
  sin_registro: "Sin registro",
  en_tramite: "En trámite",
  registrada: "Registrada",
};

// ---------- Tipos del resumen (RPC get_project_overview) ----------
export type OverviewStep = {
  code: StepCode;
  letter: string;
  name: string;
  pillar: Pillar;
  status: StepStatus;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  locked: boolean;
  progress: number;
};

export type OverviewGate = {
  id: string;
  code: GateCode;
  name: string;
  status: GateStatus;
  planned_date: string | null;
  passed_at: string | null;
};

export type OverviewBrand = {
  id: string;
  name: string;
  color: string | null;
  logo_url: string | null;
  entry_format: string | null;
  trademark_ok: boolean;
  first_opening_date: string | null;
  progress: number;
  steps: OverviewStep[];
  gates: OverviewGate[];
};

export type ProjectOverview = {
  today: string;
  brands: OverviewBrand[];
  stats: {
    tasks_done_week: number;
    deliverables_to_review: number;
    minutes_to_review: number;
    info_pending: number;
    overall_progress: number;
    next_gate: { name: string; brand: string; date: string; days: number } | null;
  };
};

export type LetterState = "done" | "current" | "pending" | "locked";

/** Estado de cada letra para una marca o para el conjunto de marcas. */
export function letterStates(brands: OverviewBrand[]): { step: (typeof STEPS)[number]; state: LetterState }[] {
  return STEPS.map((step) => {
    const all = brands.map((b) => b.steps.find((s) => s.code === step.code)).filter(Boolean) as OverviewStep[];
    let state: LetterState = "pending";
    if (all.length > 0 && all.every((s) => s.status === "cerrado")) state = "done";
    else if (all.some((s) => s.status === "en_curso" || s.status === "en_revision")) state = "current";
    else if (all.length > 0 && all.every((s) => s.locked)) state = "locked";
    return { step, state };
  });
}

/** Estado agregado de una puerta: superada si todas las marcas la superaron. */
export function gateState(brands: OverviewBrand[], code: GateCode): GateStatus {
  const all = brands.map((b) => b.gates.find((g) => g.code === code)?.status ?? "pendiente");
  if (all.length > 0 && all.every((s) => s === "superada")) return "superada";
  if (all.some((s) => s === "acta_enviada")) return "acta_enviada";
  if (all.some((s) => s === "observada")) return "observada";
  return "pendiente";
}
