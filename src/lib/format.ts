import { TZDate } from "@date-fns/tz";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export const TZ = "America/La_Paz";

export function money(amount: number | null | undefined, currency: "BOB" | "USD" = "BOB") {
  if (amount === null || amount === undefined) return "[POR CONFIRMAR]";
  const n = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return currency === "USD" ? `USD ${n}` : `Bs ${n}`;
}

/** Fecha 'YYYY-MM-DD' (sin hora) → "5 nov 2026". */
export function day(d: string | null | undefined, pattern = "d MMM yyyy") {
  if (!d) return "Por definir";
  return format(parseISO(d), pattern, { locale: es });
}

/** Timestamp → fecha y hora en La Paz. */
export function dateTime(ts: string | null | undefined, pattern = "d MMM yyyy · HH:mm") {
  if (!ts) return "";
  return format(new TZDate(ts, TZ), pattern, { locale: es });
}

export function ago(ts: string) {
  return "hace " + formatDistanceToNowStrict(new Date(ts), { locale: es });
}

export function todayLaPaz() {
  return format(new TZDate(new Date(), TZ), "yyyy-MM-dd");
}

/** Instante ISO de hace n días (n = 0 → ahora). */
export function isoDaysAgo(n: number) {
  return new Date(Date.now() - n * 864e5).toISOString();
}
